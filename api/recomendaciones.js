// ============================================================
//  Ágora · Función serverless (Vercel) — Recomendaciones IA
// ============================================================
//  Recibe los datos financieros del consorcio y pide a Claude,
//  como asesor financiero experto (con salida estructurada), la
//  expensa a emitir y recomendaciones. La API key vive solo acá.
// ============================================================

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM = `Sos un asesor financiero senior especializado en administración de consorcios en Argentina, en un contexto inflacionario. Analizás el flujo de caja de un consorcio y producís (1) la expensa a emitir el próximo período y (2) recomendaciones financieras accionables.

Criterios: cubrir los egresos proyectados, mantener un colchón de reserva prudente, contemplar la morosidad, anticipar gastos crecientes y evitar saltos bruscos que generen conflicto con los propietarios. Usá los números concretos del consorcio. Montos en pesos argentinos (ARS), enteros.

Entregá el resultado con la herramienta provista: entre 3 y 5 recomendaciones ordenadas por prioridad. tipo: alert=riesgo alto, warn=atención, good=situación positiva, tip=oportunidad de mejora.`;

const TOOL = {
  name: 'entregar_recomendaciones',
  description: 'Entrega la expensa sugerida y las recomendaciones financieras del consorcio.',
  input_schema: {
    type: 'object',
    properties: {
      expensa: {
        type: 'object',
        properties: {
          monto: { type: 'number', description: 'Entero ARS a emitir el próximo período' },
          deltaPct: { type: 'number', description: 'Variación % vs la cobranza mensual actual' },
          razonamiento: { type: 'string', description: '2 a 3 oraciones explicando el monto' }
        },
        required: ['monto', 'deltaPct', 'razonamiento']
      },
      recomendaciones: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['alert', 'warn', 'good', 'tip'] },
            titulo: { type: 'string' },
            detalle: { type: 'string' },
            tag: { type: 'string' }
          },
          required: ['tipo', 'titulo', 'detalle', 'tag']
        }
      }
    },
    required: ['expensa', 'recomendaciones']
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido. Usá POST.' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel.' });

  try {
    const datos = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'entregar_recomendaciones' },
        messages: [{ role: 'user', content: 'Datos financieros del consorcio:\n' + JSON.stringify(datos, null, 2) }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      const msg = data && data.error && data.error.message ? data.error.message : 'Error de la API de Claude';
      return res.status(apiRes.status).json({ error: msg, detail: data });
    }

    const toolUse = (data.content || []).find(b => b.type === 'tool_use');
    const parsed = toolUse ? toolUse.input : null;
    if (!parsed || !parsed.expensa) {
      return res.status(502).json({ error: 'El modelo no devolvió recomendaciones.', stop_reason: data.stop_reason, detail: data.content });
    }
    if (!Array.isArray(parsed.recomendaciones)) parsed.recomendaciones = [];
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Fallo al generar recomendaciones', detail: String(err && err.message || err) });
  }
};
