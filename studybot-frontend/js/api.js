// api.js
// Every call to the Python backend lives here. Nowhere else.

const API = {
  _CURRENT_USER_KEY: "studybot-current-user",
  _TOKEN_KEY: "studybot-auth-token",
  _REFRESH_TOKEN_KEY: "studybot-refresh-token",
  _BIN_MAX: CONFIG.MAX_BIN_FILES,
  _BIN_RETENTION_DAYS: CONFIG.BIN_RETENTION_DAYS,

  async _refreshAccessToken() {
    const storedRefreshToken = localStorage.getItem(this._REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return false;

    const res = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: storedRefreshToken }),
    });

    if (!res.ok) return false;

    const tokens = await res.json();
    localStorage.setItem(this._TOKEN_KEY, tokens.access_token);
    localStorage.setItem(this._REFRESH_TOKEN_KEY, tokens.refresh_token);
    return true;
  },

  async _apiFetch(path, options = {}, allowRefresh = true) {
    const token = localStorage.getItem(this._TOKEN_KEY);
    const headers = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const isPublicAuthPath = path === "/auth/login" || path === "/auth/signup";
    if (res.status === 401 && allowRefresh && path !== "/auth/refresh" && !isPublicAuthPath) {
      const refreshed = await this._refreshAccessToken();
      if (refreshed) return this._apiFetch(path, options, false);
      this._clearAuthState();
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!res.ok) {
      let detail = "Something went wrong. Please try again.";
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch { /* non-JSON error body, keep default message */ }
      throw new Error(detail);
    }

    if (res.status === 204) return null;
    return res.json();
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
    const { token, refreshToken, ...session } = value;
    if (token) localStorage.setItem(this._TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(this._REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this._CURRENT_USER_KEY, JSON.stringify(session));
    this.dispatchAppEvent("studybot:authchange", { authenticated: true });
  },
  _clearAuthState() {
    localStorage.removeItem(this._CURRENT_USER_KEY);
    localStorage.removeItem(this._TOKEN_KEY);
    localStorage.removeItem(this._REFRESH_TOKEN_KEY);
    this.dispatchAppEvent("studybot:authchange", { authenticated: false });
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
  isAuthenticated() {
    return Boolean(localStorage.getItem(this._TOKEN_KEY));
  },

  async validateSession() {
    if (!this.isAuthenticated()) {
      this._clearAuthState();
      return false;
    }

    try {
      const user = await this._apiFetch("/auth/me", { method: "GET" });
      const currentSession = this._readAuthState() || {};
      const refreshedSession = {
        ...currentSession,
        id: user.id,
        name: user.full_name || currentSession.name || this._formatDisplayName(user.email),
        email: user.email,
      };
      this._writeAuthState(refreshedSession);
      return true;
    } catch (err) {
      this._clearAuthState();
      return false;
    }
  },

  async getCurrentUser() {
    const valid = await this.validateSession();
    if (!valid) throw new Error("No active session.");
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
    return {
      documents: docs
        .filter((d) => d.status === "active")
        .map((d) => ({ id: d.id, name: d.name })),
    };
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

    const doc = await this._apiFetch("/documents/upload", {
      method: "POST",
      body: formData,
    });
    this.dispatchAppEvent("studybot:documentschange", { action: "uploaded" });
    return { success: true, id: doc.id, status: doc.status };
  },

  async pollDocumentStatus(id, { intervalMs = 2500, maxAttempts = 40 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const docs = await this.getActiveDocuments();
      const doc = docs.find((d) => d.id === id);
      if (!doc || doc.status !== "processing") {
        return doc || null;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return null;
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
    return { success: true };
  },

  async sendMessage(message, options = {}) {
    const payload = { question: message };
    if (typeof options.hybrid === "boolean") payload.hybrid = options.hybrid;

    const selectedDocIds = Array.isArray(options.selectedDocIds)
      ? options.selectedDocIds.filter(Boolean)
      : options.selectedDocIds;

    if (Array.isArray(selectedDocIds) && selectedDocIds.length > 0) {
      payload.document_ids = selectedDocIds;
    }

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
    return this.login(email, password);
  },

  async login(email, password) {
    const tokens = await this._apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    // Store tokens BEFORE calling /auth/me, so that call actually carries
    // the Authorization header instead of relying on anything else.
    localStorage.setItem(this._TOKEN_KEY, tokens.access_token);
    localStorage.setItem(this._REFRESH_TOKEN_KEY, tokens.refresh_token);

    const user = await this._apiFetch("/auth/me", { method: "GET" });

    const session = {
      id: user.id,
      name: user.full_name || this._formatDisplayName(user.email),
      email: user.email,
    };
    this._writeAuthState(session);
    return { success: true, user: { name: session.name, email: session.email } };
  },

  async requestPasswordReset(email) {
    return { success: true };
  },

  async logout() {
    const storedRefreshToken = localStorage.getItem(this._REFRESH_TOKEN_KEY);
    try {
      await this._apiFetch(
        "/auth/logout",
        { method: "POST", body: JSON.stringify({ refresh_token: storedRefreshToken }) },
        false
      );
    } finally {
      this._clearAuthState();
    }
    return { success: true };
  },
};