// ============================================================
//  Ágora · Función serverless (Vercel) — Interpretar Excel con IA
// ============================================================
//  Recibe las filas de una planilla del consorcio y usa la API de
//  Claude (con salida estructurada / tool use) para devolver los
//  movimientos ya parseados. La API key vive solo acá.
// ============================================================

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const CATS_IN  = ['Expensas ordinarias', 'Expensas extraordinarias', 'Intereses por mora'];
const CATS_OUT = ['Sueldo encargado', 'Mantenimiento ascensores', 'Limpieza', 'Electricidad y servicios',
                  'Seguro del edificio', 'Reparaciones', 'Honorarios administración', 'Fondo de reserva'];

const SYSTEM = `Sos un asistente que interpreta planillas de administración de consorcios en Argentina y las convierte en movimientos financieros estructurados.

Recibís las filas de una planilla (array de arrays; las primeras filas pueden ser encabezados o títulos). Identificá los movimientos reales (una fila = un movimiento) e ignorá encabezados, subtotales, totales y filas vacías.

Reglas:
- "monto" siempre POSITIVO (sin signo ni símbolos). Interpretá el formato argentino: "$", miles con "." y decimales con "," (ej. "1.234.567,89" = 1234567.89).
- "tipo": "in" para ingresos (cobranzas, expensas, intereses) u "out" para egresos (pagos, gastos).
- "fecha" en formato "YYYY-MM-DD"; si no hay fecha clara, usá null.
- "categoria": elegí la más adecuada. Ingresos: ${CATS_IN.join(', ')}. Egresos: ${CATS_OUT.join(', ')}. Si ninguna encaja, usá "Reparaciones" (out) o "Expensas ordinarias" (in).
Registrá TODOS los movimientos usando la herramienta provista.`;

const TOOL = {
  name: 'registrar_movimientos',
  description: 'Registra los movimientos financieros interpretados de la planilla del consorcio.',
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
      },
      notas: { type: 'array', items: { type: 'string' } }
    },
    required: ['movimientos']
  }
};

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

    const MAX_ROWS = 400;
    const trimmed = rows.slice(0, MAX_ROWS);
    const truncated = rows.length > MAX_ROWS;

    const userContent = `Archivo: ${filename}\nFilas de la planilla (array de arrays):\n` +
      JSON.stringify(trimmed) +
      (truncated ? `\n\n(La planilla tenía ${rows.length} filas; se enviaron las primeras ${MAX_ROWS}.)` : '');

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'registrar_movimientos' },
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      const msg = data && data.error && data.error.message ? data.error.message : 'Error de la API de Claude';
      return res.status(apiRes.status).json({ error: msg, detail: data });
    }

    const toolUse = (data.content || []).find(b => b.type === 'tool_use');
    const parsed = toolUse ? toolUse.input : null;
    if (!parsed || !Array.isArray(parsed.movimientos)) {
      return res.status(502).json({ error: 'El modelo no devolvió movimientos.', stop_reason: data.stop_reason, detail: data.content });
    }

    const notas = Array.isArray(parsed.notas) ? parsed.notas : [];
    if (truncated) notas.push(`Se interpretaron las primeras ${MAX_ROWS} de ${rows.length} filas.`);
    if (data.stop_reason === 'max_tokens') notas.push('La respuesta se cortó por longitud; puede faltar algún movimiento.');

    return res.status(200).json({ movimientos: parsed.movimientos, notas });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo al procesar el archivo', detail: String(err && err.message || err) });
  }
};
