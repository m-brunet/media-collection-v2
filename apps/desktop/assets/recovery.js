document.getElementById('recovery').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('password');
    const confirmation = document.getElementById('confirmation');
    const result = document.getElementById('result');

    if (password.value !== confirmation.value) {
        result.textContent = 'The passwords must match.';

        return;
    }

    const button = document.querySelector('button');

    button.disabled = true;

    try {
        const response = await window.administratorRecovery.reset(password.value);

        result.textContent = response.message;
        password.value = '';
        confirmation.value = '';

        if (response.success) {
            document.getElementById('recovery').hidden = true;
        }
    } finally {
        button.disabled = false;
    }
});
