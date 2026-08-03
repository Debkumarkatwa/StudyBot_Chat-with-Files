// theme.js
// Theme was already set pre-paint by the inline script in <head>.
// This file just wires up the toggle button(s) and syncs the icon.

function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("studybot-theme", theme);
  updateToggleIcons(theme);
  window.dispatchEvent(new CustomEvent("studybot:themechange", { detail: { theme } }));
}

function updateToggleIcons(theme) {
  const icon = theme === "light" ? "☀️" : "🌙";
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.textContent = icon;
    btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  });
}

function toggleTheme() {
  const next = getCurrentTheme() === "light" ? "dark" : "light";
  applyTheme(next);
}

// Wire up both toggle buttons (logged-out nav + logged-in nav)
document.getElementById("themeToggle")?.setAttribute("data-theme-toggle", "");
document.getElementById("themeToggleLoggedIn")?.setAttribute("data-theme-toggle", "");

document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
  btn.addEventListener("click", toggleTheme);
});

// Sync icon to whatever theme the inline script already applied
updateToggleIcons(getCurrentTheme());
