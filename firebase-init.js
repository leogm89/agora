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
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

    // --- Autenticación (Firebase Auth: email + contraseña) ---
    const auth = getAuth(app);
    window.AgoraAuth = {
      onChange: (cb) => onAuthStateChanged(auth, cb),
      login:    (email, pass) => signInWithEmailAndPassword(auth, email, pass),
      register: (email, pass) => createUserWithEmailAndPassword(auth, email, pass),
      logout:   () => signOut(auth),
      current:  () => auth.currentUser
    };

    const uid = () => (auth.currentUser ? auth.currentUser.uid : "__anon__");

    // Firestore → objeto de movimiento que usa la app
    const toMov = (d) => {
      const x = d.data();
      return {
        id: d.id, consorcio: x.consorcio,
        date: x.date && x.date.toDate ? x.date.toDate() : new Date(x.date),
        cat: x.cat, concept: x.concept, provider: x.provider || null,
        amount: x.amount, type: x.type, source: x.source || "sistema"
      };
    };
    const docFields = (consorcio, m) => ({
      uid: uid(), consorcio,
      date: Timestamp.fromDate(new Date(m.date)),
      cat: m.cat, concept: m.concept, provider: m.provider || null,
      amount: m.amount, type: m.type, source: m.source || "sistema",
      createdAt: Timestamp.now()
    });

    const api = {
      // Movimientos del usuario actual para un consorcio.
      // Se consulta por uid (un solo campo → sin índice compuesto) y se filtra el consorcio en el cliente.
      async getAll(consorcio) {
        const snap = await getDocs(query(collection(db, COL), where("uid", "==", uid())));
        return snap.docs.map(toMov).filter(m => m.consorcio === consorcio).sort((a, b) => b.date - a.date);
      },
      // Inserta un movimiento nuevo
      async add(consorcio, mov) {
        const ref = await addDoc(collection(db, COL), docFields(consorcio, { ...mov, source: mov.source || "archivo" }));
        return { id: ref.id };
      },
      // Inserta muchos movimientos de una (escritura por lote, hasta 450 por batch)
      async addMany(consorcio, list) {
        const CH = 450;
        for (let i = 0; i < list.length; i += CH) {
          const batch = writeBatch(db);
          list.slice(i, i + CH).forEach((m) => batch.set(doc(collection(db, COL)), docFields(consorcio, m)));
          await batch.commit();
        }
      },
      // Alias usado en modo demo/carga inicial
      async seed(consorcio, list) { return this.addMany(consorcio, list); }
    };

    finish(api);
    console.info("[Ágora] Conectado a Firestore.");
  } catch (err) {
    console.error("[Ágora] No se pudo inicializar Firebase, sigo en modo local:", err);
    finish(null);
  }
}
