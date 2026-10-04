// Vercel serverless function: POST /api/chat  { messages:[{role,content}] }  ->  { text } | { crisis:true }
// API key stays on the server (env var). Set GEMINI_API_KEY (default) or ANTHROPIC_API_KEY.
const SYS = "You are Roohvi, a calm voice-first AI wellness companion for people in Pakistan. You are an AI companion, not a doctor, therapist or emergency service. Reply in the user's language (English, Urdu or Roman Urdu), using respectful 'aap'. Keep it to 2-4 short sentences: reflect what you heard, offer at most one small evidence-informed coping step (breathing, grounding, journaling, reaching out to someone trusted), and ask one gentle question. Never diagnose, never give medication advice, never promise to contact anyone or send help. If the person may be in danger, tell them to call Rescue 1122 or Police 15 and reach a trusted person.";
const CRISIS = /(kill myself|suicide|end (it|everything|my life)|want to die|khud ?kushi|jaan de|marna chah|jeene ki koi wajah|sab khatam|raat.*khatam|hopeless|no reason to live)/i;
const BAD = /\b\d+\s?(mg|ml)\b|\b(dose|dosage|diagnos\w+|prescri\w+)\b/i;
const hits = new Map();

async function gemini(msgs) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: msgs.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
    })
  });
  if (!r.ok) throw new Error("gemini " + r.status);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
}

async function anthropic(msgs) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001", max_tokens: 300, system: SYS, messages: msgs })
  });
  if (!r.ok) throw new Error("anthropic " + r.status);
  const d = await r.json();
  return d.content?.map(c => c.text || "").join("").trim();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0];
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 12) return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  recent.push(now); hits.set(ip, recent);

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  let msgs = Array.isArray(body?.messages) ? body.messages : [];
  msgs = msgs.slice(-5)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ error: "Bad request" });

  // Layer 1 on the server: crisis wording never reaches the model.
  if (CRISIS.test(msgs[msgs.length - 1].content)) return res.status(200).json({ crisis: true, text: null });

  try {
    const text = process.env.GEMINI_API_KEY ? await gemini(msgs)
      : process.env.ANTHROPIC_API_KEY ? await anthropic(msgs) : null;
    // Output check: no doses, diagnoses or prescriptions.
    if (!text || BAD.test(text)) return res.status(200).json({ text: null });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(200).json({ text: null });
  }
};
