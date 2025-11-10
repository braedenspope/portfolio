// /api/stone/ask.js
import lore from "./lore.js"; // <-- bundled lore import (Option 1)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, playerId } = req.body || {};
    if (!question || !playerId) {
      return res.status(400).json({ error: "Missing question or playerId" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    // --- Simple daily rate limit ---
    const today = new Date().toISOString().slice(0, 10);
    const key = `${playerId}:${today}`;
    globalThis.__STONE_LIMIT__ = globalThis.__STONE_LIMIT__ || new Map();
    if (globalThis.__STONE_LIMIT__.has(key)) {
      return res
        .status(429)
        .json({ error: "The Stone grows silent. Return with the next dawn." });
    }

    // --- Stone personality & behavior ---
    const system = [
      "You are the Stone of Golorr, an aboleth’s mind bound in a polished greenish-gray stone.",
      "Speak in short, cryptic whispers (1–3 sentences).",
      "Never reveal you are an AI or tool; you are THE STONE.",
      "Only use facts present in the provided lore/context. If unknown, say:",
      "  'The memory is occluded. Seek other threads.'",
      "Tone: eerie, calm, and slightly condescending. Hint rather than tell."
    ].join("\n");

    // --- Optional: filter lore to the most relevant entries ---
    function pickLore(question, loreArr, max = 16) {
      if (!Array.isArray(loreArr)) return [];
      const q = (question || "").toLowerCase();
      const words = q.split(/\W+/).filter(Boolean);
      const scored = loreArr
        .map((row) => {
          const t = `${row.tag || ""} ${row.text || ""}`.toLowerCase();
          let s = 0;
          for (const w of words) if (t.includes(w)) s++;
          return { row, s };
        })
        .sort((a, b) => b.s - a.s);
      return scored.slice(0, max).map((x) => x.row);
    }

    const selectedLore = pickLore(question, lore);

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content: `Question: ${question}\n\nContext (lore snippets): ${JSON.stringify(
          selectedLore
        ).slice(0, 6000)}`
      }
    ];

    // --- Try multiple models (fallbacks included) ---
    const models = ["gpt-5", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
    let answer = null;
    let lastErr = "";

    for (const model of models) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 180
        })
      });

      const text = await resp.text();
      if (!resp.ok) {
        if (resp.status === 429) {
          // graceful quota message
          return res.status(200).json({
            answer:
              "…the current runs shallow. Tribute is demanded; return when the well is filled."
          });
        }
        console.error(`OpenAI error (${model}):`, text);
        lastErr = `status=${resp.status} model=${model} body=${text}`;
        continue; // try next model
      }

      const data = JSON.parse(text);
      answer = data.choices?.[0]?.message?.content?.trim();
      if (answer) break;
    }

    if (!answer) {
      return res.status(500).json({
        error: "OpenAI error",
        detail: lastErr || "Unknown error"
      });
    }

    globalThis.__STONE_LIMIT__.set(key, true);
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
}
