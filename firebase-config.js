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
  apiKey: "AIzaSyAII_NGM44VZP_1_FPrpFh5phQp0BMy2m8",
  authDomain: "agora-55d20.firebaseapp.com",
  projectId: "agora-55d20",
  storageBucket: "agora-55d20.firebasestorage.app",
  messagingSenderId: "774505776750",
  appId: "1:774505776750:web:1d4e70ff2a158447f0887f"
};

// ---- No tocar: coordina la carga asíncrona de Firebase ----
window.__agoraReady = new Promise((resolve) => { window.__agoraReadyResolve = resolve; });
// Red de seguridad: si Firebase no carga (sin internet, CDN bloqueada, etc.)
// la app igual arranca en modo local a los 7 segundos.
setTimeout(() => { if (window.__agoraReadyResolve) { window.__agoraReadyResolve(window.AgoraDB || null); window.__agoraReadyResolve = null; } }, 7000);
