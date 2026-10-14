/* ==========================================================
   BESTA KIOSK — CONFIG
   Fill these in once hosting + Google Cloud + Apps Script are set up.
   Nothing else in the app needs editing to go live.
   ========================================================== */
window.BESTA_CONFIG = {
  // Google Cloud Console -> OAuth Client ID (Web application)
  // Authorized JavaScript origin must match your deployed domain exactly.
  GOOGLE_CLIENT_ID: "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com",

  // Apps Script Web App URL (ends in /exec) — same backend serves all 3 games
  BACKEND_URL: "https://script.google.com/macros/s/AKfycbyHqsxfUBumQTh0K09GakYfiyY3oSwEhWsesHJqN5hU4es7Ucz3WIYQt3_mHA-uD6Kl/exec",

  // Festival game scheduling — ISO dates, inclusive. Table Time has no window (always on).
  GAMES: [
    { id: "orderup",   name: "Table Time",    icon: "puzzle-piece", blurb: "Solve a jigsaw of your own selfie.", alwaysOn: true },
    { id: "demonhunt", name: "Dasara Arcade", icon: "gamepad", blurb: "Durga Maa vs the Asuras — 10 retro levels.", startDate: "2026-10-01", endDate: "2026-10-21" },
  ],

  RESTAURANT_NAME: "Besta — The Indian Kitchen",
};
