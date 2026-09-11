document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-protected-image]').forEach((card) => {
    const form = card.querySelector('.protected-image__form');
    const input = card.querySelector('.protected-image__input');
    const error = card.querySelector('.protected-image__error');
    const locked = card.querySelector('.protected-image__locked');
    const content = card.querySelector('.protected-image__content');
    const image = card.querySelector('[data-protected-src]');
    const expected = (card.dataset.password || '').replace(/[\s./-]/g, '');

    if (!expected || !image) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const entered = input.value.replace(/[\s./-]/g, '');
      if (entered !== expected) {
        error.textContent = '비밀번호가 맞지 않습니다. 생일을 다시 입력해 주세요.';
        input.setAttribute('aria-invalid', 'true');
        input.select();
        return;
      }

      error.textContent = '';
      input.removeAttribute('aria-invalid');
      image.src = image.dataset.protectedSrc;
      locked.hidden = true;
      locked.setAttribute('aria-hidden', 'true');
      content.hidden = false;
      card.classList.add('is-unlocked');
    });
  });
});
