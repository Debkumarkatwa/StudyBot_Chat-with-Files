// chat.js

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

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
  // TODO: call API.logout() once backend exists, then clear session/token
  window.location.href = "landing.html";
}
document.getElementById("logoutBtn").addEventListener("click", handleLogout);
document.getElementById("sidebarLogoutBtn").addEventListener("click", handleLogout);

// ===== Document Selector dropdown =====
const docSelectorBtn = document.getElementById("docSelectorBtn");
const docSelectorDropdown = document.getElementById("docSelectorDropdown");
const docFilterDot = document.getElementById("docFilterDot");
const docAllCheckbox = document.getElementById("docAll");
const docCheckboxList = document.getElementById("docCheckboxList");

let allDocuments = []; // populated from API.getDocuments()

function openDocSelectorDropdown() {
  docSelectorDropdown.classList.remove("hidden");
}

function closeDocSelectorDropdown() {
  if (docSelectorDropdown.classList.contains("hidden")) return;
  docSelectorDropdown.classList.add("hidden");
  enforceNonEmptySelection(); // if user unchecked everything, default back to "All"
}

docSelectorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  docSelectorDropdown.classList.contains("hidden") ? openDocSelectorDropdown() : closeDocSelectorDropdown();
});
document.addEventListener("click", closeDocSelectorDropdown);
docSelectorDropdown.addEventListener("click", (e) => e.stopPropagation());

function renderDocCheckboxList() {
  docCheckboxList.innerHTML = "";
  allDocuments.forEach((doc) => {
    const label = document.createElement("label");
    label.className = "doc-checkbox-row";
    label.innerHTML = `<input type="checkbox" class="doc-item-checkbox" data-doc-id="${doc.id}" checked /><span>${doc.name}</span>`;
    docCheckboxList.appendChild(label);
  });
}

function getIndividualCheckboxes() {
  return Array.from(document.querySelectorAll(".doc-item-checkbox"));
}

function enforceNonEmptySelection() {
  const checkboxes = getIndividualCheckboxes();
  if (checkboxes.length === 0) return;
  const checkedBoxes = checkboxes.filter((cb) => cb.checked);
  if (checkedBoxes.length === 0) {
    docAllCheckbox.checked = true;
    checkboxes.forEach((cb) => (cb.checked = true));
    updateDocSelectorLabel();
  }
}

function updateDocSelectorLabel() {
  const checkboxes = getIndividualCheckboxes();
  const checkedBoxes = checkboxes.filter((cb) => cb.checked);
  let label;
  let showDot = false;

  if (checkedBoxes.length === checkboxes.length) {
    label = "Doc Selector: All Documents";
  } else if (checkedBoxes.length === 1) {
    const doc = allDocuments.find((d) => d.id === checkedBoxes[0].dataset.docId);
    label = `Doc Selector: ${doc ? doc.name : "1 selected"}`;
    showDot = true;
  } else {
    label = `Doc Selector: ${checkedBoxes.length} selected`;
    showDot = true;
  }

  docSelectorBtn.setAttribute("data-tooltip", label);
  docFilterDot.hidden = !showDot;
}

function getSelectedDocIds() {
  const checkboxes = getIndividualCheckboxes();
  const checkedBoxes = checkboxes.filter((cb) => cb.checked);
  if (checkedBoxes.length === checkboxes.length) return "all";
  return checkedBoxes.map((cb) => cb.dataset.docId);
}

// "All" checkbox controls every individual checkbox
docAllCheckbox.addEventListener("change", () => {
  getIndividualCheckboxes().forEach((cb) => (cb.checked = docAllCheckbox.checked));
  updateDocSelectorLabel();
});

// Any individual checkbox controls "All" state (event delegation, list is dynamic)
docCheckboxList.addEventListener("change", (e) => {
  if (!e.target.classList.contains("doc-item-checkbox")) return;
  const checkboxes = getIndividualCheckboxes();
  docAllCheckbox.checked = checkboxes.every((cb) => cb.checked);
  updateDocSelectorLabel();
});

// ===== Hybrid mode toggle (icon button, not checkbox) =====
const hybridToggleBtn = document.getElementById("hybridToggleBtn");
let hybridMode = false;

hybridToggleBtn.addEventListener("click", () => {
  hybridMode = !hybridMode;
  hybridToggleBtn.classList.toggle("active", hybridMode);
  hybridToggleBtn.setAttribute("aria-pressed", hybridMode ? "true" : "false");
  hybridToggleBtn.setAttribute("data-tooltip", hybridMode ? "Hybrid Mode: On" : "Hybrid Mode: Off");
});

// ===== Empty state vs chat container =====
const emptyState = document.getElementById("emptyState");
const chatContainer = document.getElementById("chatContainer");

function setHasDocuments(hasDocuments) {
  emptyState.classList.toggle("hidden", hasDocuments);
  chatContainer.classList.toggle("hidden", !hasDocuments);
}

// ===== Load documents (mocked) =====
async function loadDocuments() {
  try {
    const res = await API.getDocuments();
    allDocuments = res.documents;
    renderDocCheckboxList();
    updateDocSelectorLabel();
    setHasDocuments(allDocuments.length > 0);
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}
loadDocuments();

// ===== DEV-ONLY: simulate empty vs populated state — delete once Documents page is real =====
let devHasDocs = true;
document.getElementById("devDocToggle").addEventListener("click", () => {
  devHasDocs = !devHasDocs;
  setHasDocuments(devHasDocs);
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

// Enter = send, Shift+Enter = new line
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

let lastBotMessageEl = null;

function renderMessage(text, sender, sourceTag, isLatestBot = false) {
  const el = document.createElement("div");
  el.className = `message ${sender}`;

  const p = document.createElement("p");
  p.textContent = text;
  el.appendChild(p);

  if (sourceTag) {
    const tag = document.createElement("span");
    tag.className = "source-tag";
    tag.textContent = sourceTag === "document" ? "📄 From your documents" : "🌐 General AI knowledge";
    el.appendChild(tag);
  }

  if (sender === "bot") {
    // Remove regenerate button from the previous last bot message —
    // only the most recent bot reply should offer it.
    if (lastBotMessageEl) {
      const oldActions = lastBotMessageEl.querySelector(".message-actions");
      const regenBtn = oldActions?.querySelector(".regen-btn");
      regenBtn?.remove();
    }

    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "✓ Copied";
      setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
    });
    actions.appendChild(copyBtn);

    const regenBtn = document.createElement("button");
    regenBtn.className = "regen-btn";
    regenBtn.textContent = "🔄 Regenerate";
    regenBtn.addEventListener("click", () => regenerateLastResponse());
    actions.appendChild(regenBtn);

    el.appendChild(actions);
    lastBotMessageEl = el;
  }

  chatMessages.appendChild(el);
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
      selectedDocIds: getSelectedDocIds(),
    });
    removeLoading(loadingId);
    renderMessage(res.answer, "bot", res.source);
  } catch (err) {
    removeLoading(loadingId);
    renderMessage("Something went wrong. Please try again.", "bot");
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
