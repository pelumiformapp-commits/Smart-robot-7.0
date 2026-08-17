import { evaluate } from "mathjs";

const CALC_TRIGGER = /^(calculate|calc|what'?s|what is|solve)\s+(.+)/i;
const MATH_EXPR = /^[\d\s+\-*/^%().]+$/;

function detectCalculation(message) {
  const trimmed = message.trim();
  const triggerMatch = trimmed.match(CALC_TRIGGER);
  const expr = triggerMatch ? triggerMatch[2] : trimmed;
  const cleaned = expr.replace(/\?$/, "").trim();

  if (MATH_EXPR.test(cleaned) && /\d/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function runCalculation(expr) {
  try {
    const result = evaluate(expr);
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 1e10) / 1e10;
  } catch (e) {
    return null;
  }
}

const SUMMARIZE_TRIGGER = /^summarize\s*(?:this)?:?\s*([\s\S]+)/i;

function detectSummarize(message) {
  const match = message.match(SUMMARIZE_TRIGGER);
  return match ? match[1].trim() : null;
}

const TRANSLATE_TRIGGER = /^translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z\s]+)$/i;

function detectTranslate(message) {
  const match = message.match(TRANSLATE_TRIGGER);
  if (!match) return null;
  return { text: match[1].trim(), targetLanguage: match[2].trim() };
}

// Lightweight, no-extra-API-call fact spotting: catches common self-descriptive
// phrases so Robert can remember them across sessions without a separate LLM pass.
const FACT_TRIGGERS = [
  // identity / education
  /\bmy name is [^.,!?\n]{2,40}/i,
  /\bi'?m (?:studying|majoring in) [^.,!?\n]{2,60}/i,
  /\bi study [^.,!?\n]{2,60}/i,
  /\bi work (?:as|at) [^.,!?\n]{2,60}/i,
  /\bmy (?:course|major) is [^.,!?\n]{2,60}/i,
  /\bmy level is [^.,!?\n]{2,20}/i,
  /\bi'?m (?:in|at) \d{3}\s?level/i,
  /\bmy school is [^.,!?\n]{2,60}/i,
  /\bi (?:go to|attend|study at) [^.,!?\n]{2,60}/i,

  // location
  /\bi'?m from [^.,!?\n]{2,50}/i,
  /\bi live in [^.,!?\n]{2,50}/i,
  /\bi'?m based in [^.,!?\n]{2,50}/i,

  // age
  /\bi'?m \d{1,2} years? old/i,
  /\bi'?m \d{1,2}(?=\s|$)/i,

  // preferences
  /\bmy favorite [a-z ]{2,20} is [^.,!?\n]{2,40}/i,
  /\bi like [^.,!?\n]{2,60}/i,
  /\bi love [^.,!?\n]{2,60}/i,
  /\bi enjoy [^.,!?\n]{2,60}/i,
  /\bi'?m interested in [^.,!?\n]{2,60}/i,
  /\bi hate [^.,!?\n]{2,60}/i,
  /\bi don'?t like [^.,!?\n]{2,60}/i,
  /\bmy hobby is [^.,!?\n]{2,60}/i,
  /\bmy hobbies (?:are|include) [^.,!?\n]{2,60}/i,

  // goals / aspirations
  /\bi want to (?:become|be) [^.,!?\n]{2,60}/i,
  /\bmy (?:goal|dream|plan) is (?:to)? ?[^.,!?\n]{2,60}/i,
  /\bi'?m (?:preparing|studying) for (?:the )?jamb[^.,!?\n]{0,40}/i,
  /\bi'?m preparing for [^.,!?\n]{2,60}/i,
  /\bi hope to [^.,!?\n]{2,60}/i,

  // deadlines / exams
  /\bmy exam is (?:on|in) [^.,!?\n]{2,40}/i,
  /\bmy (?:test|exam|deadline) is [^.,!?\n]{2,40}/i,
];

function extractFacts(message) {
  if (!message) return [];
  const facts = [];
  for (const re of FACT_TRIGGERS) {
    const match = message.match(re);
    if (match && match[0].length <= 120) facts.push(match[0].trim());
  }
  return facts;
}

// Merges newly spotted facts into the stored fact string, deduping near-identical
// lines and keeping the total under a sane size so the prompt doesn't balloon.
function mergeFacts(existing, newFacts, maxLength = 900) {
  const existingList = existing ? existing.split("; ").filter(Boolean) : [];
  const combined = [...existingList];
  for (const fact of newFacts) {
    const alreadyKnown = combined.some((f) => f.toLowerCase() === fact.toLowerCase());
    if (!alreadyKnown) combined.push(fact);
  }
  let result = combined.join("; ");
  while (result.length > maxLength && combined.length > 1) {
    combined.shift();
    result = combined.join("; ");
  }
  return result;
}

export { detectCalculation, runCalculation, detectSummarize, detectTranslate, extractFacts, mergeFacts };
