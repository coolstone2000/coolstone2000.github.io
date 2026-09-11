(() => {
  'use strict';

  const DEFAULT_KAKAO_KEY = '91465fcb20c1e3420262c7fd9d8b236b';
  let kakaoSdkPromise;

  const asHttpUrl = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };

  const loadKakaoSdk = () => {
    if (window.Kakao) return Promise.resolve(window.Kakao);
    if (kakaoSdkPromise) return kakaoSdkPromise;

    kakaoSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', () => {
        window.Kakao ? resolve(window.Kakao) : reject(new Error('Kakao SDK가 전역 객체를 만들지 못했습니다.'));
      });
      script.addEventListener('error', () => reject(new Error('Kakao SDK를 불러오지 못했습니다.')));
      document.head.appendChild(script);
    });
    return kakaoSdkPromise;
  };

  const copyText = async (value) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch (_) {
        // 권한이 거부되면 아래의 호환 방식으로 다시 시도합니다.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('클립보드에 복사하지 못했습니다.');
  };

  const initialize = () => {
    document.querySelectorAll('[data-social-share]').forEach((root) => {
      if (root.dataset.shareInitialized === 'true') return;
      root.dataset.shareInitialized = 'true';

      const kakaoButton = root.querySelector('[data-share-kind="kakao"]');
      const shareButton = root.querySelector('[data-share-kind="native"]');
      const status = root.querySelector('[data-share-status]');
      const shareUrl = asHttpUrl(root.dataset.shareUrl) || window.location.href;
      const shareTitle = root.dataset.shareTitle || document.title;
      const shareDescription = root.dataset.shareDescription || '';
      const shareImage = asHttpUrl(root.dataset.shareImage);
      const kakaoKey = root.dataset.kakaoKey || DEFAULT_KAKAO_KEY;
      const productionOrigin = root.dataset.productionOrigin || window.location.origin;

      const setStatus = (message, isError = false) => {
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('is-error', isError);
      };

      const isProductionPage = () => {
        try {
          return window.location.origin === new URL(productionOrigin, window.location.href).origin;
        } catch (_) {
          return false;
        }
      };

      if (kakaoButton) {
        kakaoButton.addEventListener('click', async () => {
          kakaoButton.disabled = true;
          kakaoButton.setAttribute('aria-busy', 'true');
          setStatus('카카오톡 공유를 준비하고 있습니다.');

          try {
            const Kakao = await loadKakaoSdk();
            if (typeof Kakao.isInitialized === 'function' && !Kakao.isInitialized()) {
              Kakao.init(kakaoKey);
            }
            if (!Kakao.Share || typeof Kakao.Share.sendDefault !== 'function') {
              throw new Error('현재 Kakao SDK에서 공유 기능을 찾지 못했습니다.');
            }

            const link = { mobileWebUrl: shareUrl, webUrl: shareUrl };
            const content = {
              title: shareTitle,
              description: shareDescription,
              link,
            };
            if (shareImage) content.imageUrl = shareImage;

            Kakao.Share.sendDefault({
              objectType: 'feed',
              content,
              buttons: [{ title: '웹으로 보기', link }],
            });
            setStatus('카카오톡 공유 창을 열었습니다.');
          } catch (error) {
            console.error('[social-share] Kakao share failed:', error);
            const localHint = isProductionPage() ? '' : ' 로컬 테스트라면 현재 주소도 카카오 개발자 콘솔에 등록해야 합니다.';
            setStatus(`카카오톡 공유를 열지 못했습니다. 카카오 개발자 콘솔의 도메인 설정을 확인해 주세요.${localHint}`, true);
          } finally {
            kakaoButton.disabled = false;
            kakaoButton.removeAttribute('aria-busy');
          }
        });
      }

      if (shareButton) {
        shareButton.addEventListener('click', async () => {
          shareButton.disabled = true;
          shareButton.setAttribute('aria-busy', 'true');
          setStatus('공유를 준비하고 있습니다.');

          try {
            if (typeof navigator.share === 'function') {
              await navigator.share({ title: shareTitle, text: shareDescription, url: shareUrl });
              setStatus('공유 창을 열었습니다. 원하는 앱을 선택할 수 있습니다.');
              return;
            }

            await copyText(shareUrl);
            setStatus('공유 링크를 복사했습니다. 원하는 앱에 붙여넣을 수 있습니다.');
          } catch (error) {
            if (error && error.name === 'AbortError') return;

            try {
              const manualValue = window.prompt('공유할 링크를 복사하세요.', shareUrl);
              if (manualValue !== null) {
                setStatus('공유 링크를 표시했습니다. 원하는 앱에 붙여넣을 수 있습니다.');
              } else {
                setStatus('공유가 취소되었습니다.');
              }
            } catch (fallbackError) {
              console.error('[social-share] share fallback failed:', fallbackError);
              setStatus('공유 링크를 복사하지 못했습니다. 주소를 직접 복사해 주세요.', true);
            }
          } finally {
            shareButton.disabled = false;
            shareButton.removeAttribute('aria-busy');
          }
        });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
