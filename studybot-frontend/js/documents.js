// documents.js

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
  // TODO: call API.logout() once backend exists
  window.location.href = "landing.html";
}
document.getElementById("logoutBtn").addEventListener("click", handleLogout);
document.getElementById("sidebarLogoutBtn").addEventListener("click", handleLogout);

// ===== Upgrade link placeholder =====
document.getElementById("upgradeLink").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Subscription plans are coming soon!");
});

// =====================================================================
// FILE UPLOAD + LIST
// =====================================================================
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const browseLink = document.getElementById("browseLink");
const fileList = document.getElementById("fileList");
const emptyFileList = document.getElementById("emptyFileList");

// Each entry: { id, name, size, status: "processing" | "ready" }
let uploadedFiles = [];

browseLink.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("click", () => fileInput.click());

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
  handleFiles(fileInput.files);
  fileInput.value = ""; // allow re-selecting the same file later
});

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleFiles(fileListInput) {
  for (const file of fileListInput) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(ext)) {
      alert(`Unsupported file type: ${ext}`);
      continue;
    }

    if (uploadedFiles.length >= CONFIG.MAX_FILES) {
      const oldest = uploadedFiles[0];
      const removeOldest = confirm(
        `You've reached the ${CONFIG.MAX_FILES}-document limit on the free plan. Remove the oldest file ("${oldest.name}") to add this one?`
      );
      if (removeOldest) {
        removeFile(oldest.id);
      } else {
        return;
      }
    }

    uploadFile(file);
  }
}

async function uploadFile(file) {
  try {
    const res = await API.uploadFile(file);
    if (!res.success) return;

    const newFile = {
      id: res.id || `local-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      status: "processing",
    };
    uploadedFiles.push(newFile);
    renderFileList();

    // Simulate backend processing/embedding time before marking as ready
    setTimeout(() => {
      const target = uploadedFiles.find((f) => f.id === newFile.id);
      if (target) {
        target.status = "ready";
        renderFileList();
      }
    }, 1800);
  } catch (err) {
    console.error(err);
    alert(`Failed to upload ${file.name}`);
  }
}

async function removeFile(fileId) {
  const file = uploadedFiles.find((f) => f.id === fileId);
  if (!file) return;
  try {
    await API.deleteFile(fileId);
    uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
    renderFileList();
  } catch (err) {
    console.error(err);
    alert(`Failed to remove ${file.name}`);
  }
}

function renderFileList() {
  fileList.innerHTML = "";
  emptyFileList.classList.toggle("hidden", uploadedFiles.length > 0);

  uploadedFiles.forEach((file) => {
    const li = document.createElement("li");
    li.className = "file-item";

    const statusLabel = file.status === "processing" ? "⏳ Processing..." : "✓ Ready";
    const statusClass = file.status === "processing" ? "processing" : "ready";

    li.innerHTML = `
      <div class="file-item-info">
        <span class="file-item-icon" aria-hidden="true">📄</span>
        <div class="file-item-details">
          <div class="file-item-name">${file.name}</div>
          <div class="file-item-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
      <div class="file-item-actions">
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        <button class="file-remove-btn" aria-label="Remove ${file.name}">✕</button>
      </div>
    `;

    li.querySelector(".file-remove-btn").addEventListener("click", () => removeFile(file.id));
    fileList.appendChild(li);
  });
}

renderFileList(); // initial empty state
