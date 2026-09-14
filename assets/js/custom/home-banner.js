(() => {
  document.querySelectorAll('[data-home-banner-images]').forEach((banner) => {
    let sources;
    try { sources = JSON.parse(banner.dataset.homeBannerImages); }
    catch (_) { return; }
    if (!Array.isArray(sources) || !sources.length) return;
    sources = [...new Set(sources)];
    const gallery = banner.querySelector('[data-photo-gallery]');
    const button = banner.querySelector('[data-photo-shuffle]');
    const status = banner.querySelector('[data-photo-status]');
    if (!gallery || !button || !status) return;
    const mobile = window.matchMedia('(max-width: 600px)');
    const cache = new Map();
    let current = null;
    let generation = 0;
    const shuffled = (items) => {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    // Images are loaded on demand; successful dimensions are reused.
    function load(src) {
      if (cache.has(src)) return cache.get(src);
      const pending = new Promise((resolve) => {
        const image = new Image();
        const finish = (value) => {
          clearTimeout(timer);
          image.onload = image.onerror = null;
          resolve(value);
        };
        const timer = setTimeout(() => finish(null), 8000);
        image.onload = () => finish({src, portrait: image.naturalHeight > image.naturalWidth});
        image.onerror = () => finish(null);
        image.src = src;
      });
      cache.set(src, pending);
      return pending;
    }
    function element(photo) {
      const image = document.createElement('img');
      image.alt = '일상의 조각 — 사진';
      image.decoding = 'async';
      image.src = photo.src;
      return image;
    }
    async function pair(photo, token) {
      if (!photo.portrait || mobile.matches) return;
      for (const src of shuffled(sources.filter((src) => src !== photo.src))) {
        if (token !== generation || mobile.matches) return;
        const candidate = await load(src);
        if (token !== generation || mobile.matches) return;
        if (candidate && candidate.portrait) {
          gallery.append(element(candidate));
          gallery.classList.add('is-pair');
          return;
        }
      }
    }
    async function showNext() {
      const token = ++generation;
      button.disabled = true;
      status.textContent = '사진을 불러오는 중…';
      const candidates = shuffled(sources.filter((src) => !current || src !== current.src));
      if (!candidates.length && current) candidates.push(current.src);
      let photo = null;
      for (const src of candidates) {
        photo = await load(src);
        if (token !== generation) return;
        if (photo) break;
      }
      if (photo) {
        current = photo;
        gallery.classList.remove('is-pair');
        gallery.replaceChildren(element(photo));
        banner.hidden = false;
        status.textContent = '';
        // Pairing must not block the shuffle control or the first photo.
        pair(photo, token);
      } else {
        status.textContent = '다른 사진을 불러오지 못했습니다.';
      }
      button.disabled = sources.length < 2;
    }
    button.addEventListener('click', showNext);
    mobile.addEventListener('change', () => {
      if (!current) return;
      const token = ++generation;
      gallery.classList.remove('is-pair');
      gallery.replaceChildren(element(current));
      status.textContent = '';
      button.disabled = sources.length < 2;
      pair(current, token);
    });
    showNext();
  });
})();
