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
  _BIN_RETENTION_DAYS: 7,

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
    this.dispatchAppEvent("studybot:authchange", { authenticated: true });
  },
  _clearAuthState() {
    localStorage.removeItem(this._CURRENT_USER_KEY);
    localStorage.removeItem(this._TOKEN_KEY);
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
    const session = this._readAuthState();
    if (!session) throw new Error("No active session.");

    const accounts = this._readAccounts();
    const accountIndex = accounts.findIndex((account) => account.email === session.email);
    const updatedSession = { ...session, name };

    if (accountIndex !== -1) {
      accounts[accountIndex] = { ...accounts[accountIndex], name };
      this._writeAccounts(accounts);
    }

    this._writeAuthState(updatedSession);
    return { success: true, user: { name, email: session.email } };
  },

  async changePassword(currentPassword, newPassword) {
    const session = this._readAuthState();
    if (!session) throw new Error("No active session.");

    const accounts = this._readAccounts();
    const accountIndex = accounts.findIndex((account) => account.email === session.email);
    if (accountIndex !== -1 && accounts[accountIndex].password && accounts[accountIndex].password !== currentPassword) {
      throw new Error("Current password is incorrect.");
    }

    if (accountIndex !== -1) {
      accounts[accountIndex] = { ...accounts[accountIndex], password: newPassword };
      this._writeAccounts(accounts);
    }

    this._writeAuthState({ ...session, password: newPassword });
    return { success: true };
  },

  async deleteAccount() {
    const session = this._readAuthState();
    if (!session) throw new Error("No active session.");

    const accounts = this._readAccounts().filter((account) => account.email !== session.email);
    this._writeAccounts(accounts);
    this._clearAuthState();
    return { success: true };
  },

  async getActiveDocuments() {
    // TODO: replace with real call — GET /documents
    return this._readStore(this._DOCS_KEY);
  },

  async getDocuments() {
    // Used by chat.js's Doc Selector — same data as getActiveDocuments,
    // kept as a separate method name since chat.js already calls this.
    const docs = await this.getActiveDocuments();
    return { documents: docs.map((d) => ({ id: d.id, name: d.name })) };
  },

  async getBinDocuments() {
    // TODO: replace with real call — GET /documents/bin
    return this._readStore(this._BIN_KEY);
  },

  async uploadFile(file) {
    // TODO: replace with real call once backend exists
    // const formData = new FormData();
    // formData.append("file", file);
    // const res = await fetch(`${CONFIG.API_BASE_URL}/documents/upload`, {
    //   method: "POST",
    //   body: formData,
    // });
    // return res.json(); // expect { success, id }

    // --- MOCK: writes into localStorage immediately with status "processing" ---
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const docs = this._readStore(this._DOCS_KEY);
    docs.push({ id, name: file.name, size: file.size, status: "processing" });
    this._writeStore(this._DOCS_KEY, docs);
    this.dispatchAppEvent("studybot:documentschange", { action: "uploaded" });

    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true, id }), 400);
    });
  },

  async markDocumentReady(id) {
    // Called after the simulated processing delay in documents.js
    const docs = this._readStore(this._DOCS_KEY);
    const doc = docs.find((d) => d.id === id);
    if (doc) doc.status = "ready";
    this._writeStore(this._DOCS_KEY, docs);
    this.dispatchAppEvent("studybot:documentschange", { action: "ready" });
    return { success: true };
  },

  async moveToBin(id) {
    // TODO: replace with real call — DELETE /documents/:id (soft delete)
    let docs = this._readStore(this._DOCS_KEY);
    const doc = docs.find((d) => d.id === id);
    if (!doc) return { success: false };

    docs = docs.filter((d) => d.id !== id);
    this._writeStore(this._DOCS_KEY, docs);

    let bin = this._readStore(this._BIN_KEY);
    bin.push({ ...doc, deletedAt: Date.now() });

    // Bin holds max 5 — auto-evict oldest if it overflows
    bin.sort((a, b) => a.deletedAt - b.deletedAt);
    if (bin.length > this._BIN_MAX) {
      bin = bin.slice(bin.length - this._BIN_MAX);
    }
    this._writeStore(this._BIN_KEY, bin);
    this.dispatchAppEvent("studybot:documentschange", { action: "moved-to-bin" });

    return { success: true };
  },

  async restoreFromBin(id) {
    // TODO: replace with real call — POST /documents/:id/restore
    let bin = this._readStore(this._BIN_KEY);
    const doc = bin.find((d) => d.id === id);
    if (!doc) return { success: false };

    bin = bin.filter((d) => d.id !== id);
    this._writeStore(this._BIN_KEY, bin);

    const docs = this._readStore(this._DOCS_KEY);
    const { deletedAt, ...restored } = doc;
    docs.push(restored);
    this._writeStore(this._DOCS_KEY, docs);
    this.dispatchAppEvent("studybot:documentschange", { action: "restored" });

    return { success: true };
  },

  async deleteFromBin(id) {
    // TODO: replace with real call — DELETE /documents/bin/:id
    let bin = this._readStore(this._BIN_KEY);
    const exists = bin.some((d) => d.id === id);
    if (!exists) return { success: false };

    bin = bin.filter((d) => d.id !== id);
    this._writeStore(this._BIN_KEY, bin);
    this.dispatchAppEvent("studybot:documentschange", { action: "deleted-from-bin" });
    return { success: true };
  },

  async clearBin() {
    // TODO: replace with real call — DELETE /documents/bin
    this._writeStore(this._BIN_KEY, []);
    this.dispatchAppEvent("studybot:documentschange", { action: "cleared-bin" });
    return { success: true };
  },

  async purgeExpiredBinItems() {
    // TODO: on a real backend this becomes a scheduled job, not a per-request check
    const msPerDay = 24 * 60 * 60 * 1000;
    let bin = this._readStore(this._BIN_KEY);
    const before = bin.length;
    bin = bin.filter((d) => Date.now() - d.deletedAt < this._BIN_RETENTION_DAYS * msPerDay);
    if (bin.length !== before) this._writeStore(this._BIN_KEY, bin);
    this.dispatchAppEvent("studybot:documentschange", { action: "purged-bin" });
    return { success: true };
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
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const accounts = this._readAccounts();
        if (accounts.some((account) => account.email.toLowerCase() === email.toLowerCase())) {
          reject(new Error("An account with this email already exists."));
          return;
        }

        const account = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: fullName,
          email,
          password,
          token: this._createToken(),
        };

        accounts.push(account);
        this._writeAccounts(accounts);
        this._setSessionFromAccount(account);
        resolve({ success: true, token: account.token, user: { name: fullName, email } });
      }, 700);
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
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const accounts = this._readAccounts();
        const existingAccount = accounts.find((account) => account.email.toLowerCase() === email.toLowerCase());

        if (existingAccount && existingAccount.password && existingAccount.password !== password) {
          reject(new Error("Invalid email or password."));
          return;
        }

        const account = existingAccount || {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: this._formatDisplayName(email),
          email,
          password,
          token: this._createToken(),
        };

        if (!existingAccount) {
          accounts.push(account);
          this._writeAccounts(accounts);
        }

        const session = this._setSessionFromAccount(account);
        resolve({ success: true, token: session.token, user: { name: session.name, email: session.email } });
      }, 700);
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
    this._clearAuthState();
    return new Promise((resolve) => resolve({ success: true }));
  },
};