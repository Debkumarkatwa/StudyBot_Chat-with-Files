// auth.js
// Real client-side validation. The actual signup/login action is mocked via API.*
// until the Python backend exists — see api.js.

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

function showFormMessage(el, message, type = "error") {
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideFormMessage(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

function setButtonLoading(btn, isLoading, loadingText, defaultText) {
  btn.disabled = isLoading;
  btn.textContent = isLoading ? loadingText : defaultText;
}

// ===== Password show/hide toggle (shared helper) =====
function wirePasswordToggle(toggleBtnId, inputId) {
  const btn = document.getElementById(toggleBtnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "🙈" : "👁";
    btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });
}

// ===== Password strength check =====
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
  const barsWrapper = document.querySelector("#passwordStrength .strength-bars");
  const text = document.getElementById("passwordStrengthText");
  if (!barsWrapper) return;

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
// SIGNUP PAGE
// =====================================================================
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  wirePasswordToggle("toggleSignupPassword", "signupPassword");
  wirePasswordToggle("toggleConfirmPassword", "confirmPassword");

  const fullNameInput = document.getElementById("fullName");
  const fullNameError = document.getElementById("fullNameError");
  const fullNameCount = document.getElementById("fullNameCount");

  const emailInput = document.getElementById("signupEmail");
  const emailError = document.getElementById("signupEmailError");

  const passwordInput = document.getElementById("signupPassword");
  const confirmInput = document.getElementById("confirmPassword");
  const confirmError = document.getElementById("confirmPasswordError");

  const agreeTerms = document.getElementById("agreeTerms");
  const signupError = document.getElementById("signupError");
  const submitBtn = document.getElementById("signupSubmitBtn");

  // Live full name validation + char counter
  fullNameInput.addEventListener("input", () => {
    fullNameCount.textContent = `${fullNameInput.value.length} / 15`;
    if (fullNameInput.value.length > 0 && fullNameInput.value.trim().length < 3) {
      setFieldError(fullNameInput, fullNameError, "Name must be at least 3 characters");
    } else {
      setFieldError(fullNameInput, fullNameError, "");
    }
  });

  // Live email validation
  emailInput.addEventListener("blur", () => {
    if (emailInput.value && !EMAIL_REGEX.test(emailInput.value)) {
      setFieldError(emailInput, emailError, "Enter a valid email address");
    } else {
      setFieldError(emailInput, emailError, "");
    }
  });

  // Live password strength
  passwordInput.addEventListener("input", () => {
    updateStrengthUI(passwordInput.value);
    if (confirmInput.value) validateConfirmMatch();
  });

  function validateConfirmMatch() {
    if (confirmInput.value && confirmInput.value !== passwordInput.value) {
      setFieldError(confirmInput, confirmError, "Passwords don't match");
      return false;
    }
    setFieldError(confirmInput, confirmError, "");
    return true;
  }

  confirmInput.addEventListener("input", validateConfirmMatch);

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormMessage(signupError);

    let isValid = true;

    // Full name
    const nameVal = fullNameInput.value.trim();
    if (nameVal.length < 3 || nameVal.length > 15) {
      setFieldError(fullNameInput, fullNameError, "Name must be 3–15 characters");
      isValid = false;
    } else {
      setFieldError(fullNameInput, fullNameError, "");
    }

    // Email
    if (!EMAIL_REGEX.test(emailInput.value)) {
      setFieldError(emailInput, emailError, "Enter a valid email address");
      isValid = false;
    } else {
      setFieldError(emailInput, emailError, "");
    }

    // Password strength
    const strengthValid = updateStrengthUI(passwordInput.value);
    if (!strengthValid) isValid = false;

    // Confirm match
    if (!validateConfirmMatch() || !confirmInput.value) {
      setFieldError(confirmInput, confirmError, "Passwords don't match");
      isValid = false;
    }

    // Terms
    if (!agreeTerms.checked) {
      showFormMessage(signupError, "You must agree to the Terms of Service and Privacy Policy to continue.");
      isValid = false;
    }

    if (!isValid) return;

    setButtonLoading(submitBtn, true, "Creating account...", "Create Account");

    try {
      await API.signup(nameVal, emailInput.value, passwordInput.value);
      window.location.href = "landing.html";
    } catch (err) {
      showFormMessage(signupError, err.message || "Something went wrong. Please try again.");
      setButtonLoading(submitBtn, false, "Creating account...", "Create Account");
    }
  });
}

// =====================================================================
// LOGIN PAGE
// =====================================================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  wirePasswordToggle("toggleLoginPassword", "loginPassword");

  const emailInput = document.getElementById("loginEmail");
  const emailError = document.getElementById("loginEmailError");
  const passwordInput = document.getElementById("loginPassword");
  const passwordError = document.getElementById("loginPasswordError");
  const loginError = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormMessage(loginError);

    let isValid = true;

    if (!EMAIL_REGEX.test(emailInput.value)) {
      setFieldError(emailInput, emailError, "Enter a valid email address");
      isValid = false;
    } else {
      setFieldError(emailInput, emailError, "");
    }

    if (!passwordInput.value) {
      setFieldError(passwordInput, passwordError, "Password is required");
      isValid = false;
    } else {
      setFieldError(passwordInput, passwordError, "");
    }

    if (!isValid) return;

    setButtonLoading(submitBtn, true, "Logging in...", "Log In");

    try {
      await API.login(emailInput.value, passwordInput.value);
      window.location.href = "landing.html";
    } catch (err) {
      showFormMessage(loginError, err.message || "Invalid email or password.");
      setButtonLoading(submitBtn, false, "Logging in...", "Log In");
    }
  });
}

// =====================================================================
// FORGOT PASSWORD PAGE
// =====================================================================
const resetForm = document.getElementById("resetForm");

if (resetForm) {
  const emailInput = document.getElementById("resetEmail");
  const emailError = document.getElementById("resetEmailError");
  const resetError = document.getElementById("resetError");
  const resetSuccess = document.getElementById("resetSuccess");
  const submitBtn = document.getElementById("resetSubmitBtn");

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormMessage(resetError);
    resetSuccess.classList.add("hidden");

    if (!EMAIL_REGEX.test(emailInput.value)) {
      setFieldError(emailInput, emailError, "Enter a valid email address");
      return;
    }
    setFieldError(emailInput, emailError, "");

    setButtonLoading(submitBtn, true, "Sending...", "Send Reset Link");

    try {
      await API.requestPasswordReset(emailInput.value);
      resetSuccess.classList.remove("hidden");
      resetForm.reset();
      setButtonLoading(submitBtn, false, "Sending...", "Send Reset Link");
    } catch (err) {
      showFormMessage(resetError, err.message || "Something went wrong. Please try again.");
      setButtonLoading(submitBtn, false, "Sending...", "Send Reset Link");
    }
  });
}
