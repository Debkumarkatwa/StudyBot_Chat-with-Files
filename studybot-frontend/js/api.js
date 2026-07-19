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

    return { success: true };
  },

  async deleteFromBin(id) {
    // TODO: replace with real call — DELETE /documents/bin/:id
    let bin = this._readStore(this._BIN_KEY);
    const exists = bin.some((d) => d.id === id);
    if (!exists) return { success: false };

    bin = bin.filter((d) => d.id !== id);
    this._writeStore(this._BIN_KEY, bin);
    return { success: true };
  },

  async clearBin() {
    // TODO: replace with real call — DELETE /documents/bin
    this._writeStore(this._BIN_KEY, []);
    return { success: true };
  },

  async purgeExpiredBinItems() {
    // TODO: on a real backend this becomes a scheduled job, not a per-request check
    const msPerDay = 24 * 60 * 60 * 1000;
    let bin = this._readStore(this._BIN_KEY);
    const before = bin.length;
    bin = bin.filter((d) => Date.now() - d.deletedAt < this._BIN_RETENTION_DAYS * msPerDay);
    if (bin.length !== before) this._writeStore(this._BIN_KEY, bin);
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