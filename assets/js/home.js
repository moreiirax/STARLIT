const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#mainNavigation');

if (menuToggle && navigation) {
    menuToggle.addEventListener('click', () => {
        const isOpen = navigation.classList.toggle('is-open');
        menuToggle.classList.toggle('is-open', isOpen);
        menuToggle.setAttribute('aria-expanded', String(isOpen));
        menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    });

    navigation.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navigation.classList.remove('is-open');
            menuToggle.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Abrir menu');
        });
    });
}

fetch('/api/auth/me')
    .then((response) => {
        if (!response.ok) throw new Error('Visitante');
        return response.json();
    })
    .then((user) => {
        const actions = document.querySelector('#navActions');
        const primaryAction = document.querySelector('#heroPrimaryAction');
        const aboutAction = document.querySelector('#aboutAction');
        const firstName = user.name.trim().split(' ')[0];

        actions.replaceChildren();
        const greeting = document.createElement('span');
        greeting.className = 'nav-greeting';
        greeting.textContent = `Olá, ${firstName}`;
        const feedLink = document.createElement('a');
        feedLink.className = 'criar-conta';
        feedLink.href = 'feed.html';
        feedLink.textContent = 'Ir para o feed';
        actions.append(greeting, feedLink);

        primaryAction.href = 'feed.html';
        primaryAction.innerHTML = 'Continuar no feed <span>↗</span>';
        aboutAction.href = 'feed.html';
        aboutAction.innerHTML = 'Voltar para o seu universo <span>→</span>';
    })
    .catch(() => {});
