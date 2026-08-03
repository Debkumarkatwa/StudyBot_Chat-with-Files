// settings.js

if (!API.isAuthenticated()) {
  window.location.replace("login.html");
} else {

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
document.getElementById("openSidebar").addEventListener("click", () => {
  appSidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
});
function closeSidebar() {
  appSidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}
document.getElementById("closeSidebar").addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// ===== Profile dropdown =====
const profileIconBtn = document.getElementById("profileIconBtn");
const profileDropdown = document.getElementById("profileDropdown");
profileIconBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle("hidden");
});
document.addEventListener("click", () => profileDropdown.classList.add("hidden"));

function handleLogout() {
  API.logout().finally(() => {
    window.location.href = "landing.html";
  });
}
document.getElementById("logoutBtn").addEventListener("click", handleLogout);
document.getElementById("sidebarLogoutBtn").addEventListener("click", handleLogout);

// =====================================================================
// APPEARANCE — theme segmented control
// Syncs with the same localStorage key theme.js already uses,
// so this control and the navbar 🌙/☀️ icon never disagree.
// =====================================================================
const themeOptionDark = document.getElementById("themeOptionDark");
const themeOptionLight = document.getElementById("themeOptionLight");

function syncThemeButtons() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  themeOptionDark.classList.toggle("active", current === "dark");
  themeOptionLight.classList.toggle("active", current === "light");
}

window.addEventListener("studybot:themechange", syncThemeButtons);

themeOptionDark.addEventListener("click", () => {
  if (getCurrentTheme() !== "dark") toggleTheme();
  syncThemeButtons();
});
themeOptionLight.addEventListener("click", () => {
  if (getCurrentTheme() !== "light") toggleTheme();
  syncThemeButtons();
});

syncThemeButtons();

// =====================================================================
// CHAT DEFAULTS — Hybrid Mode default
// Stored directly in localStorage (simple user preference, not account
// data) — chat.js reads "studybot-hybrid-default" on page load.
// =====================================================================
const hybridDefaultToggle = document.getElementById("hybridDefaultToggle");

hybridDefaultToggle.checked = localStorage.getItem("studybot-hybrid-default") === "true";

hybridDefaultToggle.addEventListener("change", () => {
  localStorage.setItem("studybot-hybrid-default", String(hybridDefaultToggle.checked));
});
}
