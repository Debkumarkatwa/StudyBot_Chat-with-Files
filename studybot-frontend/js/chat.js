// chat.js

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

let hybridMode = localStorage.getItem("studybot-hybrid-default") === "true";
let selectedDocIds = "all"; // "all" or array of document ids

function normalizeSelectedDocIds(value) {
  if (value === "all") return "all";
  if (!Array.isArray(value)) return "all";
  return value.length === 0 ? "all" : value;
}

selectedDocIds = normalizeSelectedDocIds(selectedDocIds);

// ===== Hybrid toggle button =====
const hybridToggleBtn = document.getElementById("hybridToggleBtn");

function syncHybridButton() {
  hybridToggleBtn.classList.toggle("active", hybridMode);
  hybridToggleBtn.setAttribute("aria-pressed", String(hybridMode));
}
syncHybridButton();

hybridToggleBtn.addEventListener("click", () => {
  hybridMode = !hybridMode;
  syncHybridButton();
});

// ===== Document selector =====
const docSelectorBtn = document.getElementById("docSelectorBtn");
const docSelectorDropdown = document.getElementById("docSelectorDropdown");
const docSelectorClose = document.getElementById("docSelectorClose");
const docSelectAll = document.getElementById("docSelectAll");
const docSelectorList = document.getElementById("docSelectorList");

async function openDocSelector() {
  const { documents } = await API.getDocuments();

  docSelectorList.innerHTML = "";
  if (documents.length === 0) {
    docSelectorList.innerHTML = '<div class="doc-selector-empty">No documents uploaded yet.</div>';
  } else {
    documents.forEach((doc) => {
      const label = document.createElement("label");
      label.className = "doc-selector-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = doc.id;
      checkbox.checked = selectedDocIds === "all" || selectedDocIds.includes(doc.id);
      checkbox.addEventListener("change", handleDocCheckboxChange);

      const span = document.createElement("span");
      span.textContent = doc.name;

      label.appendChild(checkbox);
      label.appendChild(span);
      docSelectorList.appendChild(label);
    });
  }

  docSelectAll.checked = selectedDocIds === "all";
  docSelectorDropdown.classList.remove("hidden");
}

function handleDocCheckboxChange() {
  const checkboxes = Array.from(docSelectorList.querySelectorAll("input[type=checkbox]"));
  const checked = checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);

  if (checked.length === 0) {
    selectedDocIds = "all";
    docSelectAll.checked = true;
    checkboxes.forEach((cb) => (cb.checked = true));
    return;
  }

  if (checked.length === checkboxes.length) {
    selectedDocIds = "all";
    docSelectAll.checked = true;
  } else {
    selectedDocIds = checked;
    docSelectAll.checked = false;
  }
}

docSelectAll.addEventListener("change", () => {
  const checkboxes = Array.from(docSelectorList.querySelectorAll("input[type=checkbox]"));
  if (docSelectAll.checked) {
    selectedDocIds = "all";
    checkboxes.forEach((cb) => (cb.checked = true));
  } else {
    selectedDocIds = "all";
    docSelectAll.checked = true;
    checkboxes.forEach((cb) => (cb.checked = true));
  }
});

docSelectorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (docSelectorDropdown.classList.contains("hidden")) {
    openDocSelector();
  } else {
    docSelectorDropdown.classList.add("hidden");
  }
});
docSelectorClose.addEventListener("click", () => docSelectorDropdown.classList.add("hidden"));
document.addEventListener("click", (e) => {
  if (!docSelectorDropdown.contains(e.target) && e.target !== docSelectorBtn) {
    docSelectorDropdown.classList.add("hidden");
  }
});

function openSidebar() {
  appSidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
}
function closeSidebar() {
  appSidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}
openSidebarBtn.addEventListener("click", openSidebar);
closeSidebarBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// ===== Profile dropdown =====
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

// ===== Empty state vs chat container =====
const emptyState = document.getElementById("emptyState");
const chatContainer = document.getElementById("chatContainer");

function setHasDocuments(hasDocuments) {
  emptyState.classList.toggle("hidden", hasDocuments);
  chatContainer.classList.toggle("hidden", !hasDocuments);
}

async function loadDocuments() {
  try {
    const res = await API.getDocuments();
    if (Array.isArray(selectedDocIds)) {
      const availableIds = new Set(res.documents.map((doc) => doc.id));
      selectedDocIds = selectedDocIds.filter((id) => availableIds.has(id));
      if (selectedDocIds.length === 0) selectedDocIds = "all";
    }
    setHasDocuments(res.documents.length > 0);
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}

(async function initChatPage() {
  const isValidSession = await API.validateSession();
  if (!isValidSession) {
    window.location.replace("login.html");
    return;
  }
  await loadDocuments();
})();

window.addEventListener("studybot:documentschange", () => {
  loadDocuments();
});

// =====================================================================
// CHAT MESSAGES
// =====================================================================
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// Auto-grow the textarea as the user types (capped by max-height in CSS)
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
});

// Puts a previous message's text back into the composer, resized and
// focused with the caret at the end — used by each user message's
// Edit button, for both exact resend and modify-then-resend.
function loadTextIntoComposer(text) {
  chatInput.value = text;
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  chatInput.focus();
  const end = chatInput.value.length;
  chatInput.setSelectionRange(end, end);
}

// Enter = send, Shift+Enter = new line
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

let lastBotMessageEl = null;

