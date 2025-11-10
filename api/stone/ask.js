// /api/stone/ask.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, playerId } = req.body || {};
    if (!question || !playerId) return res.status(400).json({ error: 'Missing question or playerId' });

    // 1) Rate limit: one whisper per calendar day per player
    // Simple memory: Vercel functions are stateless; use a lightweight KV (upstash), 
    // or for a quick start, sign the timestamp into a JWT you return to the client 
    // (the client sends it back and you validate/rotate daily).
    // To keep this guide self-contained, we’ll do a simple UTC date lock via a signed cookie:
    // In production, consider an external store (KV/Redis) for reliability.

    const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    const key = `${playerId}:${today}`;
    // naive in-memory map (works locally). Replace with KV or a small sqlite/db if needed.
    globalThis.__STONE_LIMIT__ = globalThis.__STONE_LIMIT__ || new Map();
    if (globalThis.__STONE_LIMIT__.has(key)) {
      return res.status(429).json({ error: "The Stone grows silent. Return with the next dawn." });
    }

    // --- Build prompt ---
    const system = [
      "You are the Stone of Golorr, an aboleth’s mind bound in a polished greenish-gray stone.",
      "Speak in short, cryptic whispers (1-3 sentences).",
      "Never reveal you are an AI or tooling; you are THE STONE.",
      "Only use facts present in the provided lore/context. If unknown, say something oblique like:",
      "  'The memory is occluded. Seek other threads.'",
      "Tone: eerie, calm, a touch condescending. Never give exact directions; give nudges."
    ].join('\n');

    // Optional: load curated lore snippets (see section 4)
    let lore = [];
    try {
      const origin = req.headers['x-vercel-deployment-url'] 
        ? `https://${req.headers['x-vercel-deployment-url']}`
        : '';
      // In Vercel functions, reading local files is fine; use fs if you commit lore.json.
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(process.cwd() + '/stone-knowledge/lore.json','utf8');
      lore = JSON.parse(raw);
    } catch (_) { /* no lore yet */ }

    // Compose messages (Responses API or chat-style messages).
    // Here we keep it simple with chat-style messages:
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `Question: ${question}\n\nContext (lore snippets): ${JSON.stringify(lore).slice(0, 12000)}` }
    ];

    // Call OpenAI (use the official JS SDK in prod; fetch works too).
    const apiKey = process.env.OPENAI_API_KEY;
    const resp = await fetch('https://api.openai.com/v1/chat/completions', { // or /v1/responses per latest guides
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-5-reasoning", // pick your model
        messages,
        temperature: 0.7,
        max_tokens: 180
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ error: 'OpenAI error', detail: text });
    }

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "…the memory slips between currents…";

    globalThis.__STONE_LIMIT__.set(key, true);
    return res.status(200).json({ answer });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
