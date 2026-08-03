// documents.js

if (!API.isAuthenticated()) {
  window.location.replace("login.html");
} else {

// ===== Sliding sidebar =====
const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
document.getElementById("openSidebar").addEventListener("click", () => {
  appSidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
});
function closeSidebar() {
  appSidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}
document.getElementById("closeSidebar").addEventListener("click", closeSidebar);
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

// ===== Upgrade link placeholder =====
document.getElementById("upgradeLink").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Subscription plans are coming soon!");
});

// =====================================================================
// FILE UPLOAD + LIST + BIN
// =====================================================================
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const documentsFeedback = document.getElementById("documentsFeedback");
const browseLink = document.getElementById("browseLink");
const fileList = document.getElementById("fileList");
const emptyFileList = document.getElementById("emptyFileList");
const docCountBadge = document.getElementById("docCountBadge");
const binList = document.getElementById("binList");
const emptyBinList = document.getElementById("emptyBinList");
const binCountBadge = document.getElementById("binCountBadge");
const clearBinBtn = document.getElementById("clearBinBtn");
const uploadOverflowModal = document.getElementById("uploadOverflowModal");
const uploadOverflowMessage = document.getElementById("uploadOverflowMessage");
const uploadOverflowConfirm = document.getElementById("uploadOverflowConfirm");
const uploadOverflowCancel = document.getElementById("uploadOverflowCancel");
const uploadOverflowUpgradeLink = document.getElementById("uploadOverflowUpgradeLink");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const deleteConfirmWarning = document.getElementById("deleteConfirmWarning");
const deleteConfirmSubmit = document.getElementById("deleteConfirmSubmit");
const deleteConfirmCancel = document.getElementById("deleteConfirmCancel");

let pendingDeleteDecision = null;
let pendingDeleteFileId = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createSafeElement(tagName, textContent) {
  const el = document.createElement(tagName);
  el.textContent = textContent;
  return el;
}

function formatSectionCount(current, max) {
  return `${current}/${max}`;
}

function showDocumentsFeedback(message, type = "success") {
  if (!documentsFeedback) return;
  documentsFeedback.textContent = message;
  documentsFeedback.className = `inline-feedback ${type}`;
  documentsFeedback.classList.remove("hidden");
}

function clearDocumentsFeedback() {
  if (!documentsFeedback) return;
  documentsFeedback.textContent = "";
  documentsFeedback.className = "inline-feedback hidden";
}

let pendingOverflowDecision = null;

function openOverflowModal(oldestFile, incomingFile) {
  uploadOverflowMessage.innerHTML = `You can keep up to <strong>${CONFIG.MAX_FILES}</strong> documents on the free plan. To upload <strong>${escapeHtml(incomingFile.name)}</strong>, the oldest file <strong>${escapeHtml(oldestFile.name)}</strong> will be <span class="deleted-word">deleted</span> and moved to the Recycle Bin.`;
  uploadOverflowModal.classList.remove("hidden");

  return new Promise((resolve) => {
    pendingOverflowDecision = resolve;
  });
}

function closeOverflowModal(confirmed) {
  uploadOverflowModal.classList.add("hidden");
  if (pendingOverflowDecision) {
    pendingOverflowDecision(confirmed);
    pendingOverflowDecision = null;
  }
}

uploadOverflowConfirm.addEventListener("click", () => closeOverflowModal(true));
uploadOverflowCancel.addEventListener("click", () => closeOverflowModal(false));
uploadOverflowModal.addEventListener("click", (e) => {
  if (e.target === uploadOverflowModal) closeOverflowModal(false);
});
uploadOverflowUpgradeLink.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Subscription plans are coming soon!");
});

function openDeleteConfirmModal(fileName, binIsFull) {
  deleteConfirmMessage.innerHTML = `Are you sure you want to move <strong class="file-name">${escapeHtml(fileName)}</strong> to the Recycle Bin?`;
  if (binIsFull) {
    deleteConfirmWarning.innerHTML = `Warning: Recycle Bin is full. Deleting <strong class="file-name">${escapeHtml(fileName)}</strong> will <span class="alert-word">delete</span> the oldest file in the bin.`;
    deleteConfirmWarning.classList.remove("hidden");
  } else {
    deleteConfirmWarning.innerHTML = "";
    deleteConfirmWarning.classList.add("hidden");
  }
  deleteConfirmModal.classList.remove("hidden");

  return new Promise((resolve) => {
    pendingDeleteDecision = resolve;
  });
}

function closeDeleteConfirmModal(confirmed) {
  deleteConfirmModal.classList.add("hidden");
  if (pendingDeleteDecision) {
    pendingDeleteDecision(confirmed);
    pendingDeleteDecision = null;
  }
}

