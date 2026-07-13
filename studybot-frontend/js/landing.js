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
  // TODO: call API.logout() once backend exists, then clear session/token
  setLoggedIn(false);
});

// ===== Auth state (real logic plugs in here later) =====
const navLoggedOut = document.getElementById("navLoggedOut");
const navLoggedIn = document.getElementById("navLoggedIn");

function setLoggedIn(isLoggedIn) {
  navLoggedOut.classList.toggle("hidden", isLoggedIn);
  navLoggedIn.classList.toggle("hidden", !isLoggedIn);
}

// ===== DEV-ONLY toggle — delete this block once real auth exists =====
let devLoggedIn = false;
document.getElementById("devAuthToggle").addEventListener("click", () => {
  devLoggedIn = !devLoggedIn;
  setLoggedIn(devLoggedIn);
});
