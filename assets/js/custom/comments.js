(function () {
  var container = document.getElementById('cusdis_thread');
  if (!container) return;
  var stylesheet = new URL(document.currentScript.dataset.stylesheet, location.href).href;
  var status = container.parentElement && container.parentElement.querySelector('[data-cusdis-status]');
  var frame;
  var resizeObserver;
  var fallbackTimer;

  function showUnavailable() {
    if (!status || frame) return;
    status.hidden = false;
    status.classList.add('is-error');
    status.textContent = '댓글 창을 불러오지 못했습니다. Cusdis 서버가 일시적으로 다운됐을 수 있습니다. 잠시 후 다시 시도해 주세요.';
  }

  window.__showCusdisUnavailable = showUnavailable;

  function syncTheme() {
    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    container.dataset.theme = theme;
    if (frame && frame.contentDocument) {
      frame.contentDocument.documentElement.dataset.theme = theme;
    }
    if (window.CUSDIS && window.CUSDIS.setTheme) window.CUSDIS.setTheme(theme);
  }

  function styleFrame() {
    // Cusdis uses a same-origin srcdoc iframe; its own document needs our stylesheet.
    var doc = frame.contentDocument;
    if (!doc || !doc.getElementById('root')) return;
    if (!doc.getElementById('blog-comments-style')) {
      var link = doc.createElement('link');
      link.id = 'blog-comments-style';
      link.rel = 'stylesheet';
      link.href = stylesheet;
      doc.head.appendChild(link);
      frame.title = 'Comments';
    }
    syncTheme();
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(function () {
      var height = Math.ceil(doc.getElementById('root').getBoundingClientRect().height) + 2;
      // Override the widget's document-height measurement so the frame can shrink too.
      frame.style.setProperty('height', height + 'px', 'important');
    });
    resizeObserver.observe(doc.getElementById('root'));
  }

  function connectFrame() {
    var next = container.querySelector('iframe');
    if (!next || next === frame) return;
    frame = next;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    if (status) status.hidden = true;
    frame.addEventListener('load', styleFrame);
    styleFrame();
  }

  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme']
  });
  new MutationObserver(connectFrame).observe(container, { childList: true });
  connectFrame();
  fallbackTimer = window.setTimeout(showUnavailable, 8000);
})();
