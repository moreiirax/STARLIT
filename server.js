const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');

const app = express();
const port = process.env.PORT || 3000;
const databasePath = path.join(__dirname, 'starlit.db');
const sessionDuration = 1000 * 60 * 60 * 24 * 30;
let database;
const loginAttempts = new Map();
const loginWindow = 15 * 60 * 1000;
const loginLimit = 8;

app.use(express.json());

function saveDatabase() {
    fs.writeFileSync(databasePath, Buffer.from(database.export()));
}

function run(sql, parameters = []) {
    database.run(sql, parameters);
    saveDatabase();
}

function get(sql, parameters = []) {
    const statement = database.prepare(sql);
    statement.bind(parameters);
    const result = statement.step() ? statement.getAsObject() : null;
    statement.free();
    return result;
}

function all(sql, parameters = []) {
    const statement = database.prepare(sql);
    statement.bind(parameters);
    const results = [];
    while (statement.step()) results.push(statement.getAsObject());
    statement.free();
    return results;
}

function getClientKey(request) {
    return request.ip || request.socket.remoteAddress || 'unknown';
}

function isRateLimited(request, scope) {
    const key = `${scope}:${getClientKey(request)}`;
    const current = loginAttempts.get(key) || { count: 0, startedAt: Date.now() };
    if (Date.now() - current.startedAt > loginWindow) {
        loginAttempts.delete(key);
        return false;
    }
    return current.count >= loginLimit;
}

function recordFailedAttempt(request, scope) {
    const key = `${scope}:${getClientKey(request)}`;
    const current = loginAttempts.get(key) || { count: 0, startedAt: Date.now() };
    current.count += 1;
    loginAttempts.set(key, current);
}

function clearFailedAttempts(request, scope) {
    loginAttempts.delete(`${scope}:${getClientKey(request)}`);
}

function requireUser(request, response, next) {
    const user = getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ message: 'Sessão expirada.' });
    request.user = user;
    next();
}

function requireAdmin(request, response, next) {
    const user = getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') return response.status(403).json({ message: 'Acesso negado.' });
    request.user = user;
    next();
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookies(request) {
    return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((item) => {
        const separator = item.indexOf('=');
        return [item.slice(0, separator).trim(), decodeURIComponent(item.slice(separator + 1))];
    }));
}

function createSession(userId, response) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + sessionDuration;
    run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), userId, expiresAt]);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader('Set-Cookie', `starlit_session=${token}; HttpOnly; SameSite=Lax; Max-Age=${sessionDuration / 1000}; Path=/${secure}`);
}

function getAuthenticatedUser(request) {
    const token = readCookies(request).starlit_session;
    if (!token) return null;
    return get(`
        SELECT users.id, users.name, users.email, users.role
        FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `, [hashToken(token), Date.now()]);
}

function clearSession(request, response) {
    const token = readCookies(request).starlit_session;
    if (token) run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
    response.setHeader('Set-Cookie', 'starlit_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/');
}

app.post('/api/auth/register', async (request, response) => {
    const { name, email, password } = request.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim() || !normalizedEmail || String(password || '').length < 6) {
        return response.status(400).json({ message: 'Preencha os dados corretamente. A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        database.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [String(name).trim(), normalizedEmail, passwordHash]);
        const user = get('SELECT id, name, email FROM users WHERE email = ?', [normalizedEmail]);
        saveDatabase();
        createSession(user.id, response);
        return response.status(201).json({ name: user.name, email: user.email });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) return response.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        return response.status(500).json({ message: 'Não foi possível criar a conta.' });
    }
});

app.post('/api/auth/login', async (request, response) => {
    if (isRateLimited(request, 'user-login')) return response.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });
    const { email, password } = request.body || {};
    const user = get('SELECT id, name, email, password_hash FROM users WHERE email = ?', [String(email || '').trim().toLowerCase()]);
    if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
        recordFailedAttempt(request, 'user-login');
        return response.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }
    clearFailedAttempts(request, 'user-login');
    createSession(user.id, response);
    return response.json({ name: user.name, email: user.email });
});

app.get('/api/auth/me', (request, response) => {
    const user = getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ message: 'Sessão expirada.' });
    return response.json(user);
});

