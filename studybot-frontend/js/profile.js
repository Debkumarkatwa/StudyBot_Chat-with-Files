// profile.js

(async () => {
  if (!(await API.validateSession())) {
    window.location.replace("login.html");
    return;
  }

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

// ===== Profile dropdown (navbar) =====
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.classList.add("invalid");
    errorEl.textContent = message;
  } else {
    inputEl.classList.remove("invalid");
    errorEl.textContent = "";
  }
}
function showFormMessage(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}
function hideFormMessage(el) {
  el.classList.add("hidden");
  el.textContent = "";
}
function wirePasswordToggle(toggleBtnId, inputId) {
  const btn = document.getElementById(toggleBtnId);
  const input = document.getElementById(inputId);
  btn.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "🙈" : "👁";
    btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });
}
function checkPasswordStrength(password) {
  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passedCount = [hasLength, hasLetter, hasNumber].filter(Boolean).length;
  if (password.length === 0) return { level: "none", valid: false };
  if (passedCount <= 1) return { level: "weak", valid: false };
  if (passedCount === 2) return { level: "medium", valid: false };
  return { level: "strong", valid: hasLength && hasLetter && hasNumber };
}
function updateStrengthUI(password) {
  const barsWrapper = document.querySelector("#newPasswordStrength .strength-bars");
  const text = document.getElementById("newPasswordStrengthText");
  const { level, valid } = checkPasswordStrength(password);
  barsWrapper.classList.remove("weak", "medium", "strong");
  if (level !== "none") barsWrapper.classList.add(level);

  if (password.length === 0) {
    text.textContent = "Min 8 characters, at least 1 letter & 1 number";
  } else if (valid) {
    text.textContent = "Strong password ✓";
  } else if (level === "medium") {
    text.textContent = "Getting there — add a number or letter, and reach 8 characters";
  } else {
    text.textContent = "Too weak — needs 8+ characters, a letter, and a number";
  }
  return valid;
}

