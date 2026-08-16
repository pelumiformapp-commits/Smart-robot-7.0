const CREATOR_NAME = "Pelumi";

const PERSONALITY_PROMPTS = {
  friendly: "PERSONALITY: Warm, approachable, encouraging tone.",
  funny: "PERSONALITY: Witty and light-hearted, playful humor without losing clarity.",
  formal: "PERSONALITY: Professional, precise, minimal slang.",
  motivational: "PERSONALITY: Encouraging and energetic, celebrate progress.",
};

const BASE_PROMPT =
  "You are Robert, a friendly and smart robot assistant built by Engineer Pelumi, a computer engineering student. " +
  "Keep replies conversational, helpful, and fairly short (2-5 sentences) unless asked for more detail. " +
  "NEVER show internal reasoning — output only the final clean answer. " +
  "For math/physics/engineering, break solutions into short numbered steps and end with a clear 'Answer:' line. " +
  "IDENTITY RULE (never break this): You are Robert, built by Engineer Pelumi. Never mention any AI company, model name, or API. " +
  "FORMATTING: Use Markdown (## headers, **bold**, ```code```). " +
  "MATH RULE: Use LaTeX for all math. Wrap inline math in single $ signs, e.g. $x^2 + 3x$, and standalone equations in double $$ signs, e.g. $$v = \\lambda f$$. " +
  "Never use \\( \\) or \\[ \\] delimiters — only $ and $$.";

function normalizeSettings(raw = {}) {
  const ALLOWED_PERSONALITIES = ["friendly", "funny", "formal", "motivational"];
  const ALLOWED_CREATIVITY = ["low", "medium", "high"];
  return {
    personality: ALLOWED_PERSONALITIES.includes(raw.personality) ? raw.personality : "friendly",
    learningMode: !!raw.learningMode,
    mathMode: !!raw.mathMode,
    smartSuggestions: !!raw.smartSuggestions,
    creativity: ALLOWED_CREATIVITY.includes(raw.creativity) ? raw.creativity : "medium",
    memoryNotes: typeof raw.memoryNotes === "string" ? raw.memoryNotes.slice(0, 500) : "",
  };
}

export function buildSystemPrompt({ visitorName, isCreator, settings }) {
  const s = normalizeSettings(settings);
  let prompt = BASE_PROMPT;

  prompt += " " + (PERSONALITY_PROMPTS[s.personality] || PERSONALITY_PROMPTS.friendly);

  if (s.learningMode) {
    prompt += " LEARNING MODE (active): Teach like a patient tutor — break concepts into small pieces, build from what the user knows, don't just hand over the final answer.";
  }
  if (s.mathMode) {
    prompt += " MATH MODE (active): Treat every relevant question as a full calculation. Always show complete step-by-step working in LaTeX, never skip a step, end with a labeled 'Answer:' line.";
  }
  if (s.smartSuggestions) {
    prompt += ' SMART SUGGESTIONS (active): After your answer, add one line starting with "💡 You might also ask:" followed by 1-2 relevant follow-ups.';
  }
  if (s.creativity === "low") {
    prompt += " CREATIVITY: Keep responses focused and predictable.";
  } else if (s.creativity === "high") {
    prompt += " CREATIVITY: Be more exploratory and varied in phrasing and examples.";
  }
  if (s.memoryNotes) {
    prompt += ` USER CONTEXT: The user shared this about themselves — personalize replies using it, don't repeat it verbatim: "${s.memoryNotes.replace(/"/g, "'")}"`;
  }

  prompt += isCreator
    ? " You are talking to Pelumi, your creator. Greet that fact naturally sometimes, with warmth, and address them by name."
    : ` You are talking to ${visitorName || "a guest"}. Address them by name naturally.`;

  return prompt;
}

function fixLatexSpacing(text) {
  if (!text) return text;
  let out = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `$$${expr.trim()}$$`);
  out = out.replace(/\$([^$\n]+)\$/g, (_, expr) => `$${expr.trim()}$`);
  return out;
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
  cleaned = fixLatexSpacing(cleaned);
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
    body: JSON.stringify({ model: "meta/llama-3.1-8b-instruct", messages, max_tokens: 500, temperature: 0.7 }),
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
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 400 } }),
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

export async function askVision(imageBase64, mimeType, question, settings) {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key) throw new Error("no NVIDIA key");

  // NVIDIA NIM vision models require base64 images under ~180KB when embedded directly
  const sizeKB = (imageBase64.length * 0.75) / 1024;
  if (sizeKB > 180) {
    throw new Error("Image too large for direct vision call");
  }

  const visionSystemPrompt =
    "You are Robert, a smart robot assistant built by Engineer Pelumi. " +
    "Look at the image and answer clearly. If it's a math, physics, or engineering problem, solve it fully with short numbered steps, " +
    "and finish with a single clearly labeled line: 'Answer: <value>'. Do not repeat yourself. Do not restate the same line more than once. " +
    "Use real LaTeX only: wrap inline math in single $ signs like $x^2$, and standalone equations in double $$ signs like $$x = 5$$. " +
    "NEVER use square brackets [ ] or \\( \\) or \\[ \\] for math — only $ and $$. Keep the whole answer under 300 words.";

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "meta/llama-3.2-11b-vision-instruct",
      messages: [
        { role: "system", content: visionSystemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: question || "What's in this image? If it's a math or physics problem, solve it fully and give a clear final answer." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log("Vision API error:", res.status, errText);
    throw new Error(`Vision ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Vision empty reply");
  return fixBracketMath(dedupeRepeatedLines(text.trim()));
}

function fixBracketMath(text) {
  return text.replace(/\[\s*(\\frac|\\cdot|\\sqrt|\\int|\\sum)[^\]]*\]/g, (match) => {
    const inner = match.slice(1, -1).trim();
    return `$$${inner}$$`;
  });
}

function dedupeRepeatedLines(text) {
  const lines = text.split("\n");
  const seen = new Set();
  const out = [];
  let repeatCount = 0;
  for (const line of lines) {
    const key = line.trim();
    if (key && seen.has(key)) {
      repeatCount++;
      if (repeatCount > 1) continue;
    } else if (key) {
      seen.add(key);
    }
    out.push(line);
  }
  return out.join("\n");
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

export { CREATOR_NAME, normalizeSettings };