app.get('/api/profile', requireUser, (request, response) => {
    return response.json(get('SELECT id, name, email, bio, role FROM users WHERE id = ?', [request.user.id]));
});

app.put('/api/profile', requireUser, (request, response) => {
    const name = String(request.body?.name || '').trim();
    const bio = String(request.body?.bio || '').trim();
    if (!name || name.length > 60 || bio.length > 160) return response.status(400).json({ message: 'Nome ou bio inválidos.' });
    run('UPDATE users SET name = ?, bio = ? WHERE id = ?', [name, bio, request.user.id]);
    return response.json({ name, bio });
});

app.get('/api/profile/posts', requireUser, (request, response) => {
    return response.json(all(`
        SELECT posts.id, posts.body, posts.author_name AS name,
            strftime('%Y-%m-%dT%H:%M:%SZ', posts.created_at) AS createdAt,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments
        FROM posts WHERE posts.user_id = ? ORDER BY posts.created_at DESC, posts.id DESC
    `, [request.user.id]));
});

app.post('/api/auth/logout', (request, response) => {
    clearSession(request, response);
    return response.status(204).end();
});

app.post('/api/admin/login', async (request, response) => {
    if (isRateLimited(request, 'admin-login')) return response.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });
    const { email, password } = request.body || {};
    const user = get('SELECT id, name, email, role, password_hash FROM users WHERE email = ?', [String(email || '').trim().toLowerCase()]);
    if (!user || user.role !== 'admin' || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
        recordFailedAttempt(request, 'admin-login');
        return response.status(401).json({ message: 'Acesso administrativo inválido.' });
    }
    clearFailedAttempts(request, 'admin-login');
    createSession(user.id, response);
    return response.json({ name: user.name, email: user.email, role: user.role });
});

app.get('/api/admin/me', (request, response) => {
    const user = getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') return response.status(403).json({ message: 'Acesso negado.' });
    return response.json(user);
});

app.get('/api/posts', requireUser, (request, response) => {
    const orderBy = request.query.sort === 'popular'
        ? 'likes DESC, posts.created_at DESC, posts.id DESC'
        : 'posts.created_at DESC, posts.id DESC';
    const savedOnly = request.query.saved === 'true';
    const posts = all(`
        SELECT posts.id, posts.body, posts.author_name AS name,
            strftime('%Y-%m-%dT%H:%M:%SZ', posts.created_at) AS createdAt,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments,
            EXISTS(SELECT 1 FROM saved_posts WHERE saved_posts.post_id = posts.id AND saved_posts.user_id = ?) AS saved,
            EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked
        FROM posts
        ${savedOnly ? 'WHERE EXISTS(SELECT 1 FROM saved_posts WHERE saved_posts.post_id = posts.id AND saved_posts.user_id = ?)' : ''}
        ORDER BY ${orderBy}
    `, savedOnly ? [request.user.id, request.user.id, request.user.id] : [request.user.id, request.user.id]);
    return response.json(posts);
});

app.post('/api/posts', requireUser, (request, response) => {
    const body = String(request.body?.body || '').trim();
    if (!body || body.length > 280) return response.status(400).json({ message: 'A publicação deve ter entre 1 e 280 caracteres.' });
    run('INSERT INTO posts (user_id, author_name, body) VALUES (?, ?, ?)', [request.user.id, request.user.name, body]);
    return response.status(201).json({ message: 'Publicação criada.' });
});

app.post('/api/posts/:id/like', requireUser, (request, response) => {
    const post = get('SELECT id FROM posts WHERE id = ?', [request.params.id]);
    if (!post) return response.status(404).json({ message: 'Publicação não encontrada.' });
    const existingLike = get('SELECT post_id FROM likes WHERE post_id = ? AND user_id = ?', [post.id, request.user.id]);
    if (existingLike) run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [post.id, request.user.id]);
    else run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [post.id, request.user.id]);
    const likes = get('SELECT COUNT(*) AS count FROM likes WHERE post_id = ?', [post.id]);
    return response.json({ liked: !existingLike, likes: likes.count });
});

app.post('/api/posts/:id/save', requireUser, (request, response) => {
    const post = get('SELECT id FROM posts WHERE id = ?', [request.params.id]);
    if (!post) return response.status(404).json({ message: 'Publicação não encontrada.' });
    const savedPost = get('SELECT post_id FROM saved_posts WHERE post_id = ? AND user_id = ?', [post.id, request.user.id]);
    if (savedPost) run('DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?', [post.id, request.user.id]);
    else run('INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)', [post.id, request.user.id]);
    return response.json({ saved: !savedPost });
});

