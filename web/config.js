// Public configuration only. Secrets must never be added to this file.
window.OOTANI_API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8787"
  : "https://ootani-incident-api.ootani-incident.workers.dev";
