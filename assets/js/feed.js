const postsElement = document.querySelector('#posts');
const searchInput = document.querySelector('.search input');
let loadedPosts = [];
let currentSavedView = false;

function formatPostTime(value) {
    const date = new Date(value);
    const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} d`;
}

function formatCommentCount(count) {
    return `${count} ${count === 1 ? 'comentário' : 'comentários'}`;
}

function createPostElement(post, index) {
    const article = document.createElement('article');
    article.className = 'post';
    article.style.animationDelay = `${index * 80}ms`;

    const header = document.createElement('div');
    header.className = 'post-header';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = post.name.charAt(0).toUpperCase();
    const author = document.createElement('div');
    author.className = 'post-author';
    const authorName = document.createElement('strong');
    authorName.textContent = post.name;
    const time = document.createElement('small');
    time.textContent = formatPostTime(post.createdAt);
    author.append(authorName, time);
    header.append(avatar, author);

    const body = document.createElement('p');
    body.className = 'post-body';
    body.textContent = post.body;

    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const likeButton = document.createElement('button');
    likeButton.type = 'button';
    likeButton.className = `like-button${post.liked ? ' liked' : ''}`;
    likeButton.innerHTML = `<span>${post.liked ? '♥' : '♡'}</span> ${post.likes} curtidas`;
    likeButton.addEventListener('click', async () => {
        likeButton.disabled = true;
        const response = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            post.liked = result.liked;
            post.likes = result.likes;
            likeButton.classList.toggle('liked', post.liked);
            likeButton.innerHTML = `<span>${post.liked ? '♥' : '♡'}</span> ${post.likes} curtidas`;
        }
        likeButton.disabled = false;
    });
    const commentButton = document.createElement('button');
    commentButton.type = 'button';
    commentButton.innerHTML = `<span>○</span> ${formatCommentCount(post.comments || 0)}`;
    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.innerHTML = '<span>↗</span> Compartilhar';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = `save-button${post.saved ? ' saved' : ''}`;
    saveButton.innerHTML = `<span>${post.saved ? '★' : '☆'}</span> ${post.saved ? 'Salvo' : 'Salvar'}`;
    saveButton.addEventListener('click', async () => {
        const response = await fetch(`/api/posts/${post.id}/save`, { method: 'POST' });
        if (!response.ok) return;
        const result = await response.json();
        post.saved = result.saved;
        saveButton.classList.toggle('saved', post.saved);
        saveButton.innerHTML = `<span>${post.saved ? '★' : '☆'}</span> ${post.saved ? 'Salvo' : 'Salvar'}`;
        if (currentSavedView && !post.saved) await loadPosts(document.querySelector('#feedSort').value, true);
    });
    actions.append(likeButton, commentButton, saveButton, shareButton);

    const commentsPanel = document.createElement('div');
    commentsPanel.className = 'comments-panel';
    commentsPanel.hidden = true;
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';
    const commentForm = document.createElement('form');
    commentForm.className = 'comment-form';
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.maxLength = 240;
    commentInput.placeholder = 'Escreva um comentário...';
    commentInput.required = true;
    const commentSubmit = document.createElement('button');
    commentSubmit.type = 'submit';
    commentSubmit.textContent = 'Enviar';
    commentForm.append(commentInput, commentSubmit);
    commentsPanel.append(commentsList, commentForm);

    async function loadComments() {
        const response = await fetch(`/api/posts/${post.id}/comments`);
        if (!response.ok) return;
        const comments = await response.json();
        commentsList.replaceChildren();
        if (!comments.length) {
            const empty = document.createElement('p');
            empty.className = 'comments-empty';
            empty.textContent = 'Seja a primeira pessoa a comentar.';
            commentsList.appendChild(empty);
        } else {
            comments.forEach((comment) => {
                const item = document.createElement('div');
                item.className = 'comment';
                const name = document.createElement('strong');
                name.textContent = comment.name;
                const text = document.createElement('p');
                text.textContent = comment.body;
                item.append(name, text);
                commentsList.appendChild(item);
            });
        }
    }

    commentButton.addEventListener('click', async () => {
        commentsPanel.hidden = !commentsPanel.hidden;
        if (!commentsPanel.hidden) {
            await loadComments();
            commentInput.focus();
        }
    });
    commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const response = await fetch(`/api/posts/${post.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentInput.value.trim() })
        });
        if (!response.ok) return;
        post.comments = (post.comments || 0) + 1;
        commentButton.innerHTML = `<span>○</span> ${formatCommentCount(post.comments)}`;
        commentForm.reset();
        await loadComments();
    });

    article.append(header, body, actions, commentsPanel);
    return article;
}

