

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("div.highlight").forEach((block) => {
    if (block.querySelector(":scope > .code-header")) return;

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <button class="copy-btn" type="button" aria-label="코드 복사" title="코드 복사" onclick="copyCode(this)">
        <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
             viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    `;

    // 🔍 언어 라벨 파싱 함수
    function getLanguageLabel(className) {
    const match = className.match(/language-([\w#+-]+)/); // 확장된 정규식
    if (!match) return "TEXT";

    const lang = match[1].toLowerCase();
    const aliases = {
        "c++": "CPP",
        "c#": "C#",
        "js": "JavaScript",
        "ts": "TypeScript",
        "py": "Python",
        "rb": "Ruby",
        "plaintext": "TEXT",
        "text": "TEXT"
    };

    return (aliases[lang] || lang).toUpperCase();
    }

    const langNode = block.closest("[class*='language-']") || block.querySelector("pre code");
    const codeClass = langNode?.className || "";
    const lang = getLanguageLabel(codeClass);

    const langTag = document.createElement("span");
    langTag.className = "lang-label";
    langTag.textContent = lang;
    header.appendChild(langTag);

    block.insertBefore(header, block.firstChild);
    
  });
});

async function copyCode(button) {
  const block = button.closest('.highlight');
  const codeElement = block.querySelector('pre code');
  if (!codeElement) return;
  const codeCells = codeElement.querySelectorAll('td.rouge-code');
  const text = codeCells.length
    ? Array.from(codeCells, cell => cell.textContent).join('')
    : codeElement.textContent;
  const originalIcon = button.innerHTML;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = '복사됨';
    button.setAttribute('aria-label', '코드 복사 완료');
    button.title = '코드 복사 완료';
  } catch (_) {
    button.textContent = '실패';
    button.setAttribute('aria-label', '복사 실패. 코드를 선택해서 직접 복사해 주세요.');
    button.title = '코드를 선택해서 직접 복사해 주세요.';
  }
  window.setTimeout(() => {
    button.innerHTML = originalIcon;
    button.setAttribute('aria-label', '코드 복사');
    button.title = '코드 복사';
  }, 1800);
}