deleteConfirmSubmit.addEventListener("click", () => closeDeleteConfirmModal(true));
deleteConfirmCancel.addEventListener("click", () => closeDeleteConfirmModal(false));
deleteConfirmModal.addEventListener("click", (e) => {
  if (e.target === deleteConfirmModal) closeDeleteConfirmModal(false);
});

clearBinBtn.addEventListener("click", async () => {
  const binFiles = await API.getBinDocuments();
  if (binFiles.length === 0) {
    showDocumentsFeedback("Recycle Bin is already empty.", "error");
    return;
  }
  const confirmed = window.confirm("Delete all files from the Recycle Bin permanently?");
  if (!confirmed) return;
  await API.clearBin();
  await refreshAll();
  showDocumentsFeedback("Recycle Bin cleared.", "success");
});

// FIX: browseLink is nested inside uploadZone. Without stopPropagation,
// clicking it fires its own listener AND bubbles up to uploadZone's
// listener, calling fileInput.click() twice — which breaks the file
// dialog on the first attempt in some browsers (needs a 2nd try).
browseLink.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadZone.addEventListener("click", (e) => {
  // Only trigger if the click was on the zone itself, not bubbled from browseLink
  if (e.target === browseLink) return;
  fileInput.click();
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  const selectedFiles = Array.from(fileInput.files || []);
  fileInput.value = "";
  if (selectedFiles.length > 0) handleFiles(selectedFiles);
});

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleFiles(fileListInput) {
  const activeFiles = await API.getActiveDocuments();

  for (const file of fileListInput) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(ext)) {
      alert(`Unsupported file type: ${ext}`);
      continue;
    }

    if (activeFiles.length >= CONFIG.MAX_FILES) {
      const oldest = activeFiles[0];
      const removeOldest = await openOverflowModal(oldest, file);
      if (removeOldest) {
        await API.moveToBin(oldest.id);
        activeFiles.shift();
      } else {
        return;
      }
    }

    const uploaded = await uploadFile(file);
    if (uploaded) {
      activeFiles.push({ id: `pending-${Date.now()}`, name: file.name });
    }
  }

  await refreshAll();
  if (fileListInput.length > 0) {
    showDocumentsFeedback(`${fileListInput.length} file${fileListInput.length > 1 ? "s" : ""} processed.`, "success");
  }
}

async function uploadFile(file) {
  try {
    const res = await API.uploadFile(file);
    if (!res.success) {
      showDocumentsFeedback(`Upload failed for ${file.name}.`, "error");
      return false;
    }

    // Simulate backend processing/embedding time before marking as ready
    setTimeout(async () => {
      await API.markDocumentReady(res.id);
      await refreshAll();
    }, 1800);
    return true;
  } catch (err) {
    console.error("Upload failed:", err);
    showDocumentsFeedback(`Failed to upload ${file.name}.`, "error");
    return false;
  }
}

async function deleteFile(fileId) {
  try {
    const [activeFiles, binFiles] = await Promise.all([API.getActiveDocuments(), API.getBinDocuments()]);
    const targetFile = activeFiles.find((file) => file.id === fileId);
    if (!targetFile) {
      showDocumentsFeedback("Couldn't delete that file — it may have already been removed.", "error");
      return;
    }

    const confirmed = await openDeleteConfirmModal(targetFile.name, binFiles.length >= CONFIG.MAX_BIN_FILES);
    if (!confirmed) return;

    const res = await API.moveToBin(fileId);
    if (!res.success) {
      showDocumentsFeedback("Couldn't delete that file — it may have already been removed.", "error");
      return;
    }
    await refreshAll();
    showDocumentsFeedback("File moved to the Recycle Bin.", "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showDocumentsFeedback("Something went wrong while deleting.", "error");
  }
}

async function deleteBinFile(fileId) {
  try {
    const res = await API.deleteFromBin(fileId);
    if (!res.success) {
      showDocumentsFeedback("Couldn't delete that file from the Recycle Bin.", "error");
      return;
    }
    await refreshAll();
    showDocumentsFeedback("File deleted permanently.", "success");
  } catch (err) {
    console.error("Delete from bin failed:", err);
    showDocumentsFeedback("Something went wrong while deleting from the Recycle Bin.", "error");
  }
}

async function restoreFile(fileId) {
  try {
    const activeFiles = await API.getActiveDocuments();
    if (activeFiles.length >= CONFIG.MAX_FILES) {
      showDocumentsFeedback(`Your active documents are full (${CONFIG.MAX_FILES} max). Remove one before restoring.`, "error");
      return;
    }
    const res = await API.restoreFromBin(fileId);
    if (!res.success) {
      showDocumentsFeedback("Couldn't restore that file — it may have already expired.", "error");
      return;
    }
    await refreshAll();
    showDocumentsFeedback("File restored from the Recycle Bin.", "success");
  } catch (err) {
    console.error("Restore failed:", err);
    showDocumentsFeedback("Something went wrong while restoring.", "error");
  }
}

function daysRemainingLabel(deletedAt) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - deletedAt;
  const remaining = Math.max(0, 7 - Math.floor(elapsed / msPerDay));
  if (remaining === 0) return "Expiring today";
  if (remaining === 1) return "1 day left";
  return `${remaining} days left`;
}

