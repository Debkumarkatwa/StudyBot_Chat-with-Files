// api.js
// Every call to the Python backend lives here. Nowhere else.
// This is the ONLY file you touch when your FastAPI/Flask backend is ready.

const API = {
  // ===================================================================
  // DOCUMENT STORAGE (mocked via localStorage until backend exists)
  // Real backend will replace ALL of this section's internals with
  // fetch() calls — the function signatures/return shapes should stay
  // the same so documents.js and chat.js don't need to change.
  // ===================================================================
  _DOCS_KEY: "studybot-documents",
  _BIN_KEY: "studybot-bin",
  _ACCOUNTS_KEY: "studybot-accounts",
  _CURRENT_USER_KEY: "studybot-current-user",
  _TOKEN_KEY: "studybot-auth-token",
  _BIN_MAX: CONFIG.MAX_BIN_FILES,
  _BIN_RETENTION_DAYS: CONFIG.BIN_RETENTION_DAYS,
  _REFRESH_TOKEN_KEY: "studybot-refresh-token",

  async _apiFetch(path, options = {}) {
    const token = localStorage.getItem(this._TOKEN_KEY);
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      let detail = "Something went wrong. Please try again.";
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch { /* non-JSON error body, keep default message */ }
      throw new Error(detail);
    }

    if (res.status === 204) return null; // no body to parse (matches your DELETE routes)
    return res.json();
  },

  _readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  },
  _writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  dispatchAppEvent(type, detail = {}) {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(type, { detail }));
    }
  },

  _readAuthState() {
    try {
      return JSON.parse(localStorage.getItem(this._CURRENT_USER_KEY)) || null;
    } catch {
      return null;
    }
  },
 _writeAuthState(value) {
    localStorage.setItem(this._CURRENT_USER_KEY, JSON.stringify(value));
    localStorage.setItem(this._TOKEN_KEY, value.token);
    if (value.refreshToken) localStorage.setItem(this._REFRESH_TOKEN_KEY, value.refreshToken);
    this.dispatchAppEvent("studybot:authchange", { authenticated: true });
  },
  _clearAuthState() {
    localStorage.removeItem(this._CURRENT_USER_KEY);
    localStorage.removeItem(this._TOKEN_KEY);
    localStorage.removeItem(this._REFRESH_TOKEN_KEY);
    this.dispatchAppEvent("studybot:authchange", { authenticated: false });
  },
  _readAccounts() {
    return this._readStore(this._ACCOUNTS_KEY);
  },
  _writeAccounts(value) {
    this._writeStore(this._ACCOUNTS_KEY, value);
  },
  _createToken() {
    return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  },
  _formatDisplayName(email) {
    const localPart = String(email).split("@")[0] || "user";
    return (
      localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ") || "User"
    );
  },
  _setSessionFromAccount(account) {
    const session = {
      id: account.id,
      name: account.name,
      email: account.email,
      password: account.password,
      token: account.token || this._createToken(),
    };
    this._writeAuthState(session);
    return session;
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(this._TOKEN_KEY));
  },

  async getCurrentUser() {
    const session = this._readAuthState();
    if (!session) throw new Error("No active session.");
    return { name: session.name, email: session.email };
  },

  async updateProfileName(name) {
    const user = await this._apiFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ full_name: name }),
    });
    const session = this._readAuthState();
    this._writeAuthState({ ...session, name: user.full_name });
    return { success: true, user: { name: user.full_name, email: user.email } };
  },

  async changePassword(currentPassword, newPassword) {
    await this._apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    return { success: true };
  },

  async deleteAccount(password) {
    await this._apiFetch("/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
    this._clearAuthState();
    return { success: true };
  },

  async getActiveDocuments() {
    const docs = await this._apiFetch("/documents", { method: "GET" });
    return docs
      .filter((d) => d.status !== "deleted")
      .map((d) => ({
        id: d.id,
        name: d.filename,
        size: d.file_size ?? 0,
        status: d.status,
      }));
  },

  async getDocuments() {
    const docs = await this.getActiveDocuments();
    return { documents: docs.map((d) => ({ id: d.id, name: d.name })) };
  },

  async getBinDocuments() {
    const docs = await this._apiFetch("/documents/bin", { method: "GET" });
    return docs.map((d) => ({
      id: d.id,
      name: d.filename,
      size: d.file_size ?? 0,
      deletedAt: new Date(d.deleted_at).getTime(),
    }));
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem(this._TOKEN_KEY);
    const res = await fetch(`${CONFIG.API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData, // no Content-Type header — browser sets multipart boundary automatically
    });

    if (!res.ok) {
      let detail = "Upload failed.";
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new Error(detail);
    }

    const doc = await res.json();
    this.dispatchAppEvent("studybot:documentschange", { action: "uploaded" });
    return { success: true, id: doc.id, status: doc.status };
  },

  // Polls GET /documents until the given document's status leaves "processing".
  // Stops after maxAttempts so a stuck backend job can't poll forever.
  async pollDocumentStatus(id, { intervalMs = 2500, maxAttempts = 40 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const docs = await this.getActiveDocuments();
      const doc = docs.find((d) => d.id === id);
      if (!doc || doc.status !== "processing") {
        return doc || null; // gone (e.g. deleted mid-poll) or done processing
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return null; // gave up — caller should just refresh and move on
  },

  async moveToBin(id) {
    await this._apiFetch(`/documents/${id}`, { method: "DELETE" });
    this.dispatchAppEvent("studybot:documentschange", { action: "moved-to-bin" });
    return { success: true };
  },

  async restoreFromBin(id) {
    await this._apiFetch(`/documents/${id}/restore`, { method: "POST" });
    this.dispatchAppEvent("studybot:documentschange", { action: "restored" });
    return { success: true };
  },

  async deleteFromBin(id) {
    await this._apiFetch(`/documents/bin/${id}`, { method: "DELETE" });
    this.dispatchAppEvent("studybot:documentschange", { action: "deleted-from-bin" });
    return { success: true };
  },

  async clearBin() {
    await this._apiFetch("/documents/bin", { method: "DELETE" });
    this.dispatchAppEvent("studybot:documentschange", { action: "cleared-bin" });
    return { success: true };
  },

  async purgeExpiredBinItems() {
    // No-op now — backend does lazy purge automatically inside GET /documents/bin.
    return { success: true };
  },

  async sendMessage(message, options = {}) {
    const payload = { question: message };
    if (typeof options.hybrid === "boolean") payload.hybrid = options.hybrid;
    if (Array.isArray(options.selectedDocIds)) payload.document_ids = options.selectedDocIds;
    // options.selectedDocIds === "all" (or omitted) -> document_ids stays unset -> backend searches everything

    const res = await this._apiFetch("/chat/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      answer: res.answer,
      source: res.hybrid_used ? "general_ai" : "document",
      sources: res.sources,
    };
  },

  async signup(fullName, email, password) {
    await this._apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    // Signup doesn't return tokens (backend design) — log in immediately after.
    return this.login(email, password);
  },

async login(email, password) {
    const tokens = await this._apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem(this._TOKEN_KEY, tokens.access_token); // set before /me call, _apiFetch needs it

    const user = await this._apiFetch("/auth/me", { method: "GET" }); // to get the user details like name, avater etc.

    const session = {
      id: user.id,
      name: user.full_name || this._formatDisplayName(user.email),
      email: user.email,
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    this._writeAuthState(session);
    return { success: true, token: session.token, user: { name: session.name, email: session.email } };
  },

  async requestPasswordReset(email) {
    // TODO: POST /auth/forgot-password
    // Intentionally not wired to a backend — no email service exists yet.
    // forgot-password.html already tells the user this is a mock.
    return { success: true };
  },

  async logout() {
    this._clearAuthState();
    return { success: true };
  },
};