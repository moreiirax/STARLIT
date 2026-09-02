const registerForm = document.querySelector('.register-form');
const loginForm = document.querySelector('.login-form');

document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        const isHidden = input.type === 'password';

        input.type = isHidden ? 'text' : 'password';
        button.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
    });
});

function getUsers() {
    return JSON.parse(localStorage.getItem('starlitUsers') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('starlitUsers', JSON.stringify(users));
}

function showMessage(form, message, type) {
    let messageElement = form.querySelector('.form-message');

    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.className = 'form-message';
        form.appendChild(messageElement);
    }

    messageElement.textContent = message;
    messageElement.className = `form-message ${type}`;
}

if (registerForm) {
    registerForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(registerForm);
        const name = formData.get('nome').trim();
        const email = formData.get('email').trim().toLowerCase();
        const password = formData.get('senha');
        const passwordConfirmation = formData.get('confirmar-senha');
        const users = getUsers();

        if (password !== passwordConfirmation) {
            showMessage(registerForm, 'As senhas não coincidem.', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage(registerForm, 'A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        if (users.some((user) => user.email === email)) {
            showMessage(registerForm, 'Este e-mail já está cadastrado.', 'error');
            return;
        }

        users.push({ name, email, password });
        saveUsers(users);
        localStorage.setItem('starlitCurrentUser', JSON.stringify({ name, email }));
        showMessage(registerForm, 'Cadastro realizado! Redirecionando...', 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 700);
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(loginForm);
        const email = formData.get('email').trim().toLowerCase();
        const password = formData.get('senha');
        const user = getUsers().find((item) => item.email === email && item.password === password);

        if (!user) {
            showMessage(loginForm, 'E-mail ou senha incorretos.', 'error');
            return;
        }

        localStorage.setItem('starlitCurrentUser', JSON.stringify({
            name: user.name,
            email: user.email
        }));
        showMessage(loginForm, `Bem-vindo de volta, ${user.name}!`, 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 700);
    });
}