function renderActiveList(files) {
  fileList.innerHTML = "";
  emptyFileList.classList.toggle("hidden", files.length > 0);
  docCountBadge.textContent = formatSectionCount(files.length, CONFIG.MAX_FILES);
  docCountBadge.classList.toggle("full", files.length >= CONFIG.MAX_FILES);

  files.forEach((file) => {
    const li = document.createElement("li");
    li.className = "file-item";
    const statusLabel = file.status === "processing" ? "⏳ Processing..." : "✓ Ready";
    const statusClass = file.status === "processing" ? "processing" : "ready";

    const info = document.createElement("div");
    info.className = "file-item-info";

    const icon = document.createElement("span");
    icon.className = "file-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📄";

    const details = document.createElement("div");
    details.className = "file-item-details";

    const nameEl = createSafeElement("div", file.name);
    nameEl.className = "file-item-name";

    const sizeEl = createSafeElement("div", formatFileSize(file.size));
    sizeEl.className = "file-item-size";

    details.appendChild(nameEl);
    details.appendChild(sizeEl);
    info.appendChild(icon);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "file-item-actions";

    const status = createSafeElement("span", statusLabel);
    status.className = `status-badge ${statusClass}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-action-sm delete-btn";
    deleteBtn.setAttribute("aria-label", `Delete ${file.name}`);
    deleteBtn.title = "Move to Recycle Bin";
    deleteBtn.textContent = "🗑️";

    actions.appendChild(status);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    li.querySelector(".delete-btn").addEventListener("click", () => deleteFile(file.id));
    fileList.appendChild(li);
  });
}

function renderBinList(files) {
  binList.innerHTML = "";
  emptyBinList.classList.toggle("hidden", files.length > 0);
  binCountBadge.textContent = formatSectionCount(files.length, CONFIG.MAX_BIN_FILES);
  binCountBadge.classList.toggle("full", files.length >= CONFIG.MAX_BIN_FILES);

  const orderedFiles = [...files].sort((a, b) => b.deletedAt - a.deletedAt);

  orderedFiles.forEach((file, index) => {
    const li = document.createElement("li");
    li.className = "file-item";

    const row = document.createElement("div");
    row.className = "bin-row";

    const rowIndex = createSafeElement("div", String(index + 1));
    rowIndex.className = "bin-row-index";

    const rowContent = document.createElement("div");
    rowContent.className = "bin-row-content";

    const info = document.createElement("div");
    info.className = "file-item-info";

    const icon = document.createElement("span");
    icon.className = "file-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📄";

    const details = document.createElement("div");
    details.className = "file-item-details";

    const nameWrapper = document.createElement("div");
    nameWrapper.className = "file-item-name file-item-name-bin";

    const nameEl = createSafeElement("span", file.name);
    nameEl.className = "bin-file-name";

    const sizeEl = createSafeElement("div", formatFileSize(file.size));
    sizeEl.className = "file-item-size";

    nameWrapper.appendChild(nameEl);
    details.appendChild(nameWrapper);
    details.appendChild(sizeEl);

    info.appendChild(icon);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "file-item-actions bin-row-actions";

    const expiry = createSafeElement("span", daysRemainingLabel(file.deletedAt));
    expiry.className = "status-badge expiry";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-action-sm delete-btn bin-delete-btn";
    deleteBtn.setAttribute("aria-label", `Delete ${file.name} permanently`);
    deleteBtn.title = "Delete permanently";
    deleteBtn.textContent = "🗑️";

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "icon-action-sm restore-btn";
    restoreBtn.setAttribute("aria-label", `Restore ${file.name}`);
    restoreBtn.title = "Restore from Recycle Bin";
    restoreBtn.textContent = "↩️";

    actions.appendChild(expiry);
    actions.appendChild(deleteBtn);
    actions.appendChild(restoreBtn);

    row.appendChild(rowIndex);
    row.appendChild(rowContent);
    rowContent.appendChild(info);
    rowContent.appendChild(actions);

    li.appendChild(row);
    li.querySelector(".bin-delete-btn").addEventListener("click", () => deleteBinFile(file.id));
    li.querySelector(".restore-btn").addEventListener("click", () => restoreFile(file.id));
    binList.appendChild(li);
  });
}

async function refreshAll() {
  try {
    await API.purgeExpiredBinItems(); // silently drop anything past 7 days
    const [activeFiles, binFiles] = await Promise.all([
      API.getActiveDocuments(),
      API.getBinDocuments(),
    ]);
    clearDocumentsFeedback();
    renderActiveList(activeFiles);
    renderBinList(binFiles);
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}

refreshAll();
}
