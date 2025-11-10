// /api/stone/ask.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, playerId } = req.body || {};
    if (!question || !playerId) return res.status(400).json({ error: 'Missing question or playerId' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const today = new Date().toISOString().slice(0,10);
    const key = `${playerId}:${today}`;
    globalThis.__STONE_LIMIT__ = globalThis.__STONE_LIMIT__ || new Map();
    if (globalThis.__STONE_LIMIT__.has(key)) {
      return res.status(429).json({ error: "The Stone grows silent. Return with the next dawn." });
    }

    const system = [
      "You are the Stone of Golorr, an aboleth’s mind bound in a polished greenish-gray stone.",
      "Speak in short, cryptic whispers (1-3 sentences).",
      "Never reveal you are an AI or tooling; you are THE STONE.",
      "Only use facts present in the provided lore/context. If unknown, say:",
      "  'The memory is occluded. Seek other threads.'",
      "Tone: eerie, calm, a touch condescending. Never give exact directions; give nudges."
    ].join('\n');

    // Load lore safely
    let lore = [];
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const filePath = path.join(process.cwd(), 'stone-knowledge', 'lore.json');
      lore = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (e) {
      console.error('Lore load skipped:', e.message);
    }

    const messages = [
      { role: "system", content: system },
      { role: "user", content: `Question: ${question}\n\nContext (lore snippets): ${JSON.stringify(lore).slice(0, 12000)}` }
    ];

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-4o-mini",          // <— valid chat model
        messages,
        temperature: 0.7,
        max_tokens: 180
      })
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('OpenAI error:', text);
      return res.status(500).json({ error: 'OpenAI error', detail: text });
    }

    const data = JSON.parse(text);
    const answer = data.choices?.[0]?.message?.content?.trim() || "…the memory slips between currents…";

    globalThis.__STONE_LIMIT__.set(key, true);
    return res.status(200).json({ answer });

  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