// =====================================================================
// PROFILE INFO — view / edit / save
// =====================================================================
const profileAvatar = document.getElementById("profileAvatar");
const profileNameInput = document.getElementById("profileName");
const profileNameError = document.getElementById("profileNameError");
const profileEmailInput = document.getElementById("profileEmail");
const editProfileBtn = document.getElementById("editProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const profileFeedback = document.getElementById("profileFeedback");

let originalName = "";

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showProfileFeedback(message, type = "success") {
  if (!profileFeedback) return;
  profileFeedback.textContent = message;
  profileFeedback.className = `inline-feedback ${type}`;
  profileFeedback.classList.remove("hidden");
}

function clearProfileFeedback() {
  if (!profileFeedback) return;
  profileFeedback.textContent = "";
  profileFeedback.className = "inline-feedback hidden";
}

async function loadProfile() {
  try {
    const user = await API.getCurrentUser();
    profileNameInput.value = user.name;
    profileEmailInput.value = user.email;
    profileAvatar.textContent = getInitials(user.name);
    originalName = user.name;
  } catch (err) {
    if (err?.message !== "No active session.") {
      console.error("Failed to load profile:", err);
    }
  }
}

function enterEditMode() {
  clearProfileFeedback();
  profileNameInput.disabled = false;
  profileNameInput.focus();
  editProfileBtn.classList.add("hidden");
  saveProfileBtn.classList.remove("hidden");
  cancelProfileBtn.classList.remove("hidden");
}

function exitEditMode() {
  profileNameInput.disabled = true;
  editProfileBtn.classList.remove("hidden");
  saveProfileBtn.classList.add("hidden");
  cancelProfileBtn.classList.add("hidden");
  setFieldError(profileNameInput, profileNameError, "");
}

editProfileBtn.addEventListener("click", enterEditMode);

cancelProfileBtn.addEventListener("click", () => {
  profileNameInput.value = originalName;
  profileAvatar.textContent = getInitials(originalName);
  exitEditMode();
});

saveProfileBtn.addEventListener("click", async () => {
  const name = profileNameInput.value.trim();
  if (name.length < 3 || name.length > 15) {
    setFieldError(profileNameInput, profileNameError, "Name must be 3–15 characters");
    return;
  }
  setFieldError(profileNameInput, profileNameError, "");

  try {
    await API.updateProfileName(name);
    originalName = name;
    profileAvatar.textContent = getInitials(name);
    showProfileFeedback("Your name was updated.", "success");
    exitEditMode();
  } catch (err) {
    console.error("Failed to update name:", err);
    showProfileFeedback("Couldn't save your name. Please try again.", "error");
  }
});

// =====================================================================
// ACCOUNT STATS
// =====================================================================
async function loadStats() {
  try {
    const [activeDocs, binDocs] = await Promise.all([
      API.getActiveDocuments(),
      API.getBinDocuments(),
    ]);
    document.getElementById("statDocCount").textContent = activeDocs.length;
    document.getElementById("statBinCount").textContent = binDocs.length;
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

// =====================================================================
// CHANGE PASSWORD
// =====================================================================
wirePasswordToggle("toggleCurrentPassword", "currentPassword");
wirePasswordToggle("toggleNewPassword", "newPassword");
wirePasswordToggle("toggleConfirmNewPassword", "confirmNewPassword");

const changePasswordForm = document.getElementById("changePasswordForm");
const currentPasswordInput = document.getElementById("currentPassword");
const currentPasswordError = document.getElementById("currentPasswordError");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const confirmNewPasswordError = document.getElementById("confirmNewPasswordError");
const passwordChangeError = document.getElementById("passwordChangeError");
const passwordChangeSuccess = document.getElementById("passwordChangeSuccess");
const changePasswordBtn = document.getElementById("changePasswordBtn");

newPasswordInput.addEventListener("input", () => {
  updateStrengthUI(newPasswordInput.value);
  if (confirmNewPasswordInput.value) validateConfirmMatch();
});

function validateConfirmMatch() {
  if (confirmNewPasswordInput.value && confirmNewPasswordInput.value !== newPasswordInput.value) {
    setFieldError(confirmNewPasswordInput, confirmNewPasswordError, "Passwords don't match");
    return false;
  }
  setFieldError(confirmNewPasswordInput, confirmNewPasswordError, "");
  return true;
}
confirmNewPasswordInput.addEventListener("input", validateConfirmMatch);

changePasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormMessage(passwordChangeError);
  passwordChangeSuccess.classList.add("hidden");

  let isValid = true;

  if (!currentPasswordInput.value) {
    setFieldError(currentPasswordInput, currentPasswordError, "Enter your current password");
    isValid = false;
  } else {
    setFieldError(currentPasswordInput, currentPasswordError, "");
  }

  const strengthValid = updateStrengthUI(newPasswordInput.value);
  if (!strengthValid) isValid = false;

  if (!validateConfirmMatch() || !confirmNewPasswordInput.value) {
    setFieldError(confirmNewPasswordInput, confirmNewPasswordError, "Passwords don't match");
    isValid = false;
  }

  if (!isValid) return;

  changePasswordBtn.disabled = true;
  changePasswordBtn.textContent = "Updating...";

  try {
    await API.changePassword(currentPasswordInput.value, newPasswordInput.value);
    passwordChangeSuccess.classList.remove("hidden");
    showProfileFeedback("Your password was updated.", "success");
    changePasswordForm.reset();
    document.querySelector("#newPasswordStrength .strength-bars").classList.remove("weak", "medium", "strong");
  } catch (err) {
    showFormMessage(passwordChangeError, err.message || "Something went wrong. Please try again.");
    showProfileFeedback(err.message || "Couldn't update your password.", "error");
  } finally {
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = "Update Password";
  }
});

// =====================================================================
// DELETE ACCOUNT (danger zone)
// =====================================================================
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteConfirmPasswordInput = document.getElementById("deleteConfirmPassword");
const deleteConfirmPasswordError = document.getElementById("deleteConfirmPasswordError");

deleteAccountBtn.addEventListener("click", () => {
  deleteModalOverlay.classList.remove("hidden");
  deleteConfirmInput.value = "";
  deleteConfirmPasswordInput.value = "";
  setFieldError(deleteConfirmPasswordInput, deleteConfirmPasswordError, "");
  confirmDeleteBtn.disabled = true;
  deleteConfirmPasswordInput.focus();
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteModalOverlay.classList.add("hidden");
});

deleteModalOverlay.addEventListener("click", (e) => {
  if (e.target === deleteModalOverlay) deleteModalOverlay.classList.add("hidden");
});

function updateDeleteButtonState() {
  confirmDeleteBtn.disabled = deleteConfirmInput.value !== "DELETE" || !deleteConfirmPasswordInput.value;
}
deleteConfirmInput.addEventListener("input", updateDeleteButtonState);
deleteConfirmPasswordInput.addEventListener("input", () => {
  if (deleteConfirmPasswordError.textContent) {
    setFieldError(deleteConfirmPasswordInput, deleteConfirmPasswordError, "");
  }
  updateDeleteButtonState();
});

confirmDeleteBtn.addEventListener("click", async () => {
  setFieldError(deleteConfirmPasswordInput, deleteConfirmPasswordError, "");
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";
  try {
    await API.deleteAccount(deleteConfirmPasswordInput.value);
    showProfileFeedback("Your account was deleted.", "success");
    setTimeout(() => {
      window.location.href = "landing.html";
    }, 900);
  } catch (err) {
    console.error("Failed to delete account:", err);
    if (err.message?.toLowerCase().includes("password")) {
      setFieldError(deleteConfirmPasswordInput, deleteConfirmPasswordError, err.message);
    } else {
      showProfileFeedback("Something went wrong while deleting your account.", "error");
    }
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete Account";
  }
});

// ===== Init =====
loadProfile();
loadStats();
})();
