// public/js/panic.js

(function() {
    // Customize your settings here
    const safeSite = 'https://classroom.google.com'; // Where to go
    const panicKey = '`'; // The key to press (Tilde key, below Esc)

    window.addEventListener('keydown', (event) => {
        if (event.key === panicKey) {
            // Redirect immediately
            window.location.href = safeSite;
        }
    });

    console.log('Panic Key active: Press "' + panicKey + '" to hide this page.');
})();