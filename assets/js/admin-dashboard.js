const adminName = document.querySelector('#adminName');
const usersTable = document.querySelector('#usersTable');
const postsTable = document.querySelector('#postsTable');

function makeCell(text, className = '') {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
}

function showEmpty(table, message, columns) {
    const row = document.createElement('tr');
    const cell = makeCell(message, 'empty');
    cell.colSpan = columns;
    row.appendChild(cell);
    table.replaceChildren(row);
}

async function loadDashboard() {
    const adminResponse = await fetch('/api/admin/me');
    if (!adminResponse.ok) throw new Error('Acesso negado');
    const admin = await adminResponse.json();
    adminName.textContent = admin.name;

    const [summaryResponse, usersResponse, postsResponse] = await Promise.all([
        fetch('/api/admin/summary'),
        fetch('/api/admin/users'),
        fetch('/api/admin/posts')
    ]);
    if (!summaryResponse.ok || !usersResponse.ok || !postsResponse.ok) throw new Error('Falha ao carregar painel');
    const summary = await summaryResponse.json();
    const users = await usersResponse.json();
    const posts = await postsResponse.json();
    document.querySelector('#userCount').textContent = summary.users;
    document.querySelector('#postCount').textContent = summary.posts;
    document.querySelector('#likeCount').textContent = summary.likes;

    if (!users.length) showEmpty(usersTable, 'Nenhum usuário cadastrado.', 4);
    else usersTable.replaceChildren(...users.map((user) => {
        const row = document.createElement('tr');
        row.append(makeCell(user.name), makeCell(user.email), makeCell(user.role, user.role === 'admin' ? 'role-admin' : ''), makeCell(new Date(user.createdAt).toLocaleDateString('pt-BR')));
        return row;
    }));

    if (!posts.length) showEmpty(postsTable, 'Nenhuma publicação encontrada.', 4);
    else postsTable.replaceChildren(...posts.map((post) => {
        const row = document.createElement('tr');
        row.append(makeCell(post.author), makeCell(post.body), makeCell(post.likes));
        const actionCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Excluir';
        deleteButton.addEventListener('click', async () => {
            if (!window.confirm('Excluir esta publicação?')) return;
            const response = await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' });
            if (response.ok) await loadDashboard();
        });
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        return row;
    }));
}

document.querySelector('#adminLogout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('admin.html');
});

loadDashboard().catch(() => window.location.replace('admin.html'));
