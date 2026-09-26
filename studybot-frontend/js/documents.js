// documents.js

(async () => {
  if (!(await API.validateSession())) {
    window.location.replace("login.html");
    return;
  }

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
const uploadZoneDefault = document.getElementById("uploadZoneDefault");
const uploadZoneStatus = document.getElementById("uploadZoneStatus");
let isUploading = false;
const uploadOverflowModal = document.getElementById("uploadOverflowModal");
const uploadOverflowMessage = document.getElementById("uploadOverflowMessage");
const uploadOverflowAcknowledge = document.getElementById("uploadOverflowAcknowledge");
const uploadOverflowUpgradeLink = document.getElementById("uploadOverflowUpgradeLink");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const deleteConfirmWarning = document.getElementById("deleteConfirmWarning");
const deleteConfirmSubmit = document.getElementById("deleteConfirmSubmit");
const deleteConfirmCancel = document.getElementById("deleteConfirmCancel");

let pendingDeleteDecision = null;
let pendingDeleteFileId = null;
// Uploads that failed before any document row was created (network error,
// 500, etc.) — kept in memory so Retry can resubmit the same File object
// without asking the user to re-browse for it.
let failedUploads = [];

function setUploadingState(isActive) {
  isUploading = isActive;
  uploadZone.classList.toggle("uploading", isActive);
  uploadZoneDefault.classList.toggle("hidden", isActive);
  uploadZoneStatus.classList.toggle("hidden", !isActive);
}

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

function openOverflowModal(incomingFile) {
  uploadOverflowMessage.innerHTML = `You've reached the limit of <strong>${CONFIG.MAX_FILES}</strong> documents on the free plan. To upload <strong>${escapeHtml(incomingFile.name)}</strong>, delete a document from <strong>My Documents</strong> first, then try uploading again.`;
  uploadOverflowModal.classList.remove("hidden");
  trapModalFocus(uploadOverflowModal, uploadOverflowAcknowledge);

  return new Promise((resolve) => {
    pendingOverflowDecision = resolve;
  });
}

function closeOverflowModal() {
  uploadOverflowModal.classList.add("hidden");
  releaseModalFocus(uploadOverflowModal);
  if (pendingOverflowDecision) {
    pendingOverflowDecision();
    pendingOverflowDecision = null;
  }
}

uploadOverflowAcknowledge.addEventListener("click", () => closeOverflowModal());
uploadOverflowModal.addEventListener("click", (e) => {
  if (e.target === uploadOverflowModal) closeOverflowModal();
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
  trapModalFocus(deleteConfirmModal, deleteConfirmCancel);

  return new Promise((resolve) => {
    pendingDeleteDecision = resolve;
  });
}

function closeDeleteConfirmModal(confirmed) {
  deleteConfirmModal.classList.add("hidden");
  releaseModalFocus(deleteConfirmModal);
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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!uploadOverflowModal.classList.contains("hidden")) closeOverflowModal();
  if (!deleteConfirmModal.classList.contains("hidden")) closeDeleteConfirmModal(false);
});

clearBinBtn.addEventListener("click", async () => {
  try {
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
  } catch (err) {
    showDocumentsFeedback(err.message || "Something went wrong while clearing the Recycle Bin.", "error");
  }
});

// FIX: browseLink is nested inside uploadZone. Without stopPropagation,
// clicking it fires its own listener AND bubbles up to uploadZone's
// listener, calling fileInput.click() twice — which breaks the file
// dialog on the first attempt in some browsers (needs a 2nd try).
browseLink.addEventListener("click", (e) => {
  e.stopPropagation();
  if (isUploading) return;
  fileInput.click();
});

uploadZone.addEventListener("click", (e) => {
  // Only trigger if the click was on the zone itself, not bubbled from browseLink
  if (e.target === browseLink) return;
  if (isUploading) return;
  fileInput.click();
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (isUploading) return;
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  if (isUploading) return;
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
  setUploadingState(true);
  try {
    const activeFiles = await API.getActiveDocuments();
    let uploadedCount = 0;

    for (const file of fileListInput) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!CONFIG.ALLOWED_FILE_TYPES.includes(ext)) {
        alert(`Unsupported file type: ${ext}`);
        continue;
      }

      if (activeFiles.length >= CONFIG.MAX_FILES) {
        await openOverflowModal(file);
        continue; // skip this file — no auto-delete, no chained upload
      }

      const uploaded = await uploadFile(file);
      if (uploaded) {
        activeFiles.push({ id: `pending-${Date.now()}`, name: file.name });
        uploadedCount++;
      }
    }

    await refreshAll();
    if (uploadedCount > 0) {
      showDocumentsFeedback(`${uploadedCount} file${uploadedCount > 1 ? "s" : ""} uploaded.`, "success");
    }
  } finally {
    setUploadingState(false);
  }
}

