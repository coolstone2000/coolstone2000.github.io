// assets/js/custom/dark-theme.js

console.log(
  "===== NEW DARK THEME JS LOADED : DEBUG VERSION 2026-08-10 ====="
);

(() => {
  /* =========================================================
     일반 Markdown 표 가로 스크롤
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
     * Rouge 코드블럭 내부 table은 전부 제외함.
     */
    const tables = allTables.filter(
      (table) => {
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
         * 코드블럭 내부에 있는 table 제외
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
      }
    );


    /*
     * 일반 Markdown 표에만
     * 가로 스크롤 적용
     */
    tables.forEach((table) => {
      table.style.setProperty(
        "display",
        "block",
        "important"
      );

      table.style.setProperty(
        "width",
        "100%",
        "important"
      );

      table.style.setProperty(
        "max-width",
        "100%",
        "important"
      );

      table.style.setProperty(
        "overflow-x",
        "auto",
        "important"
      );

      table.style.setProperty(
        "overflow-y",
        "hidden",
        "important"
      );

      table.style.setProperty(
        "-webkit-overflow-scrolling",
        "touch"
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


    console.log(
      "[rouge] 발견된 rouge-table:",
      rougeTables.length
    );


    rougeTables.forEach(
      (table, index) => {
        /*
         * 기존에 잘못 들어갔을 가능성이 있는
         * inline style 제거
         */
        table.style.removeProperty(
          "display"
        );

        table.style.removeProperty(
          "width"
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
         * 일반 Markdown table 스타일 제거
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


        console.log(
          `[rouge] table ${index} 복구 완료`
        );
      }
    );


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
      "[rouge] gutter/code cell 복구:",
      rougeCells.length
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


    /*
     * Rouge table이 없으면
     * 수정할 것도 없음.
     */
    if (tables.length === 0) {
      return false;
    }


    const brokenTable =
      tables.find((table) => {
        const style =
          getComputedStyle(table);


        const broken =
          style.display !== "table" ||

          style.backgroundColor !==
            "rgb(23, 23, 23)" ||

          style.borderTopWidth !==
            "0px" ||

          style.borderRadius !==
            "0px" ||

          style.boxShadow !==
            "none";


        if (broken) {
          console.warn(
            "[rouge] 잘못된 Rouge table 발견",
            {
              element: table,

              display:
                style.display,

              background:
                style.backgroundColor,

              border:
                style.border,

              radius:
                style.borderRadius,

              shadow:
                style.boxShadow,

              inlineStyle:
                table.getAttribute(
                  "style"
                )
            }
          );
        }


        return broken;
      });


    return !!brokenTable;
  };


  /* =========================================================
     중복 requestAnimationFrame 방지
     ========================================================= */

  let rougeFixScheduled =
    false;


  const scheduleRougeFix = () => {
    if (rougeFixScheduled) {
      return;
    }


    rougeFixScheduled =
      true;


    window.requestAnimationFrame(
      () => {
        rougeFixScheduled =
          false;


        /*
         * 상태가 잘못됐을 때만
         * 실제 fix 실행
         */
        if (needsRougeFix()) {
          console.log(
            "===== ROUGE FIX SCHEDULED ====="
          );

          fixRouge();
        }
      }
    );
  };


  /* =========================================================
     Rouge MutationObserver
     ========================================================= */

  const startRougeProtection = () => {
    console.log(
      "===== ROUGE PROTECTION START ====="
    );


    /*
     * 최초 한 번 강제 복구
     */
    fixRouge();


    /*
     * 페이지 내용 감시
     */
    const content =
      document.querySelector(
        ".page__content"
      );


    if (!content) {
      console.warn(
        "[rouge] .page__content를 찾지 못함"
      );
    }


    if (content) {
      const observer =
        new MutationObserver(
          (mutations) => {
            /*
             * 어떤 변경이 발생했는지
             * 디버깅용 로그
             */
            const relevantMutations =
              mutations.filter(
                (mutation) => {
                  const target =
                    mutation.target;


                  if (
                    !(target instanceof Element)
                  ) {
                    return false;
                  }


                  return !!(
                    target.matches?.(
                      "table.rouge-table"
                    ) ||

                    target.matches?.(
                      "td.rouge-gutter"
                    ) ||

                    target.matches?.(
                      "td.rouge-code"
                    ) ||

                    target.closest?.(
                      "table.rouge-table"
                    )
                  );
                }
              );


            if (
              relevantMutations.length > 0
            ) {
              console.log(
                "===== ROUGE MUTATION DETECTED =====",
                relevantMutations.length
              );
            }


            scheduleRougeFix();
          }
        );


      observer.observe(
        content,
        {
          /*
           * 동적으로 코드블럭 생성되는 경우
           */
          childList: true,

          /*
           * 하위 요소까지 전부 감시
           */
          subtree: true,

          /*
           * style 변경 감시
           */
          attributes: true,

          attributeFilter: [
            "style"
          ]
        }
      );


      /*
       * 콘솔에서 Observer 존재 여부
       * 확인할 수 있게 전역으로 보관
       */
      window.__rougeObserver =
        observer;


      console.log(
        "[rouge] content MutationObserver 등록 완료"
      );
    }


    /* =======================================================
       Dark / Light Theme 변경 감시
       ======================================================= */

    const themeObserver =
      new MutationObserver(
        (mutations) => {
          console.log(
            "===== THEME MUTATION DETECTED =====",
            mutations.length
          );


          /*
           * Theme CSS가 적용된 뒤
           * 한 프레임 뒤에 검사
           */
          scheduleRougeFix();
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
      "[rouge] theme MutationObserver 등록 완료"
    );

    console.log(
      "[dark-theme] Rouge protection enabled"
    );
  };


  /* =========================================================
     Theme 변경
     ========================================================= */

  const setDarkMode = (isDark) => {
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
     * Rouge 보호 시작
     */
    startRougeProtection();


    /* =======================================================
       Theme toggle
       ======================================================= */

    const toggleThemeBtn =
      document.getElementById(
        "toggle_dark_theme"
      );


    if (!toggleThemeBtn) {
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
       Theme 결정
       ======================================================= */

    const isDark =
      savedTheme
        ? savedTheme === "dark"

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


    /* =======================================================
       Toggle 상태
       ======================================================= */

    toggleThemeBtn.checked =
      isDark;


    /* =======================================================
       Theme 적용
       ======================================================= */

    setDarkMode(
      isDark
    );


    /* =======================================================
       Theme 변경 이벤트
       ======================================================= */

    toggleThemeBtn.addEventListener(
      "change",
      (event) => {
        console.log(
          "===== THEME TOGGLE CHANGE ====="
        );


        setDarkMode(
          event.target.checked
        );
      }
    );


    console.log(
      "[dark-theme] toggle event 등록 완료"
    );
  };


  /* =========================================================
     DOMContentLoaded
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    console.log(
      "[dark-theme] DOMContentLoaded 대기"
    );


    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

  } else {
    console.log(
      "[dark-theme] DOM 이미 로딩 완료"
    );


    initialize();
  }


  /* =========================================================
     window.load

     모든 이미지/스크립트/리소스 로딩 후
     마지막으로 한 번 더 검사함.
     ========================================================= */

  window.addEventListener(
    "load",
    () => {
      console.log(
        "===== WINDOW LOAD FINAL CHECK ====="
      );


      applyTableScroll();


      /*
       * 여기서는 검사만 하지 않고
       * 한 번 강제로 복구함.
       *
       * 콘솔에서 직접 실행할 때
       * 정상화됐던 상황과 최대한 동일하게 함.
       */
      fixRouge();


      /*
       * 혹시 그 이후 또 변경되는 경우는
       * MutationObserver가 처리함.
       */
      scheduleRougeFix();
    },
    {
      once: true
    }
  );


  /* =========================================================
     전역 디버그 함수

     콘솔에서 아래 명령 사용 가능:

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