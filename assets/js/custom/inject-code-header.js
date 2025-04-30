console.log("Code header script loaded");

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("div.highlight").forEach((block) => {
    if (block.querySelector(":scope > .code-header")) return;

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <button class="copy-btn" onclick="copyCode(this)">
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

function copyCode(button) {
    const block = button.closest('.highlight');
    const codeElement = block.querySelector('pre code');
    let copiedText = '';
  
    // 📦 줄 번호 테이블 구조일 경우
    const table = codeElement.querySelector('table');
    if (table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) {
          // 📌 줄 번호(td[0]) + 코드 본문(td[1])
          copiedText += cells[1].innerText + '\n';
        } else if (cells.length === 1) {
          // 혹시 줄 번호 없는 구조면 그냥 그거 복사
          copiedText += cells[0].innerText + '\n';
        }
      });
    } else {
      // 👌 줄 번호 테이블 없으면 전체 복사
      copiedText = codeElement.innerText;
    }
  
    navigator.clipboard.writeText(copiedText.trim()).then(() => {
      // ✅ 체크 아이콘 전환
      button.innerHTML = `
        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
             viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>`;
      setTimeout(() => {
        button.innerHTML = `
          <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
               viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>`;
      }, 1500);
    });
  }
  