async function uploadFile(file) {
  try {
    const res = await API.uploadFile(file);
    const completed = res.status === "processing"
      ? await API.pollDocumentStatus(res.id)
      : res;

    await refreshAll();
    if (!completed || completed.status === "failed") {
      showDocumentsFeedback(`Failed to process ${file.name}.`, "error");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Upload failed:", err);
    showDocumentsFeedback(`Failed to upload ${file.name}.`, "error");
    failedUploads.push({ id: crypto.randomUUID(), file, message: err.message || `Failed to upload ${file.name}.` });
    renderFailedUploads();
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

    await API.moveToBin(fileId);
    await refreshAll();
    showDocumentsFeedback("File moved to the Recycle Bin.", "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showDocumentsFeedback("Something went wrong while deleting.", "error");
  }
}

async function deleteBinFile(fileId) {
  try {
    await API.deleteFromBin(fileId);
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
    await API.restoreFromBin(fileId);
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
  const remaining = Math.max(0, CONFIG.BIN_RETENTION_DAYS - Math.floor(elapsed / msPerDay));
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
    const statusIcon =
      file.status === "processing" ? "clock" :
      file.status === "failed" ? "warning" : "check";
    const statusText =
      file.status === "processing" ? "Processing..." :
      file.status === "failed" ? "Failed" : "Ready";
    const statusClass =
      file.status === "processing" ? "processing" :
      file.status === "failed" ? "failed" : "ready";

    const info = document.createElement("div");
    info.className = "file-item-info";

    const icon = document.createElement("span");
    icon.className = "file-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICONS.document;

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

    const status = createSafeElement("span", statusText);
    status.className = `status-badge ${statusClass}`;
    status.insertAdjacentHTML("afterbegin", ICONS[statusIcon]);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-action-sm delete-btn";
    deleteBtn.setAttribute("aria-label", `Delete ${file.name}`);
    deleteBtn.title = "Move to Recycle Bin";
    deleteBtn.innerHTML = ICONS.trash;

    actions.appendChild(status);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    li.querySelector(".delete-btn").addEventListener("click", () => deleteFile(file.id));
    fileList.appendChild(li);
  });
}

async function retryUpload(id) {
  const entry = failedUploads.find((f) => f.id === id);
  if (!entry) return;
  failedUploads = failedUploads.filter((f) => f.id !== id);
  renderFailedUploads();

  setUploadingState(true);
  try {
    const uploaded = await uploadFile(entry.file);
    await refreshAll();
    if (uploaded) showDocumentsFeedback(`${entry.file.name} uploaded.`, "success");
  } finally {
    setUploadingState(false);
  }
}

function dismissFailedUpload(id) {
  failedUploads = failedUploads.filter((f) => f.id !== id);
  renderFailedUploads();
}

function renderFailedUploads() {
  fileList.querySelectorAll(".file-item.failed-upload").forEach((el) => el.remove());

  failedUploads.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "file-item failed-upload";

    const info = document.createElement("div");
    info.className = "file-item-info";

    const icon = document.createElement("span");
    icon.className = "file-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICONS.document;

    const details = document.createElement("div");
    details.className = "file-item-details";

    const nameEl = createSafeElement("div", entry.file.name);
    nameEl.className = "file-item-name";

    const sizeEl = createSafeElement("div", entry.message);
    sizeEl.className = "file-item-size";

    details.appendChild(nameEl);
    details.appendChild(sizeEl);
    info.appendChild(icon);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "file-item-actions";

    const status = createSafeElement("span", "Failed");
    status.className = "status-badge failed";
    status.insertAdjacentHTML("afterbegin", ICONS.warning);

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "icon-action-sm retry-btn";
    retryBtn.setAttribute("aria-label", `Retry uploading ${entry.file.name}`);
    retryBtn.title = "Retry";
    retryBtn.innerHTML = ICONS.refresh;
    retryBtn.addEventListener("click", () => retryUpload(entry.id));

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "icon-action-sm dismiss-btn";
    dismissBtn.setAttribute("aria-label", `Dismiss ${entry.file.name}`);
    dismissBtn.title = "Dismiss";
    dismissBtn.innerHTML = ICONS.close;
    dismissBtn.addEventListener("click", () => dismissFailedUpload(entry.id));

    actions.appendChild(status);
    actions.appendChild(retryBtn);
    actions.appendChild(dismissBtn);

    li.appendChild(info);
    li.appendChild(actions);
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
    icon.innerHTML = ICONS.document;

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
    deleteBtn.innerHTML = ICONS.trash;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "icon-action-sm restore-btn";
    restoreBtn.setAttribute("aria-label", `Restore ${file.name}`);
    restoreBtn.title = "Restore from Recycle Bin";
    restoreBtn.innerHTML = ICONS.restore;

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
    renderFailedUploads();
  } catch (err) {
    console.error("Failed to load documents:", err);
  }
}

refreshAll();
})();
