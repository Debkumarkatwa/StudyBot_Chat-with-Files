// api.js
// Every call to the Python backend lives here. Nowhere else.
// This is the ONLY file you touch when your FastAPI/Flask backend is ready.

const API = {
  async getDocuments() {
    // TODO: replace with real call — GET /documents
    // const res = await fetch(`${CONFIG.API_BASE_URL}/documents`);
    // return res.json();

    // --- MOCK: pretend the user has already uploaded these ---
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          documents: [
            { id: "doc1", name: "Chapter4_Notes.pdf" },
            { id: "doc2", name: "Lecture_Slides.pptx" },
            { id: "doc3", name: "Revision_Summary.docx" },
          ],
        });
      }, 300);
    });
  },

  async sendMessage(message, options = {}) {
    // options: { hybrid: boolean, selectedDocIds: string[] | "all" }
    // TODO: replace with real call once backend exists
    // const res = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ message, ...options }),
    // });
    // return res.json();

    // --- MOCK RESPONSE ---
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          answer: `(mock) You asked: "${message}". Scope: ${
            options.selectedDocIds === "all" ? "all documents" : (options.selectedDocIds || []).join(", ") || "none selected"
          }${options.hybrid ? " (hybrid mode on)" : ""}`,
          source: options.hybrid ? "general_ai" : "document",
        });
      }, 700);
    });
  },

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
