/* assets/js/custom/dark-theme.js 
const defaultTheme = [...document.styleSheets].find(style => /(main.css)$/.test(style.href));
const darkTheme = [...document.styleSheets].find(style => /(main_dark.css)$/.test(style.href));

let setDarkMode = (isDark) => {
    darkTheme.disabled = isDark !== true;
    defaultTheme.disabled = isDark === true;
    
    if (window['customUtterances']) {
        const customUtterances = window['customUtterances'];
        customUtterances.onChange(isDark ? customUtterances.darkTheme : customUtterances.theme);
    }

    localStorage.setItem('theme', isDark ? 'dark' : 'default');
}

if (darkTheme) {
    let currentTheme = localStorage.getItem('theme');
    let isDarkMode = false;
    if (currentTheme) {
        isDarkMode = currentTheme === 'dark';
    } else {
        isDarkMode = matchMedia('(prefers-color-scheme: dark)').matches;
    }

    setDarkMode(isDarkMode);

    let toggleThemeBtn = document.getElementById("toggle_dark_theme")
    if (toggleThemeBtn) {
        toggleThemeBtn.checked = isDarkMode
    }

    let changeTheme = (e) => {
        setDarkMode(e.target.checked);
    }

    toggleThemeBtn.addEventListener('click', changeTheme)
}*/



// assets/js/custom/dark-theme.js
document.addEventListener("DOMContentLoaded", () => {
    const setDarkMode = (isDark) => {
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  
      if (window['customUtterances']) {
        const customUtterances = window['customUtterances'];
        customUtterances.onChange(isDark ? customUtterances.darkTheme : customUtterances.theme);
      }
  
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };
  
    const toggleThemeBtn = document.getElementById("toggle_dark_theme");
    if (!toggleThemeBtn) return;
  
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme
      ? savedTheme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
  
    toggleThemeBtn.checked = isDark;
    setDarkMode(isDark);
  
    toggleThemeBtn.addEventListener("change", (e) => {
      setDarkMode(e.target.checked);
    });
  });
  