async function loadPosts(sort = 'recent', saved = false) {
    currentSavedView = saved;
    const response = await fetch(`/api/posts?sort=${sort}&saved=${saved}`);
    if (!response.ok) throw new Error('Não foi possível carregar o feed.');
    loadedPosts = await response.json();
    renderVisiblePosts();
}

function renderVisiblePosts() {
    const query = searchInput.value.trim().toLowerCase();
    const visiblePosts = loadedPosts.filter((post) => `${post.name} ${post.body}`.toLowerCase().includes(query));
    if (!visiblePosts.length) {
        const empty = document.createElement('p');
        empty.className = 'posts-empty';
        empty.textContent = query ? 'Nenhuma descoberta encontrada.' : 'Ainda não há publicações por aqui.';
        postsElement.replaceChildren(empty);
        return;
    }
    postsElement.replaceChildren(...visiblePosts.map(createPostElement));
}

async function startFeed() {
    const userResponse = await fetch('/api/auth/me');
    if (!userResponse.ok) return window.location.replace('entrar.html');
    const currentUser = await userResponse.json();
    const displayName = currentUser.name.trim();
    const firstLetter = displayName.charAt(0).toUpperCase();
    document.querySelector('#welcomeName').textContent = displayName.split(' ')[0];
    document.querySelector('#topName').textContent = displayName;
    document.querySelector('#topAvatar').textContent = firstLetter;
    document.querySelector('#composerAvatar').textContent = firstLetter;

    const postForm = document.querySelector('#postForm');
    const postText = document.querySelector('#postText');
    const characterCount = document.querySelector('#characterCount');
    const feedSort = document.querySelector('#feedSort');
    const savedLink = document.querySelector('#savedLink');
    const feedTitle = document.querySelector('#feedTitle');
    const profileButton = document.querySelector('#profileButton');
    const profileMenu = document.querySelector('#profileMenu');
    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.replace('entrar.html');
    };
    searchInput.addEventListener('input', renderVisiblePosts);
    postText.addEventListener('input', () => {
        characterCount.textContent = `${postText.value.length} / 280`;
    });
    postForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = postText.value.trim();
        if (!body) return;
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body })
        });
        if (!response.ok) return;
        postForm.reset();
        characterCount.textContent = '0 / 280';
        await loadPosts();
    });

    document.querySelector('#logoutButton').addEventListener('click', logout);
    document.querySelector('#menuLogout').addEventListener('click', logout);
    profileButton.addEventListener('click', () => {
        profileMenu.hidden = !profileMenu.hidden;
        profileButton.setAttribute('aria-expanded', String(!profileMenu.hidden));
    });
    feedSort.addEventListener('change', () => loadPosts(feedSort.value, currentSavedView));
    savedLink.addEventListener('click', async (event) => {
        event.preventDefault();
        feedTitle.textContent = 'Salvos';
        savedLink.classList.add('active');
        document.querySelector('.nav-item.active:not(#savedLink)')?.classList.remove('active');
        await loadPosts(feedSort.value, true);
    });
    await loadPosts();
}

startFeed().catch(() => window.location.replace('entrar.html'));
