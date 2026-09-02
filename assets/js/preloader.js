const preloader = document.querySelector('.site-loader');

if (preloader) {
    window.addEventListener('load', () => {
        preloader.classList.add('is-finished');

        setTimeout(() => {
            preloader.remove();
        }, 900);
    });
}
