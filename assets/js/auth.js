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
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(registerForm);
        const name = formData.get('nome').trim();
        const email = formData.get('email').trim().toLowerCase();
        const password = formData.get('senha');
        const passwordConfirmation = formData.get('confirmar-senha');
        if (password !== passwordConfirmation) {
            showMessage(registerForm, 'As senhas não coincidem.', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage(registerForm, 'A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            window.location.href = 'feed.html';
        } catch (error) {
            showMessage(registerForm, error.message || 'Não foi possível criar a conta.', 'error');
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(loginForm);
        const email = formData.get('email').trim().toLowerCase();
        const password = formData.get('senha');
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            window.location.href = 'feed.html';
        } catch (error) {
            showMessage(loginForm, error.message || 'Não foi possível entrar.', 'error');
        }
    });
}
