/**
 * @typedef {"light" | "dark"} ThemeName
 */

/**
 * @param {Window | typeof globalThis} [target]
 * @returns {ThemeName}
 */
export function resolveInitialTheme(target = globalThis) {
  const prefersDark =
    typeof target.matchMedia === "function" &&
    target.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
}

/**
 * @param {ThemeName} current
 * @returns {ThemeName}
 */
export function toggleTheme(current) {
  return current === "dark" ? "light" : "dark";
}

/**
 * @param {ThemeName} theme
 * @param {Document} [doc]
 */
export function applyTheme(theme, doc = document) {
  doc.documentElement.dataset.theme = theme;
}

/**
 * @param {HTMLButtonElement} button
 * @param {ThemeName} theme
 */
function updateToggleButton(button, theme) {
  const isDark = theme === "dark";
  button.textContent = isDark ? "☾" : "☀";
  button.setAttribute("aria-pressed", isDark ? "true" : "false");
  button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  button.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
}

/**
 * @param {HTMLButtonElement} button
 * @param {{onThemeChange?: (theme: ThemeName) => void, doc?: Document, target?: Window | typeof globalThis}} [options]
 */
export function initThemeToggle(button, options = {}) {
  const doc = options.doc ?? document;
  const target = options.target ?? globalThis;
  const onThemeChange = options.onThemeChange ?? (() => {});

  let theme = resolveInitialTheme(target);
  let manuallyToggled = false;

  applyTheme(theme, doc);
  updateToggleButton(button, theme);
  onThemeChange(theme);

  button.addEventListener("click", () => {
    manuallyToggled = true;
    theme = toggleTheme(theme);
    applyTheme(theme, doc);
    updateToggleButton(button, theme);
    onThemeChange(theme);
  });

  if (typeof target.matchMedia === "function") {
    const query = target.matchMedia("(prefers-color-scheme: dark)");
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", (event) => {
        if (manuallyToggled) {
          return;
        }
        theme = event.matches ? "dark" : "light";
        applyTheme(theme, doc);
        updateToggleButton(button, theme);
        onThemeChange(theme);
      });
    }
  }
}

