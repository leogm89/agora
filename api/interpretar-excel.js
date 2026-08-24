// ============================================================
//  Ágora · Función serverless (Vercel) — Interpretar Excel con IA
// ============================================================
//  Recibe las filas de una planilla del consorcio y usa la API de
//  Claude para devolver los movimientos ya estructurados.
//
//  La API key vive SOLO acá, en la variable de entorno del servidor
//  (Vercel → Settings → Environment Variables → ANTHROPIC_API_KEY).
//  Nunca llega al navegador ni al repositorio.
// ============================================================

// Modelo económico y de sobra para extracción estructurada.
// Alternativas si las planillas son muy caóticas: 'claude-sonnet-5' o 'claude-opus-5'.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

// Categorías válidas (deben coincidir con las de la app)
const CATS_IN  = ['Expensas ordinarias', 'Expensas extraordinarias', 'Intereses por mora'];
const CATS_OUT = ['Sueldo encargado', 'Mantenimiento ascensores', 'Limpieza', 'Electricidad y servicios',
                  'Seguro del edificio', 'Reparaciones', 'Honorarios administración', 'Fondo de reserva'];

const SYSTEM = `Sos un asistente que interpreta planillas de administración de consorcios en Argentina y las convierte en movimientos financieros estructurados.

Recibís las filas de una planilla (array de arrays; las primeras filas pueden ser encabezados o títulos). Tenés que identificar los movimientos reales (una fila = un movimiento) e ignorar encabezados, subtotales, totales y filas vacías.

Para cada movimiento devolvé:
- "fecha": en formato "YYYY-MM-DD" (si la fila no tiene fecha clara, usá null).
- "concepto": descripción breve del movimiento.
- "proveedor": razón social si aparece, si no null.
- "tipo": "in" para ingresos (cobranzas, expensas, intereses) u "out" para egresos (pagos, gastos).
- "monto": número POSITIVO, sin signo ni símbolos. Interpretá el formato argentino: "$", separador de miles "." y decimal "," (ej. "1.234.567,89" = 1234567.89).
- "categoria": elegí la más adecuada de estas listas.
  Ingresos (in): ${CATS_IN.join(', ')}.
  Egresos (out): ${CATS_OUT.join(', ')}.
  Si ninguna encaja bien, usá "Reparaciones" (out) o "Expensas ordinarias" (in).

Respondé EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional ni backticks, con esta forma:
{"movimientos": [ { "fecha": "...", "concepto": "...", "proveedor": null, "tipo": "out", "monto": 0, "categoria": "..." } ], "notas": ["observaciones o filas ambiguas, si las hay"]}`;

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usá POST.' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { filename = 'planilla.xlsx', rows } = body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se recibieron filas para interpretar.' });
    }

    const MAX_ROWS = 500;
    const trimmed = rows.slice(0, MAX_ROWS);
    const truncated = rows.length > MAX_ROWS;

    const userContent =
      `Archivo: ${filename}\n` +
      `Filas de la planilla (array de arrays):\n` +
      JSON.stringify(trimmed) +
      (truncated ? `\n\n(La planilla tenía ${rows.length} filas; se enviaron las primeras ${MAX_ROWS}.)` : '');

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'Error de la API de Claude', detail: data });
    }

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = extractJSON(text);
    if (!parsed || !Array.isArray(parsed.movimientos)) {
      return res.status(502).json({ error: 'No se pudo interpretar la respuesta del modelo.', raw: text.slice(0, 2000) });
    }

    const notas = Array.isArray(parsed.notas) ? parsed.notas : [];
    if (truncated) notas.push(`Se interpretaron las primeras ${MAX_ROWS} de ${rows.length} filas.`);

    return res.status(200).json({ movimientos: parsed.movimientos, notas });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo al procesar el archivo', detail: String(err && err.message || err) });
  }
};
