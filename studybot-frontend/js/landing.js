// landing.js

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");

function closeSidebar() {
  appSidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("visible");
}

openSidebarBtn?.addEventListener("click", () => {
  appSidebar?.classList.add("open");
  sidebarOverlay?.classList.add("visible");
});

closeSidebarBtn?.addEventListener("click", closeSidebar);
sidebarOverlay?.addEventListener("click", closeSidebar);

sidebarLogoutBtn?.addEventListener("click", () => {
  API.logout().finally(() => {
    setLoggedIn(false);
    closeSidebar();
  });
});

// ===== Profile dropdown =====
const profileIconBtn = document.getElementById("profileIconBtn");
const profileDropdown = document.getElementById("profileDropdown");

profileIconBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  profileDropdown?.classList.add("hidden");
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  API.logout().finally(() => {
    setLoggedIn(false);
  });
});

// ===== Auth state (real logic plugs in here later) =====
const navLoggedOut = document.getElementById("navLoggedOut");
const navLoggedIn = document.getElementById("navLoggedIn");
const heroCtaBtn = document.getElementById("heroCtaBtn");

function setLoggedIn(isLoggedIn) {
  navLoggedOut.classList.toggle("hidden", isLoggedIn);
  navLoggedIn.classList.toggle("hidden", !isLoggedIn);
  heroCtaBtn?.classList.toggle("is-disabled", isLoggedIn);
  heroCtaBtn?.setAttribute("aria-disabled", isLoggedIn ? "true" : "false");
  if (heroCtaBtn) {
    heroCtaBtn.tabIndex = isLoggedIn ? -1 : 0;
  }
}

(async function initLandingAuth() {
  const isLoggedIn = await API.validateSession();
  setLoggedIn(isLoggedIn);
})();

window.addEventListener("studybot:authchange", (e) => {
  setLoggedIn(e.detail.authenticated);
});
