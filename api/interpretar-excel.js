// ============================================================
//  Ágora · Función serverless (Vercel) — Interpretar Excel con IA
// ============================================================
//  Lee las filas de una planilla del consorcio y usa la API de
//  Claude (salida estructurada / tool use) para devolver los
//  movimientos parseados. Procesa por lotes para soportar
//  reportes grandes (cientos de gastos) sin cortes por longitud.
//  La API key vive solo acá.
// ============================================================

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const CATS_IN  = ['Expensas ordinarias', 'Expensas extraordinarias', 'Intereses por mora'];
const CATS_OUT = ['Sueldo encargado', 'Mantenimiento ascensores', 'Limpieza', 'Electricidad y servicios',
                  'Seguro del edificio', 'Reparaciones', 'Honorarios administración', 'Fondo de reserva'];

const SYSTEM = `Sos un asistente que interpreta planillas de administración de consorcios en Argentina y las convierte en movimientos financieros estructurados.

Recibís los encabezados de la planilla y un lote de filas de datos (array de arrays). Cada fila de datos es UN movimiento. Ignorá filas de título, subtotales, totales o vacías.

Reglas:
- "monto" siempre POSITIVO (sin signo ni símbolos). Formato argentino: miles con "." y decimales con "," (ej. "1.234.567,89" = 1234567.89). Si viene como número plano (ej. 942536.0), usalo tal cual.
- "tipo": "in" para ingresos (cobranzas, expensas, intereses) u "out" para egresos/pagos (la mayoría de los gastos son "out").
- "concepto": usá el rubro/cuenta o el detalle de la fila. "proveedor": el proveedor o empleado si aparece.
- "fecha" en formato "YYYY-MM-DD"; si solo hay un período (ej. "Ago.26") o no hay fecha clara, usá null.
- "categoria": la más cercana. Ingresos: ${CATS_IN.join(', ')}. Egresos: ${CATS_OUT.join(', ')}. Si ninguna encaja, usá "Reparaciones" (out) o "Expensas ordinarias" (in).
Registrá TODAS las filas del lote con la herramienta provista.`;

const TOOL = {
  name: 'registrar_movimientos',
  description: 'Registra los movimientos financieros interpretados del lote de filas.',
  input_schema: {
    type: 'object',
    properties: {
      movimientos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fecha: { type: ['string', 'null'], description: 'YYYY-MM-DD o null' },
            concepto: { type: 'string' },
            proveedor: { type: ['string', 'null'] },
            tipo: { type: 'string', enum: ['in', 'out'] },
            monto: { type: 'number', description: 'Positivo, sin signo' },
            categoria: { type: 'string' }
          },
          required: ['concepto', 'tipo', 'monto', 'categoria']
        }
      }
    },
    required: ['movimientos']
  }
};

async function interpretarLote(key, filename, header, batch) {
  const content = `Archivo: ${filename}\nEncabezados de la planilla:\n${JSON.stringify(header)}\n\nFilas de datos a interpretar (cada una es un movimiento):\n${JSON.stringify(batch)}`;
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'registrar_movimientos' },
      messages: [{ role: 'user', content }]
    })
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : 'Error de la API de Claude';
    const e = new Error(msg); e.status = apiRes.status; e.detail = data; throw e;
  }
  const toolUse = (data.content || []).find(b => b.type === 'tool_use');
  const movimientos = toolUse && toolUse.input && Array.isArray(toolUse.input.movimientos) ? toolUse.input.movimientos : [];
  return { movimientos, cut: data.stop_reason === 'max_tokens' };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido. Usá POST.' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { filename = 'planilla.xlsx', rows } = body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se recibieron filas para interpretar.' });
    }

    const MAX_ROWS = 800;
    const trimmed = rows.slice(0, MAX_ROWS);
    const truncated = rows.length > MAX_ROWS;

    // Detectar la fila de encabezados de columnas (contiene "monto"/"proveedor"/"rubro")
    let headerIdx = 0;
    for (let i = 0; i < Math.min(trimmed.length, 15); i++) {
      const joined = (trimmed[i] || []).map(c => String(c).toLowerCase()).join(' ');
      if (/monto|proveedor|rubro|concepto|importe/.test(joined)) { headerIdx = i; break; }
    }
    const header = trimmed.slice(0, headerIdx + 1);
    const dataRows = trimmed.slice(headerIdx + 1);
    if (dataRows.length === 0) {
      return res.status(422).json({ error: 'No encontré filas de gastos en la planilla.' });
    }

    // Procesar por lotes EN PARALELO (tiempo total ≈ una sola llamada)
    const CHUNK = 120;
    const batches = [];
    for (let i = 0; i < dataRows.length; i += CHUNK) batches.push(dataRows.slice(i, i + CHUNK));

    const results = await Promise.allSettled(batches.map(b => interpretarLote(key, filename, header, b)));
    const movimientos = [];
    const notas = [];
    let cortado = false, fallos = 0, lastErr = null;
    for (const r of results) {
      if (r.status === 'fulfilled') { movimientos.push(...r.value.movimientos); if (r.value.cut) cortado = true; }
      else { fallos++; lastErr = r.reason; }
    }

    if (movimientos.length === 0) {
      return res.status((lastErr && lastErr.status) || 502).json({
        error: (lastErr && lastErr.message) || 'El modelo no devolvió movimientos.',
        hint: 'Revisá que la planilla tenga los gastos en filas (proveedor, importe, fecha).'
      });
    }

    if (truncated) notas.push(`Se procesaron las primeras ${MAX_ROWS} de ${rows.length} filas.`);
    if (fallos) notas.push(`${fallos} lote(s) no se pudieron procesar; el resto se importó.`);
    if (cortado) notas.push('Algún lote se cortó por longitud; puede faltar algún movimiento.');
    return res.status(200).json({ movimientos, notas });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Fallo al procesar el archivo', detail: String(err && err.message || err) });
  }
};
