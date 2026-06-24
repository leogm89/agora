# Ágora · Consorcios

Herramienta web de **inteligencia financiera (cash flow)** para administración de consorcios.
Sitio estático (HTML + JS, sin build) con base de datos en **Firebase Firestore** y deploy en **Vercel**.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (UI + lógica + gráficos). |
| `firebase-config.js` | **El único archivo que editás.** Pegás acá la config de tu proyecto Firebase. |
| `firebase-init.js` | Conexión a Firestore (no hace falta tocarlo). |
| `firestore.rules` | Reglas de seguridad de la base (modo demo abierto). |
| `vercel.json` | Configuración de Vercel. |

> Sin `firebase-config.js` configurado, la app funciona en **modo local** con datos de ejemplo (no guarda nada). Ideal para verla andar antes de conectar la base.

---

## Parte 1 — Crear la base en Firebase

1. Entrá a https://console.firebase.google.com y hacé **"Agregar proyecto"** (ej. `agora-consorcios`).
2. En el menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación: `southamerica-east1` (San Pablo) o la que prefieras.
   - Empezá en **modo de prueba** (test mode).
3. Registrá una **app Web**: engranaje ⚙ → *Configuración del proyecto* → *Tus apps* → ícono **`</>`**.
   - Ponele un apodo (ej. `agora-web`) y registrala. **No** marques Hosting.
4. Copiá el objeto `firebaseConfig` que te muestra y pegá esos valores en **`firebase-config.js`**.
5. (Recomendado) En **Firestore → Reglas**, pegá el contenido de `firestore.rules` y publicá.

> ⚠ **Importante:** el modo demo deja la base abierta a cualquiera con el link. Está bien para probar con datos de ejemplo, **no para datos reales**. El siguiente paso del proyecto es agregar login (Firebase Auth).

## Parte 2 — Subir a GitHub

```bash
cd agora
git add .
git commit -m "Ágora: app + integración Firebase"
```

1. Creá un repo nuevo en https://github.com/new (ej. `agora`, privado).
2. Seguí las instrucciones de "push an existing repository":
   ```bash
   git remote add origin https://github.com/TU_USUARIO/agora.git
   git branch -M main
   git push -u origin main
   ```

## Parte 3 — Deploy en Vercel

1. Entrá a https://vercel.com y registrate/logueate **con GitHub**.
2. **Add New… → Project** → importá el repo `agora`.
3. Framework Preset: **Other** (es un sitio estático). Dejá todo por defecto y **Deploy**.
4. En segundos tenés una URL pública (ej. `https://agora.vercel.app`).

Cada `git push` a `main` vuelve a desplegar automáticamente.

---

## Probar localmente

```bash
cd agora
python3 -m http.server 4321
# abrir http://localhost:4321
```

## Estado actual / próximos pasos

- [x] Dashboard, ingresos/egresos, filtros de fecha, proyección, recomendaciones.
- [x] Carga de gasto por archivo (extracción **simulada** en el cliente).
- [x] Persistencia en Firestore con fallback a modo local.
- [ ] **Login** (Firebase Auth) + reglas protegidas antes de usar datos reales.
- [ ] **Extracción real** de comprobantes con IA/OCR (requiere backend).
