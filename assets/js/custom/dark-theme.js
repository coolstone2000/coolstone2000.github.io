// assets/js/custom/dark-theme.js

console.log(
  "===== DARK THEME JS LOADED : FINAL TABLE WRAPPER VERSION ====="
);

(() => {
  /* =========================================================
     일반 Markdown 표 처리
     ========================================================= */

  const applyTableScroll = () => {
    console.log(
      "===== APPLY TABLE SCROLL CALLED ====="
    );

    const allTables = Array.from(
      document.querySelectorAll(
        ".page__content table"
      )
    );


    /*
     * 일반 Markdown 표만 선택
     *
     * Rouge 코드블럭 내부 table은 제외
     */
    const tables = allTables.filter((table) => {
      /*
       * Rouge line-number table 제외
       */
      if (
        table.classList.contains(
          "rouge-table"
        )
      ) {
        return false;
      }


      /*
       * 코드블럭 내부 table 제외
       */
      if (
        table.closest(".highlight") ||
        table.closest(
          ".highlighter-rouge"
        ) ||
        table.closest("pre") ||
        table.closest("code")
      ) {
        return false;
      }


      return true;
    });


    /*
     * 일반 Markdown 표 처리
     */
    tables.forEach((table) => {
      /*
       * 일반 Markdown 표 전용 클래스
       */
      table.classList.add(
        "markdown-table"
      );


      /*
       * 예전 dark-theme.js에서
       * table에 직접 넣었던 inline style 제거
       */
      table.style.removeProperty(
        "display"
      );

      table.style.removeProperty(
        "width"
      );

      table.style.removeProperty(
        "min-width"
      );

      table.style.removeProperty(
        "max-width"
      );

      table.style.removeProperty(
        "overflow"
      );

      table.style.removeProperty(
        "overflow-x"
      );

      table.style.removeProperty(
        "overflow-y"
      );

      table.style.removeProperty(
        "margin"
      );

      table.style.removeProperty(
        "margin-left"
      );

      table.style.removeProperty(
        "margin-right"
      );

      table.style.removeProperty(
        "-webkit-overflow-scrolling"
      );


      /*
       * 이미 wrapper가 존재하면
       * 중복으로 감싸지 않음
       */
      if (
        table.parentElement?.classList.contains(
          "markdown-table-wrapper"
        )
      ) {
        return;
      }


      /*
       * 가로 스크롤용 wrapper 생성
       */
      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        "markdown-table-wrapper";


      /*
       * 기존 table 위치에 wrapper 삽입
       */
      table.parentNode.insertBefore(
        wrapper,
        table
      );


      /*
       * table을 wrapper 내부로 이동
       */
      wrapper.appendChild(
        table
      );
    });


    console.log(
      "[dark-theme] 전체 table:",
      allTables.length
    );

    console.log(
      "[dark-theme] 일반 Markdown table:",
      tables.length
    );

    console.log(
      "[dark-theme] 제외된 table:",
      allTables.length - tables.length
    );

    console.log(
      "[dark-theme] wrapper:",
      document.querySelectorAll(
        ".markdown-table-wrapper"
      ).length
    );
  };


  /* =========================================================
     Rouge 코드블럭 강제 정상화
     ========================================================= */

  const fixRouge = () => {
    console.log(
      "===== FIX ROUGE CALLED ====="
    );


    const rougeTables =
      document.querySelectorAll(
        "table.rouge-table"
      );


    rougeTables.forEach((table) => {
      /*
       * 혹시 일반 Markdown 표 클래스가
       * 잘못 붙어 있으면 제거
       */
      table.classList.remove(
        "markdown-table"
      );


      /*
       * 일반 Markdown table 처리 과정에서
       * 들어갔을 가능성이 있는 inline style 제거
       */
      table.style.removeProperty(
        "display"
      );

      table.style.removeProperty(
        "width"
      );

      table.style.removeProperty(
        "min-width"
      );

      table.style.removeProperty(
        "max-width"
      );

      table.style.removeProperty(
        "overflow"
      );

      table.style.removeProperty(
        "overflow-x"
      );

      table.style.removeProperty(
        "overflow-y"
      );

      table.style.removeProperty(
        "margin"
      );

      table.style.removeProperty(
        "margin-left"
      );

      table.style.removeProperty(
        "margin-right"
      );

      table.style.removeProperty(
        "-webkit-overflow-scrolling"
      );


      /*
       * Rouge table 정상 레이아웃
       */
      table.style.setProperty(
        "display",
        "table",
        "important"
      );

      table.style.setProperty(
        "width",
        "100%",
        "important"
      );

      table.style.setProperty(
        "max-width",
        "none",
        "important"
      );

      table.style.setProperty(
        "margin",
        "0",
        "important"
      );


      /*
       * 코드블럭 배경
       */
      table.style.setProperty(
        "background",
        "#171717",
        "important"
      );

      table.style.setProperty(
        "background-color",
        "#171717",
        "important"
      );


      /*
       * 일반 Markdown table 디자인 제거
       */
      table.style.setProperty(
        "border",
        "0",
        "important"
      );

      table.style.setProperty(
        "border-radius",
        "0",
        "important"
      );

      table.style.setProperty(
        "box-shadow",
        "none",
        "important"
      );

      table.style.setProperty(
        "overflow",
        "visible",
        "important"
      );
    });


    /* =======================================================
       Rouge gutter / code 영역
       ======================================================= */

    const rougeCells =
      document.querySelectorAll(
        [
          "table.rouge-table td.rouge-gutter",
          "table.rouge-table td.rouge-code"
        ].join(", ")
      );


    rougeCells.forEach((cell) => {
      cell.style.setProperty(
        "background",
        "#171717",
        "important"
      );

      cell.style.setProperty(
        "background-color",
        "#171717",
        "important"
      );

      cell.style.setProperty(
        "border",
        "0",
        "important"
      );

      cell.style.setProperty(
        "border-radius",
        "0",
        "important"
      );

      cell.style.setProperty(
        "box-shadow",
        "none",
        "important"
      );
    });


    console.log(
      "[rouge] 복구 완료:",
      rougeTables.length
    );
  };


  /* =========================================================
     Rouge 상태 검사
     ========================================================= */

  const needsRougeFix = () => {
    const tables = Array.from(
      document.querySelectorAll(
        "table.rouge-table"
      )
    );


    if (
      tables.length === 0
    ) {
      return false;
    }


    const brokenTable =
      tables.find((table) => {
        const style =
          getComputedStyle(
            table
          );


        return (
          style.display !==
            "table" ||

          style.backgroundColor !==
            "rgb(23, 23, 23)" ||

          style.borderTopWidth !==
            "0px" ||

          style.borderRadius !==
            "0px" ||

          style.boxShadow !==
            "none"
        );
      });


    return !!brokenTable;
  };


  /* =========================================================
     requestAnimationFrame 중복 방지
     ========================================================= */

  let rougeFixScheduled =
    false;


  const scheduleRougeFix = () => {
    if (
      rougeFixScheduled
    ) {
      return;
    }


    rougeFixScheduled =
      true;


    window.requestAnimationFrame(
      () => {
        rougeFixScheduled =
          false;


        if (
          needsRougeFix()
        ) {
          fixRouge();
        }
      }
    );
  };


  /* =========================================================
     본문 변경 감시
     ========================================================= */

  const startContentProtection = () => {
    /*
     * 최초 Rouge 복구
     */
    fixRouge();


    const content =
      document.querySelector(
        ".page__content"
      );


    if (
      !content
    ) {
      console.warn(
        "[dark-theme] .page__content를 찾지 못함"
      );

      return;
    }


    /*
     * 본문에 동적으로 표가 추가되는 경우 대응
     */
    const observer =
      new MutationObserver(
        () => {
          applyTableScroll();

          scheduleRougeFix();
        }
      );


    observer.observe(
      content,
      {
        childList: true,
        subtree: true
      }
    );


    window.__contentObserver =
      observer;


    /* =======================================================
       Dark / Light Theme 변경 감시
       ======================================================= */

    const themeObserver =
      new MutationObserver(
        () => {
          window.requestAnimationFrame(
            () => {
              applyTableScroll();

              scheduleRougeFix();
            }
          );
        }
      );


    themeObserver.observe(
      document.documentElement,
      {
        attributes: true,

        attributeFilter: [
          "data-theme"
        ]
      }
    );


    window.__rougeThemeObserver =
      themeObserver;


    console.log(
      "[dark-theme] content protection enabled"
    );
  };


  /* =========================================================
     Theme 변경
     ========================================================= */

  const setDarkMode = (
    isDark
  ) => {
    console.log(
      "[dark-theme] setDarkMode:",
      isDark
        ? "dark"
        : "light"
    );


    /* =======================================================
       Theme attribute
       ======================================================= */

    document.documentElement.setAttribute(
      "data-theme",
      isDark
        ? "dark"
        : "light"
    );


    /* =======================================================
       Utterances
       ======================================================= */

    if (
      window.customUtterances
    ) {
      const customUtterances =
        window.customUtterances;


      customUtterances.onChange(
        isDark
          ? customUtterances.darkTheme
          : customUtterances.theme
      );
    }


    /* =======================================================
       Theme 저장
       ======================================================= */

    localStorage.setItem(
      "theme",
      isDark
        ? "dark"
        : "light"
    );


    /* =======================================================
       Theme 변경 후 표 재처리
       ======================================================= */

    window.requestAnimationFrame(
      () => {
        applyTableScroll();

        scheduleRougeFix();
      }
    );
  };


  /* =========================================================
     초기화
     ========================================================= */

  const initialize = () => {
    console.log(
      "===== DARK THEME INITIALIZE ====="
    );


    /*
     * 일반 Markdown 표 처리
     */
    applyTableScroll();


    /*
     * Rouge + 동적 콘텐츠 보호
     */
    startContentProtection();


    /* =======================================================
       Theme toggle
       ======================================================= */

    const toggleThemeBtn =
      document.getElementById(
        "toggle_dark_theme"
      );


    if (
      !toggleThemeBtn
    ) {
      console.warn(
        "[dark-theme] toggle_dark_theme 없음"
      );

      return;
    }


    /* =======================================================
       저장된 Theme
       ======================================================= */

    const savedTheme =
      localStorage.getItem(
        "theme"
      );


    /* =======================================================
       초기 Theme 결정
       ======================================================= */

    const isDark =
      savedTheme

        ? savedTheme ===
          "dark"

        : window
            .matchMedia(
              "(prefers-color-scheme: dark)"
            )
            .matches;


    console.log(
      "[dark-theme] savedTheme:",
      savedTheme
    );

    console.log(
      "[dark-theme] initial theme:",
      isDark
        ? "dark"
        : "light"
    );


    /*
     * Toggle 상태
     */
    toggleThemeBtn.checked =
      isDark;


    /*
     * Theme 적용
     */
    setDarkMode(
      isDark
    );


    /*
     * Toggle 이벤트
     */
    toggleThemeBtn.addEventListener(
      "change",
      (event) => {
        setDarkMode(
          event.target.checked
        );
      }
    );


    console.log(
      "[dark-theme] initialize 완료"
    );
  };


  /* =========================================================
     DOMContentLoaded
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }


  /* =========================================================
     window.load

     이미지 / 스크립트 등
     모든 리소스 로딩 후 최종 검사
     ========================================================= */

  window.addEventListener(
    "load",
    () => {
      console.log(
        "===== WINDOW LOAD FINAL CHECK ====="
      );


      applyTableScroll();

      fixRouge();

      scheduleRougeFix();
    },
    {
      once: true
    }
  );


  /* =========================================================
     디버깅용 전역 함수

     Console:

     window.__fixRouge()
     window.__checkRouge()
     window.__applyTableScroll()
     ========================================================= */

  window.__fixRouge =
    fixRouge;

  window.__checkRouge =
    needsRougeFix;

  window.__applyTableScroll =
    applyTableScroll;


  console.log(
    "[dark-theme] DEBUG helpers registered"
  );
})();