// Groups the flat sources array by filename, keeping each entry's
// original 1-based number so it matches the [n] markers in the text.
function groupSourcesByFilename(sources) {
  const groups = new Map();
  sources.forEach((src, i) => {
    if (!groups.has(src.filename)) groups.set(src.filename, []);
    groups.get(src.filename).push({ num: i + 1, preview: src.chunk_preview });
  });
  return groups;
}

function renderMessage(text, sender, sourceTag, sources = []) {
  const el = document.createElement("div");
  el.className = `message ${sender}`;

  const contentEl = document.createElement("div");
  contentEl.className = "message-content";
  if (sender === "bot") {
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      contentEl.innerHTML = DOMPurify.sanitize(marked.parse(text), {
        FORBID_TAGS: ["img", "style"],
        FORBID_ATTR: ["style"],
      });
    } else {
      contentEl.textContent = text;
    }
  } else {
    contentEl.textContent = text;
  }
  el.appendChild(contentEl);

  if (sourceTag) {
    const tag = document.createElement("span");
    tag.className = "source-tag";
    setIcon(tag, sourceTag === "document" ? "document" : "globe", sourceTag === "document" ? "From your documents" : "General AI knowledge");
    el.appendChild(tag);
  }

  if (sender === "bot" && sources.length > 0) {
    const grouped = groupSourcesByFilename(sources);
    const panel = document.createElement("div");
    panel.className = "sources-panel hidden";

    grouped.forEach((chunks, filename) => {
      const group = document.createElement("div");
      group.className = "sources-panel-group";

      const title = document.createElement("div");
      title.className = "sources-panel-filename";
      setIcon(title, "document", `${filename} (${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`);
      group.appendChild(title);

      chunks.forEach(({ num, preview }) => {
        const line = document.createElement("div");
        line.className = "sources-panel-chunk";
        line.textContent = `[${num}] ${preview}`;
        group.appendChild(line);
      });

      panel.appendChild(group);
    });

    el.appendChild(panel);
  }

  if (sender === "bot") {
    if (lastBotMessageEl) {
      const oldActions = lastBotMessageEl.querySelector(".message-actions");
      const regenBtn = oldActions?.querySelector(".regen-btn");
      regenBtn?.remove();
    }

    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyBtn = document.createElement("button");
    setIcon(copyBtn, "copy", "Copy");
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        setIcon(copyBtn, "check", "Copied");
      } catch {
        setIcon(copyBtn, "warning", "Copy failed");
      }
      setTimeout(() => setIcon(copyBtn, "copy", "Copy"), 1500);
    });
    actions.appendChild(copyBtn);

    const regenBtn = document.createElement("button");
    regenBtn.className = "regen-btn";
    setIcon(regenBtn, "refresh", "Regenerate");
    regenBtn.addEventListener("click", () => regenerateLastResponse());
    actions.appendChild(regenBtn);

    if (sources.length > 0) {
      const sourcesBtn = document.createElement("button");
      setIcon(sourcesBtn, "link", "Sources");
      sourcesBtn.addEventListener("click", () => {
        el.querySelector(".sources-panel")?.classList.toggle("hidden");
      });
      actions.appendChild(sourcesBtn);
    }

    el.appendChild(actions);
    lastBotMessageEl = el;

    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return el;
  }

  // User messages: bubble is appended completely unchanged from the
  // original design. A small icon-only row (Edit, Copy) is appended as
  // a SEPARATE sibling right below it — not inside the bubble, not
  // beside it — matching the reference layout (icons under the message,
  // right-aligned to it).
  chatMessages.appendChild(el);

  const userActions = document.createElement("div");
  userActions.className = "message-actions user-message-actions";

  const editBtn = document.createElement("button");
  editBtn.innerHTML = ICONS.edit;
  editBtn.setAttribute("aria-label", "Edit and resend this message");
  editBtn.title = "Edit";
  editBtn.addEventListener("click", () => loadTextIntoComposer(text));
  userActions.appendChild(editBtn);

  const copyBtn = document.createElement("button");
  copyBtn.innerHTML = ICONS.copy;
  copyBtn.setAttribute("aria-label", "Copy this message");
  copyBtn.title = "Copy";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.innerHTML = ICONS.check;
    } catch {
      copyBtn.innerHTML = ICONS.warning;
    }
    setTimeout(() => (copyBtn.innerHTML = ICONS.copy), 1500);
  });
  userActions.appendChild(copyBtn);

  chatMessages.appendChild(userActions);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

function renderLoading() {
  const el = document.createElement("div");
  el.className = "message bot";
  el.id = "loading-" + Date.now();
  el.textContent = "Thinking...";
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el.id;
}
function removeLoading(id) {
  document.getElementById(id)?.remove();
}

let lastUserQuery = null;

async function sendChatMessage(text) {
  const loadingId = renderLoading();
  try {
    const res = await API.sendMessage(text, {
      hybrid: hybridMode,
      selectedDocIds: selectedDocIds,
    });
    removeLoading(loadingId);
    renderMessage(res.answer, "bot", res.source, res.sources);
  } catch (err) {
    removeLoading(loadingId);
    renderMessage(err.message || "Something went wrong. Please try again.", "bot");
    console.error(err);
  }
}

async function regenerateLastResponse() {
  if (!lastUserQuery) return;
  await sendChatMessage(lastUserQuery);
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  renderMessage(text, "user");
  lastUserQuery = text;
  chatInput.value = "";
  chatInput.style.height = "auto";

  await sendChatMessage(text);
});
