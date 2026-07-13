// api.js
// Every call to the Python backend lives here. Nowhere else.
// This is the ONLY file you touch when your FastAPI/Flask backend is ready.

const API = {
  async signup(fullName, email, password) {
    // TODO: replace with real call once backend exists
    // const res = await fetch(`${CONFIG.API_BASE_URL}/auth/signup`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ fullName, email, password }),
    // });
    // if (!res.ok) throw new Error((await res.json()).message || "Signup failed");
    // return res.json();

    // --- MOCK ---
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true, token: "mock-token" }), 700);
    });
  },

  async login(email, password) {
    // TODO: replace with real call once backend exists
    // const res = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ email, password }),
    // });
    // if (!res.ok) throw new Error((await res.json()).message || "Login failed");
    // return res.json();

    // --- MOCK ---
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true, token: "mock-token" }), 700);
    });
  },

  async requestPasswordReset(email) {
    // TODO: POST /auth/forgot-password
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true }), 700);
    });
  },

  async logout() {
    // TODO: POST /auth/logout, clear stored token
    return new Promise((resolve) => resolve({ success: true }));
  },
};
