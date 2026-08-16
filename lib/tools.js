import { evaluate } from "mathjs";

// Detects "calculate 12*7+3", "what is 45/9", "solve 2+2*3", etc.
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
    const rounded = Math.round(result * 1e10) / 1e10;
    return rounded;
  } catch (e) {
    return null;
  }
}

// Detects "summarize: <text>" or "summarize this: <text>"
const SUMMARIZE_TRIGGER = /^summarize\s*(?:this)?:?\s*([\s\S]+)/i;

function detectSummarize(message) {
  const match = message.match(SUMMARIZE_TRIGGER);
  return match ? match[1].trim() : null;
}

// Detects "translate <text> to <language>"
const TRANSLATE_TRIGGER = /^translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z\s]+)$/i;

function detectTranslate(message) {
  const match = message.match(TRANSLATE_TRIGGER);
  if (!match) return null;
  return { text: match[1].trim(), targetLanguage: match[2].trim() };
}

export { detectCalculation, runCalculation, detectSummarize, detectTranslate };
