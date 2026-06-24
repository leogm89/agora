// ============================================================
//  Ágora · Configuración de Firebase
// ============================================================
//  PEGÁ ACÁ LA CONFIG DE TU PROYECTO:
//  1. https://console.firebase.google.com  →  tu proyecto
//  2. Engranaje ⚙ (Configuración del proyecto) → pestaña "General"
//  3. Bajá hasta "Tus apps" → app Web → "Configuración del SDK" → "Config"
//  4. Copiá el objeto firebaseConfig y reemplazá los valores de abajo.
//
//  Mientras los valores empiecen con "TU_", la app funciona en MODO LOCAL
//  (datos de ejemplo en memoria, sin guardar nada en la nube).
// ============================================================
window.AGORA_FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
};

// ---- No tocar: coordina la carga asíncrona de Firebase ----
window.__agoraReady = new Promise((resolve) => { window.__agoraReadyResolve = resolve; });
// Red de seguridad: si Firebase no carga (sin internet, CDN bloqueada, etc.)
// la app igual arranca en modo local a los 7 segundos.
setTimeout(() => { if (window.__agoraReadyResolve) { window.__agoraReadyResolve(window.AgoraDB || null); window.__agoraReadyResolve = null; } }, 7000);
