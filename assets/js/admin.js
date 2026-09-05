const adminForm = document.querySelector('#adminLoginForm');

document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
    });
});

function showAdminMessage(message) {
    let messageElement = adminForm.querySelector('.form-message');
    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.className = 'form-message';
        adminForm.appendChild(messageElement);
    }
    messageElement.textContent = message;
    messageElement.className = 'form-message error';
}

adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(adminForm);

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('senha')
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        window.location.href = 'admin-dashboard.html';
    } catch (error) {
        showAdminMessage(error.message || 'Não foi possível entrar.');
    }
});
