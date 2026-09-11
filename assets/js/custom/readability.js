document.addEventListener('DOMContentLoaded', () => {
  const desktop = window.matchMedia('(min-width: 1024px)');
  document.querySelectorAll('.toc-disclosure').forEach((details) => {
    details.open = desktop.matches;
    desktop.addEventListener('change', () => { details.open = desktop.matches; });
    details.addEventListener('click', (event) => {
      if (!desktop.matches && event.target.closest('a[href^="#"]')) details.open = false;
    });
  });

  // Only focus scroll regions when there is actually something to scroll.
  const regions = document.querySelectorAll('.markdown-table-wrapper, div.highlight > pre, .page__content mjx-container[display="true"]');
  const hints = new Map();
  const update = (region) => {
    const horizontal = region.scrollWidth > region.clientWidth + 2;
    const vertical = region.scrollHeight > region.clientHeight + 2;
    if (horizontal || vertical) {
      region.tabIndex = 0;
      region.setAttribute('role', 'region');
      region.setAttribute('aria-label', region.matches('pre') ? '코드, 스크롤 가능' : '표 또는 수식, 가로 스크롤 가능');
    } else {
      region.removeAttribute('tabindex');
      region.removeAttribute('role');
      region.removeAttribute('aria-label');
    }
    if (region.classList.contains('markdown-table-wrapper')) {
      if (!hints.has(region)) {
        const hint = document.createElement('p');
        hint.className = 'scroll-hint';
        hint.textContent = '표를 좌우로 스크롤해서 확인하세요.';
        region.before(hint);
        hints.set(region, hint);
      }
      hints.get(region).hidden = !horizontal;
    }
  };
  const observer = new ResizeObserver((entries) => entries.forEach(({ target }) => update(target)));
  regions.forEach((region) => { update(region); observer.observe(region); });
  window.addEventListener('load', () => regions.forEach(update), { once: true });
});