app.get('/api/posts/:id/comments', requireUser, (request, response) => {
    return response.json(all(`
        SELECT id, author_name AS name, body, created_at AS createdAt
        FROM comments WHERE post_id = ? ORDER BY created_at ASC, id ASC
    `, [request.params.id]));
});

app.post('/api/posts/:id/comments', requireUser, (request, response) => {
    const body = String(request.body?.body || '').trim();
    const post = get('SELECT id FROM posts WHERE id = ?', [request.params.id]);
    if (!post) return response.status(404).json({ message: 'Publicação não encontrada.' });
    if (!body || body.length > 240) return response.status(400).json({ message: 'O comentário deve ter entre 1 e 240 caracteres.' });
    run('INSERT INTO comments (post_id, user_id, author_name, body) VALUES (?, ?, ?, ?)', [post.id, request.user.id, request.user.name, body]);
    return response.status(201).json({ message: 'Comentário criado.' });
});

app.get('/api/admin/summary', requireAdmin, (request, response) => {
    return response.json({
        users: get("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").count,
        posts: get('SELECT COUNT(*) AS count FROM posts').count,
        likes: get('SELECT COUNT(*) AS count FROM likes').count
    });
});

app.get('/api/admin/users', requireAdmin, (request, response) => {
    return response.json(all('SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC'));
});

app.get('/api/admin/posts', requireAdmin, (request, response) => {
    return response.json(all(`
        SELECT posts.id, posts.body, posts.author_name AS author, posts.created_at AS createdAt,
            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes
        FROM posts ORDER BY posts.created_at DESC, posts.id DESC
    `));
});

app.delete('/api/admin/posts/:id', requireAdmin, (request, response) => {
    run('DELETE FROM posts WHERE id = ?', [request.params.id]);
    return response.status(204).end();
});

app.delete('/api/admin/comments/:id', requireAdmin, (request, response) => {
    run('DELETE FROM comments WHERE id = ?', [request.params.id]);
    return response.status(204).end();
});

app.use(express.static(__dirname));

(async () => {
    const SQL = await initSqlJs({ locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file) });
    database = fs.existsSync(databasePath) ? new SQL.Database(new Uint8Array(fs.readFileSync(databasePath))) : new SQL.Database();
    database.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            bio TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            author_name TEXT NOT NULL,
            body TEXT NOT NULL CHECK(length(body) <= 280),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS likes (
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS saved_posts (
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER,
            author_name TEXT NOT NULL,
            body TEXT NOT NULL CHECK(length(body) <= 240),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
    `);
    try {
        database.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    } catch (error) {
        if (!String(error.message).includes('duplicate column')) throw error;
    }
    try {
        database.run("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
    } catch (error) {
        if (!String(error.message).includes('duplicate column')) throw error;
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (adminEmail && adminPassword.length >= 12) {
        const existingAdmin = get('SELECT id FROM users WHERE email = ?', [adminEmail]);
        if (existingAdmin) {
            database.run("UPDATE users SET role = 'admin' WHERE id = ?", [existingAdmin.id]);
        } else {
            const passwordHash = await bcrypt.hash(adminPassword, 12);
            database.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Administrador', adminEmail, passwordHash, 'admin']);
        }
    }
    if (get('SELECT COUNT(*) AS count FROM posts').count === 0) {
        const starterPosts = [
            ['lua.em.movimento', 'Terminei um livro que parece ter deixado uma janela aberta para outra galáxia. Algumas histórias continuam com a gente mesmo depois da última página.'],
            ['cafecompoesia', 'A música certa muda a cor de uma tarde inteira. Hoje o céu está com trilha sonora de filme antigo.'],
            ['nina.cosmos', 'Qual foi a última descoberta que fez vocês perderem a noção do tempo?']
        ];
        starterPosts.forEach(([author, body]) => database.run('INSERT INTO posts (author_name, body) VALUES (?, ?)', [author, body]));
    }
    saveDatabase();
    app.listen(port, () => console.log(`STARLIT rodando em http://localhost:${port}`));
})();
