// ============================================================
//  Ágora · Inicialización de Firebase (Firestore)
//  Módulo ES — usa el SDK por CDN, sin build ni node.
//  No necesitás editar este archivo; tocá solo firebase-config.js
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs,
  addDoc, writeBatch, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const COL = "movimientos";
const cfg = window.AGORA_FIREBASE_CONFIG || {};
const configured = !!cfg.apiKey && !/^TU_/.test(cfg.apiKey);

function finish(api) {
  window.AgoraDB = api || null;
  if (window.__agoraReadyResolve) { window.__agoraReadyResolve(api || null); window.__agoraReadyResolve = null; }
}

if (!configured) {
  console.info("[Ágora] Firebase sin configurar → modo local. Editá firebase-config.js para conectar la base.");
  finish(null);
} else {
  try {
    const app = initializeApp(cfg);
    const db  = getFirestore(app);

    // Firestore → objeto de movimiento que usa la app
    const toMov = (d) => {
      const x = d.data();
      return {
        id: d.id,
        date: x.date && x.date.toDate ? x.date.toDate() : new Date(x.date),
        cat: x.cat, concept: x.concept, provider: x.provider || null,
        amount: x.amount, type: x.type, source: x.source || "sistema"
      };
    };
    const docFields = (consorcio, m) => ({
      consorcio,
      date: Timestamp.fromDate(new Date(m.date)),
      cat: m.cat, concept: m.concept, provider: m.provider || null,
      amount: m.amount, type: m.type, source: m.source || "sistema",
      createdAt: Timestamp.now()
    });

    const api = {
      // Trae todos los movimientos de un consorcio (orden en cliente → sin índice compuesto)
      async getAll(consorcio) {
        const snap = await getDocs(query(collection(db, COL), where("consorcio", "==", consorcio)));
        return snap.docs.map(toMov).sort((a, b) => b.date - a.date);
      },
      // Inserta un movimiento nuevo
      async add(consorcio, mov) {
        const ref = await addDoc(collection(db, COL), docFields(consorcio, { ...mov, source: mov.source || "archivo" }));
        return { id: ref.id };
      },
      // Carga inicial de datos de ejemplo cuando el consorcio no tiene movimientos
      async seed(consorcio, list) {
        const batch = writeBatch(db);
        list.forEach((m) => batch.set(doc(collection(db, COL)), docFields(consorcio, m)));
        await batch.commit();
      }
    };

    finish(api);
    console.info("[Ágora] Conectado a Firestore.");
  } catch (err) {
    console.error("[Ágora] No se pudo inicializar Firebase, sigo en modo local:", err);
    finish(null);
  }
}
