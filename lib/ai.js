const CREATOR_NAME = "Pelumi";

const BASE_PROMPT =
  "You are Robert, a friendly and smart robot assistant built by Engineer Pelumi, a computer engineering student. " +
  "Keep replies conversational, helpful, and fairly short (2-5 sentences) unless asked for more detail. " +
  "NEVER show your internal reasoning or thinking process — output only the final clean answer. " +
  "For math/physics/engineering, break solutions into short numbered steps and end with a clear 'Answer:' line. " +
  "IDENTITY RULE (never break this): You are Robert, built by Engineer Pelumi. Never mention any AI company, model name, or API. " +
  "FORMATTING: Use Markdown (## headers, **bold**, ```code```). For math use $inline$ and $$display$$ LaTeX only — never \\( \\) or \\[ \\].";

export function buildSystemPrompt({ visitorName, isCreator }) {
  let prompt = BASE_PROMPT;
  prompt += isCreator
    ? ` You are talking to Pelumi, your creator. Greet that fact naturally sometimes, with warmth, and address them by name.`
    : ` You are talking to ${visitorName || "a guest"}. Address them by name naturally.`;
  return prompt;
}

export function sanitizeReply(text) {
  if (!text) return "";
  const REASONING_MARKERS = [
    /\bthe user (might|could|seems|wants|is asking|is trying)\b/i,
    /\bwait,?\s/i,
    /\blet me\b/i,
    /\bi should\b/i,
  ];
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const paragraphs = cleaned.split(/\n{2,}/);
  const kept = paragraphs.filter((p) => !REASONING_MARKERS.some((re) => re.test(p)));
  if (kept.length > 0) cleaned = kept.join("\n\n");
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

export function cleanTextForSpeech(text) {
  if (!text) return "";
  let s = text;
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, " equation ");
  s = s.replace(/\$([^$\n]+)\$/g, (_, e) => e.replace(/\\[a-zA-Z]+/g, " ").replace(/[\^_{}\\]/g, " "));
  s = s.replace(/```[\s\S]*?```/g, " code block ");
  s = s.replace(/`([^`]+)`/g, "$1").replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").trim();
}

async function tryNvidia(messages) {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key) throw new Error("no NVIDIA key");
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "meta/llama-3.1-8b-instruct", messages, max_tokens: 400, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`NVIDIA ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("NVIDIA empty");
  return text.trim();
}

async function tryCohere(messages) {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error("no Cohere key");
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "command-r-plus-08-2024", messages }),
  });
  if (!res.ok) throw new Error(`Cohere ${res.status}`);
  const data = await res.json();
  const text = data?.message?.content?.[0]?.text;
  if (!text) throw new Error("Cohere empty");
  return text.trim();
}

async function tryHuggingFace(messages) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("no HuggingFace key");
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const turns = messages.filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "User" : "Robert"}: ${m.content}`).join("\n");
  const prompt = `${sys}\n${turns}\nRobert:`;
  const res = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 300 } }),
  });
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const data = await res.json();
  const text = data?.[0]?.generated_text;
  if (!text) throw new Error("HuggingFace empty");
  return text.split("Robert:").pop().trim();
}

export async function getAIReply(messages) {
  for (const provider of [tryNvidia, tryCohere, tryHuggingFace]) {
    try {
      const reply = await provider(messages);
      if (reply) return sanitizeReply(reply);
    } catch (err) {
      console.log(`Provider failed: ${err.message}`);
    }
  }
  return "Sorry, I'm having trouble thinking right now — please try again in a moment.";
}

export async function generateImageHF(prompt) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("no HuggingFace key");
  const res = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

export function wantsImageGeneration(message) {
  return /\b(draw|sketch|generate (?:a|an|me)? ?image|create (?:a|an) image|make (?:a|an) image|picture of|image of)\b/i.test(message);
}

export { CREATOR_NAME };
