// landing.js

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

function setLoggedIn(isLoggedIn) {
  navLoggedOut.classList.toggle("hidden", isLoggedIn);
  navLoggedIn.classList.toggle("hidden", !isLoggedIn);
}

setLoggedIn(API.isAuthenticated());
window.addEventListener("studybot:authchange", () => {
  setLoggedIn(API.isAuthenticated());
});
