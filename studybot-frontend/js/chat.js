// chat.js

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

let hybridMode = localStorage.getItem("studybot-hybrid-default") === "true";

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

// ===== Load documents (mocked) =====
async function loadDocuments() {
  try {
    const res = await API.getDocuments();
    setHasDocuments(res.documents.length > 0);
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}
loadDocuments();
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
    const res = await API.sendMessage(text);
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
