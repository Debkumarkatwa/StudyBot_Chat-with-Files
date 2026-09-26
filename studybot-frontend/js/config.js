function resolveApiBaseUrl() {
  const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalDev) return "http://localhost:8000";

  const PROD_API_BASE_URL = "https://YOUR-BACKEND-NAME.onrender.com"; // <-- set this before deploying

  if (!PROD_API_BASE_URL || PROD_API_BASE_URL.includes("YOUR-BACKEND-NAME")) {
    throw new Error(
      "config.js: PROD_API_BASE_URL is still the placeholder. Set it to your real deployed backend URL before deploying."
    );
  }
  return PROD_API_BASE_URL;
}

const CONFIG = {
  API_BASE_URL: resolveApiBaseUrl(),
  MAX_FILES: 3,
  MAX_BIN_FILES: 5,
  BIN_RETENTION_DAYS: 7,
  ALLOWED_FILE_TYPES: [".pdf", ".docx", ".pptx", ".txt"],
};
