// config.js
// Change this ONE line when your Python backend is deployed.

const CONFIG = {
  API_BASE_URL: "http://localhost:8000",
  MAX_FILES: 3, // v1 free-tier limit; subscription tiers will raise this later (backend-enforced when built)
  ALLOWED_FILE_TYPES: [".pdf", ".docx", ".pptx", ".txt"],
};
