// ============================================================
//  Ágora · Función serverless (Vercel) — Recomendaciones IA
// ============================================================
//  Recibe los datos financieros del consorcio y pide a Claude,
//  actuando como asesor financiero experto, la expensa a emitir
//  y recomendaciones accionables. La API key vive solo acá.
// ============================================================

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const SYSTEM = `Sos un asesor financiero senior especializado en administración de consorcios en Argentina, en un contexto inflacionario. Analizás el flujo de caja de un consorcio y producís (1) la expensa a emitir el próximo período y (2) recomendaciones financieras accionables.

Criterios: cubrir los egresos proyectados, mantener un colchón de reserva prudente, contemplar la morosidad, anticipar gastos crecientes y evitar saltos bruscos que generen conflicto con los propietarios. Usá los números concretos del consorcio. Montos en pesos argentinos (ARS), enteros.

Respondé EXCLUSIVAMENTE con un JSON válido, sin texto adicional ni backticks, con esta forma exacta:
{
  "expensa": {
    "monto": <entero ARS que conviene emitir el próximo período>,
    "deltaPct": <variación porcentual vs la cobranza mensual actual, número con un decimal>,
    "razonamiento": "<2 a 3 oraciones explicando, como experto, por qué ese monto>"
  },
  "recomendaciones": [
    { "tipo": "alert|warn|good|tip", "titulo": "<título breve>", "detalle": "<1 a 2 oraciones con números concretos>", "tag": "<Liquidez|Cobranza|Optimización|Reserva|Egresos>" }
  ]
}
Devolvé entre 3 y 5 recomendaciones ordenadas por prioridad. Usá "tipo": alert=riesgo alto, warn=atención, good=situación positiva, tip=oportunidad de mejora.`;

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) {}
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch (_) {} }
  return null;
}

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
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: 'user', content: 'Datos financieros del consorcio:\n' + JSON.stringify(datos, null, 2) }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: 'Error de la API de Claude', detail: data });

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = extractJSON(text);
    if (!parsed || !parsed.expensa) {
      return res.status(502).json({ error: 'No se pudo interpretar la respuesta del modelo.', raw: text.slice(0, 2000) });
    }
    if (!Array.isArray(parsed.recomendaciones)) parsed.recomendaciones = [];
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Fallo al generar recomendaciones', detail: String(err && err.message || err) });
  }
};
