(function () {
  var container = document.getElementById('waline');
  if (!container) return;
  var status = container.parentElement.querySelector('[data-comments-status]');
  function unavailable() {
    status.hidden = false;
    status.classList.add('is-error');
    status.textContent = '댓글 창을 불러오지 못했습니다. 잠시 후 페이지를 새로고침해 주세요.';
  }
  if (!container.dataset.serverUrl) { unavailable(); return; }
  var timer = window.setTimeout(unavailable, 15000);
  import('https://unpkg.com/@waline/client@v3/dist/waline.js').then(function (waline) {
    waline.init({
      el: container,
      serverURL: container.dataset.serverUrl,
      // Preserve the article identity across previews and the public blog.
      path: container.dataset.pagePath,
      lang: 'en',
      locale: {
        nick: '닉네임 / @인스타아이디',
        nickError: '닉네임을 입력해 주세요.',
        placeholder: '궁금한 점이나 생각을 자유롭게 남겨주세요.',
        sofa: '첫 댓글을 남겨보세요.',
        submit: '댓글 등록', reply: '답글', cancelReply: '답글 취소',
        comment: '댓글', refresh: '새로고침', more: '더 보기',
        preview: '미리보기', anonymous: '익명', uploading: '등록 중',
        word: '자', latest: '최신순', oldest: '등록순', hottest: '인기순'
      },
      login: 'disable', meta: ['nick'], requiredMeta: [],
      dark: 'html[data-theme="dark"]',
      imageUploader: false, search: false, emoji: false,
      reaction: false, pageview: false, comment: false
    });
    window.clearTimeout(timer);
    status.hidden = true;
  }).catch(function () {
    window.clearTimeout(timer);
    unavailable();
  });
})();