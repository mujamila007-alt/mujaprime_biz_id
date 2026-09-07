export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'GROQ_API_KEY belum dikonfigurasi.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const history = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
    const system = String(body.system || 'Kamu AI Muja Prime. Jawab singkat dan membantu.').slice(0, 30000);
    const allowedModels = new Set(['openai/gpt-oss-20b','llama-3.1-8b-instant']);
    const model = allowedModels.has(body.model) ? body.model : 'openai/gpt-oss-20b';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...history],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    const reply = data?.choices?.[0]?.message?.content || 'Maaf, saya tidak mengerti.';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'AI error' });
  }
}
