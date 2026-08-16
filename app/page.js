"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function getSessionId() {
  let id = localStorage.getItem("robert_session_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("robert_session_id", id);
  }
  return id;
}

function isWalkCommand(text) {
  const t = text.toLowerCase();
  return t.includes("walk") || t.includes("move") || t.includes("step forward");
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("robert_settings");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    personality: "friendly",
    learningMode: false,
    mathMode: false,
    smartSuggestions: false,
    creativity: "medium",
    memoryNotes: "",
  };
}

function loadAppearance() {
  if (typeof window === "undefined") return { theme: "dark", accent: "#5e81ac" };
  return {
    theme: localStorage.getItem("robert_theme") || "dark",
    accent: localStorage.getItem("robert_accent_color") || "#5e81ac",
  };
}

function loadVoiceSettings() {
  try {
    const raw = localStorage.getItem("robert_voice_settings");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { rate: 1, pitch: 1, voiceURI: "" };
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateLabel(iso) {
  const d = new Date(iso || Date.now());
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function groupWithDateSeparators(msgs) {
  const out = [];
  let lastLabel = null;
  msgs.forEach((m) => {
    const label = formatDateLabel(m.time);
    if (label !== lastLabel) {
      out.push({ type: "separator", id: "sep-" + label + "-" + m.id, label });
      lastLabel = label;
    }
    out.push({ type: "message", data: m });
  });
  return out;
}

const FONT_SIZES = [13, 14, 15, 16, 18];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const QUICK_REPLIES = ["Explain more", "Show an example", "Simplify this"];

export default function ChatPage() {
  const [visitorName, setVisitorName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [talking, setTalking] = useState(false);
  const [walking, setWalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [appearance, setAppearance] = useState({ theme: "dark", accent: "#5e81ac" });
  const [fontIndex, setFontIndex] = useState(1);
  const [autoTalk, setAutoTalk] = useState(true);
  const [pins, setPins] = useState({});
  const [reactions, setReactions] = useState({});
  const [pickerFor, setPickerFor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({ rate: 1, pitch: 1, voiceURI: "" });
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("robert_visitor_name");
    if (saved) setVisitorName(saved);
    setAppearance(loadAppearance());

    const savedFont = parseInt(localStorage.getItem("robert_font_index"), 10);
    if (!isNaN(savedFont) && savedFont >= 0 && savedFont < FONT_SIZES.length) setFontIndex(savedFont);

    setAutoTalk(localStorage.getItem("robert_autotalk") !== "false");
    setVoiceSettings(loadVoiceSettings());

    try {
      setPins(JSON.parse(localStorage.getItem("robert_pins") || "{}"));
      setReactions(JSON.parse(localStorage.getItem("robert_reactions") || "{}"));
    } catch (e) {}

    if ("speechSynthesis" in window) {
      const populateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, []);

  // Load persisted chat history for this session once we know who's visiting
  useEffect(() => {
    if (!visitorName || historyLoaded) return;
    try {
      const key = "robert_messages_" + getSessionId();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch (e) {}
    setHistoryLoaded(true);
  }, [visitorName, historyLoaded]);

  // Persist chat history whenever messages change (after initial load)
  useEffect(() => {
    if (!visitorName || !historyLoaded) return;
    try {
      const key = "robert_messages_" + getSessionId();
      // strip blob preview URLs — they don't survive reload anyway
      const toStore = messages.map(({ previewImage, ...rest }) => rest);
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch (e) {}
  }, [messages, visitorName, historyLoaded]);

  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchOpen]);

  function saveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    localStorage.setItem("robert_visitor_name", nameInput.trim());
    setVisitorName(nameInput.trim());

    const hideGreeting = localStorage.getItem("robert_hide_greeting") === "true";
    if (!hideGreeting) {
      const template = localStorage.getItem("robert_welcome_message") || "Hi [Username]! I'm Robert. Ask me anything.";
      const greeting = template.replace(/\[Username\]/g, nameInput.trim());
      setMessages([{ id: "m0", role: "assistant", content: greeting, time: new Date().toISOString() }]);
    }
  }

  function triggerWalk() {
    setWalking(true);
    setTimeout(() => setWalking(false), 2200);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImage(file, maxWidth = 1000, useJpeg = true, quality = 0.85) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const format = useJpeg ? "image/jpeg" : "image/png";
        canvas.toBlob(
          (blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: reader.result.split(",")[1], mimeType: format });
            reader.readAsDataURL(blob);
          },
          format,
          useJpeg ? quality : undefined
        );
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function nextId() {
    return "m" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  }

  function speak(text) {
    if (!autoTalk || !text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    if (voiceSettings.voiceURI) {
      const match = availableVoices.find((v) => v.voiceURI === voiceSettings.voiceURI);
      if (match) utterance.voice = match;
    }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function updateVoiceSetting(patch) {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("robert_voice_settings", JSON.stringify(next));
      return next;
    });
  }

  function markDelivered(id) {
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "delivered" } : m)));
    }, 350);
  }

  function markSeen(id) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "seen" } : m)));
  }

  async function fetchReply(message, history) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        visitorName,
        sessionId: getSessionId(),
        settings: loadSettings(),
      }),
    });
    return res.json();
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    if (isWalkCommand(input)) triggerWalk();

    if (editingId) {
      const idx = messages.findIndex((m) => m.id === editingId);
      const updatedMsg = {
        ...messages[idx],
        content: input,
        time: new Date().toISOString(),
        status: "sent",
        edited: true,
      };
      const trimmed = [...messages.slice(0, idx), updatedMsg];
      setMessages(trimmed);
      setInput("");
      setEditingId(null);
      setLoading(true);
      setTalking(true);
      markDelivered(updatedMsg.id);

      const data = await fetchReply(updatedMsg.content, trimmed.slice(0, -1));
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: data.reply, time: new Date().toISOString(), image: data.generatedImage || null },
      ]);
      markSeen(updatedMsg.id);
      setLoading(false);
      setTalking(false);
      setShowQuickReplies(true);
      speak(data.speechText || data.reply);
      return;
    }

    const userMsg = { id: nextId(), role: "user", content: input, time: new Date().toISOString(), status: "sent" };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setTalking(true);
    setShowQuickReplies(false);
    markDelivered(userMsg.id);

    const data = await fetchReply(userMsg.content, messages);

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "assistant", content: data.reply, time: new Date().toISOString(), image: data.generatedImage || null },
    ]);
    markSeen(userMsg.id);
    setLoading(false);
    setTalking(false);
    setShowQuickReplies(true);
    speak(data.speechText || data.reply);
  }

  async function sendQuickReply(text) {
    setShowQuickReplies(false);
    const userMsg = { id: nextId(), role: "user", content: text, time: new Date().toISOString(), status: "sent" };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    setTalking(true);
    markDelivered(userMsg.id);

    const data = await fetchReply(text, messages);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "assistant", content: data.reply, time: new Date().toISOString(), image: data.generatedImage || null },
    ]);
    markSeen(userMsg.id);
    setLoading(false);
    setTalking(false);
    setShowQuickReplies(true);
    speak(data.speechText || data.reply);
  }

  async function handleDocUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (data.text) {
        setInput((prev) => `${prev}\n\n[Document: ${file.name}]\n${data.text}`.trim());
      } else {
        alert(data.error || "Could not read that file.");
      }
    } catch (err) {
      alert("Upload failed.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const { base64, mimeType } = await compressImage(file);
    const userMsg = {
      id: nextId(),
      role: "user",
      content: `[Sent an image: ${file.name}]`,
      previewImage: URL.createObjectURL(file),
      time: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTalking(true);
    markDelivered(userMsg.id);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input || "What's in this image? If it's a problem, solve it step by step.",
          history: messages,
          visitorName,
          sessionId: getSessionId(),
          settings: loadSettings(),
          image: { data: base64, mimeType },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: errData.reply || "Sorry, that took too long — please try a smaller or clearer photo.",
            time: new Date().toISOString(),
          },
        ]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: data.reply, time: new Date().toISOString() }]);
      markSeen(userMsg.id);
      speak(data.speechText || data.reply);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: "Sorry, something went wrong reading that image. Please try again.", time: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
      setTalking(false);
      setInput("");
      e.target.value = "";
    }
  }

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported on this browser.");
      return;
    }
    if (listening) {
      window._robertRecognition?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    window._robertRecognition = recognition;
    recognition.start();
  }

  function toggleAutoTalk() {
    const next = !autoTalk;
    setAutoTalk(next);
    localStorage.setItem("robert_autotalk", next.toString());
    if (!next) stopSpeaking();
  }

  function clearChat() {
    if (confirm("Clear this conversation? This can't be undone.")) {
      setMessages([]);
      try {
        localStorage.removeItem("robert_messages_" + getSessionId());
      } catch (e) {}
    }
  }

  function changeFont(delta) {
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIndex + delta));
    setFontIndex(next);
    localStorage.setItem("robert_font_index", next.toString());
  }

  function toggleTheme() {
    const next = appearance.theme === "light" ? "dark" : "light";
    setAppearance((prev) => ({ ...prev, theme: next }));
    localStorage.setItem("robert_theme", next);
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function togglePin(id, text) {
    setPins((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = text.length > 60 ? text.slice(0, 60) + "…" : text;
      localStorage.setItem("robert_pins", JSON.stringify(next));
      return next;
    });
  }

  function setReaction(id, emoji) {
    setReactions((prev) => {
      const next = { ...prev };
      if (next[id] === emoji) delete next[id];
      else next[id] = emoji;
      localStorage.setItem("robert_reactions", JSON.stringify(next));
      return next;
    });
    setPickerFor(null);
  }

  function exportChat() {
    const lines = [`Chat with Robert — exported ${new Date().toLocaleString()}`, ""];
    messages.forEach((m) => {
      const sender = m.role === "user" ? visitorName || "You" : "Robert";
      if (m.content) lines.push(`${sender} (${formatTime(m.time)}): ${m.content}`, "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `robert-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function startEdit(id, content) {
    setEditingId(id);
    setInput(content);
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
  }

  function deleteMessage(id) {
    if (!confirm("Delete this message?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setPins((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      localStorage.setItem("robert_pins", JSON.stringify(next));
      return next;
    });
    setReactions((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      localStorage.setItem("robert_reactions", JSON.stringify(next));
      return next;
    });
    if (editingId === id) cancelEdit();
    if (detailFor === id) setDetailFor(null);
  }

  async function regenerate(assistantId) {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx === -1) return;
    let userIdx = idx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
    if (userIdx < 0) return;

    const userMessage = messages[userIdx];
    const historyBefore = messages.slice(0, userIdx);

    setRegeneratingId(assistantId);
    setLoading(true);
    setTalking(true);

    const data = await fetchReply(userMessage.content, historyBefore);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: data.reply, time: new Date().toISOString(), image: data.generatedImage || null, regenerated: true }
          : m
      )
    );
    setRegeneratingId(null);
    setLoading(false);
    setTalking(false);
    speak(data.speechText || data.reply);
  }

  const pinnedList = Object.entries(pins);
  const visibleMessages = searchQuery.trim()
    ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;
  const groupedMessages = groupWithDateSeparators(visibleMessages);
  const detailMessage = detailFor ? messages.find((m) => m.id === detailFor) : null;

  if (!visitorName) {
    return (
      <div style={styles.center}>
        <h2>What's your name?</h2>
        <form onSubmit={saveName} style={{ display: "flex", gap: 8 }}>
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={styles.input} placeholder="Your name" autoFocus />
          <button type="submit" style={styles.button}>Start</button>
        </form>
      </div>
    );
  }

  const isDark = appearance.theme !== "light";
  const pageBg = isDark ? "#0b141a" : "#eceff4";
  const bubbleAssistantBg = isDark ? "#202c33" : "#e5e9f0";
  const bubbleAssistantColor = isDark ? "#e9edef" : "#2e3440";
  const chatFontSize = FONT_SIZES[fontIndex];

  return (
    <div style={{ ...styles.page, background: pageBg }}>
      <div style={{ ...styles.sidebar, background: isDark ? "#202c33" : "#3b4252" }}>
        <div className={`robot ${talking ? "talking" : "idle"} ${walking ? "walking" : ""}`}>
          <svg viewBox="0 0 160 220" width="70" height="95">
            <rect x="58" y="170" width="14" height="40" rx="4" fill="#3b4252" className="leg-left" />
            <rect x="88" y="170" width="14" height="40" rx="4" fill="#3b4252" className="leg-right" />
            <rect x="40" y="90" width="80" height="85" rx="14" fill="#4c566a" />
            <rect x="55" y="105" width="50" height="30" rx="6" fill="#88c0d0" />
            <rect x="18" y="95" width="16" height="60" rx="8" fill="#3b4252" className="arm-left" />
            <rect x="126" y="95" width="16" height="60" rx="8" fill="#3b4252" className="arm-right" />
            <rect x="72" y="75" width="16" height="18" fill="#3b4252" />
            <rect x="35" y="15" width="90" height="65" rx="20" fill={appearance.accent} />
            <circle cx="62" cy="45" r="8" fill="#eceff4" />
            <circle cx="98" cy="45" r="8" fill="#eceff4" />
            <circle cx="62" cy="45" r="3.5" fill="#2e3440" />
            <circle cx="98" cy="45" r="3.5" fill="#2e3440" />
            <rect x="60" y="62" width="40" height="6" rx="3" fill="#eceff4" className="mouth" />
            <line x1="80" y1="15" x2="80" y2="2" stroke={appearance.accent} strokeWidth="3" />
            <circle cx="80" cy="2" r="4" fill="#a3be8c" className="antenna-light" />
          </svg>
        </div>
        <span style={{ fontSize: 12, color: "#eceff4" }}>Hi, {visitorName}</span>
        <div style={styles.headerBtnRow}>
          <button type="button" onClick={() => changeFont(-1)} title="Smaller text" style={styles.headerIconBtn}>A−</button>
          <button type="button" onClick={() => changeFont(1)} title="Larger text" style={styles.headerIconBtn}>A+</button>
          <button type="button" onClick={toggleTheme} title="Toggle theme" style={styles.headerIconBtn}>{isDark ? "🌙" : "☀️"}</button>
          <button type="button" onClick={toggleAutoTalk} title="Auto-talk" style={{ ...styles.headerIconBtn, background: autoTalk ? appearance.accent : "transparent" }}>🔈</button>
          {speaking && (
            <button type="button" onClick={stopSpeaking} title="Stop speaking" style={{ ...styles.headerIconBtn, background: "#d9534f" }}>⏹️</button>
          )}
          <button type="button" onClick={() => setVoicePanelOpen((v) => !v)} title="Voice settings" style={styles.headerIconBtn}>🎚️</button>
          <button type="button" onClick={() => setSearchOpen((v) => !v)} title="Search" style={styles.headerIconBtn}>🔍</button>
          <button type="button" onClick={exportChat} title="Export chat" style={styles.headerIconBtn}>⬇️</button>
          <button type="button" onClick={clearChat} title="Clear chat" style={styles.headerIconBtn}>🗑️</button>
          <a href="/settings" style={styles.settingsLink}>⚙️</a>
        </div>
      </div>

      {voicePanelOpen && (
        <div style={{ ...styles.voicePanel, background: isDark ? "#202c33" : "#fff", color: bubbleAssistantColor }}>
          <label style={styles.voicePanelLabel}>
            Voice
            <select
              value={voiceSettings.voiceURI}
              onChange={(e) => updateVoiceSetting({ voiceURI: e.target.value })}
              style={styles.voiceSelect}
            >
              <option value="">Default</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
          <label style={styles.voicePanelLabel}>
            Speed: {voiceSettings.rate.toFixed(1)}x
            <input
              type="range" min="0.5" max="2" step="0.1"
              value={voiceSettings.rate}
              onChange={(e) => updateVoiceSetting({ rate: parseFloat(e.target.value) })}
            />
          </label>
          <label style={styles.voicePanelLabel}>
            Pitch: {voiceSettings.pitch.toFixed(1)}
            <input
              type="range" min="0" max="2" step="0.1"
              value={voiceSettings.pitch}
              onChange={(e) => updateVoiceSetting({ pitch: parseFloat(e.target.value) })}
            />
          </label>
          <button
            type="button"
            style={{ ...styles.headerIconBtn, alignSelf: "flex-start", background: appearance.accent }}
            onClick={() => speak("This is how I sound.")}
          >
            Test voice
          </button>
        </div>
      )}

      {searchOpen && (
        <div style={{ ...styles.searchBar, background: isDark ? "#202c33" : "#fff" }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            style={{ ...styles.input, flex: 1 }}
          />
          <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} style={styles.headerIconBtn}>✕</button>
        </div>
      )}

      {pinnedList.length > 0 && (
        <div style={{ ...styles.pinnedBar, background: isDark ? "#202c33" : "#fff" }}>
          {pinnedList.map(([id, text]) => (
            <div key={id} style={styles.pinnedItem}>
              <span style={{ flex: 1, fontSize: 12, color: bubbleAssistantColor }}>📌 {text}</span>
              <button type="button" onClick={() => togglePin(id, "")} style={styles.pinnedUnpin}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.chatArea}>
        <div style={styles.messages}>
          {groupedMessages.map((item) => {
            if (item.type === "separator") {
              return (
                <div key={item.id} style={styles.dateSeparator}>
                  <span style={styles.dateSeparatorPill}>{item.label}</span>
                </div>
              );
            }

            const m = item.data;
            const isRegenerating = regeneratingId === m.id;

            return (
              <div
                key={m.id}
                style={{
                  ...styles.bubble,
                  fontSize: chatFontSize,
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? appearance.accent : bubbleAssistantBg,
                  color: m.role === "user" ? "#fff" : bubbleAssistantColor,
                  opacity: isRegenerating ? 0.5 : 1,
                }}
              >
                {m.role === "user" && m.previewImage && (
                  <img src={m.previewImage} alt="Uploaded" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />
                )}
                {m.role === "assistant" ? (
                  <div className="md-content">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
                {m.image && <img src={m.image} alt="Generated" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 6 }} />}

                <div style={{ ...styles.metaRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.edited && <span style={styles.editedTag}>edited</span>}
                  {m.regenerated && <span style={styles.editedTag}>regenerated</span>}
                  <span style={styles.timeText} onClick={() => setDetailFor(m.id)} title="View details">{formatTime(m.time)}</span>
                  {m.role === "user" && (
                    <span style={styles.ticks}>
                      {m.status === "seen" ? "✓✓" : m.status === "delivered" ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>

                <div style={styles.msgActions}>
                  {m.content && (
                    <>
                      <button type="button" style={styles.msgActionBtn} onClick={() => copyText(m.content)}>📋</button>
                      <button type="button" style={styles.msgActionBtn} onClick={() => togglePin(m.id, m.content)}>
                        {pins[m.id] ? "📌✓" : "📌"}
                      </button>
                      <button type="button" style={styles.msgActionBtn} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                        {reactions[m.id] || "😊"}
                      </button>
                      {m.role === "user" && (
                        <button type="button" style={styles.msgActionBtn} onClick={() => startEdit(m.id, m.content)}>✏️</button>
                      )}
                      {m.role === "assistant" && (
                        <button type="button" style={styles.msgActionBtn} onClick={() => regenerate(m.id)} disabled={isRegenerating}>🔁</button>
                      )}
                      <button type="button" style={styles.msgActionBtn} onClick={() => deleteMessage(m.id)}>🗑️</button>
                      <button type="button" style={styles.msgActionBtn} onClick={() => setDetailFor(m.id)}>ℹ️</button>
                    </>
                  )}
                </div>

                {pickerFor === m.id && (
                  <div style={styles.reactionPicker}>
                    {REACTION_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" style={styles.reactionBtn} onClick={() => setReaction(m.id, emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ ...styles.bubble, ...styles.typingBubble, background: bubbleAssistantBg }}>
              <span style={styles.typingDot} />
              <span style={{ ...styles.typingDot, animationDelay: "0.15s" }} />
              <span style={{ ...styles.typingDot, animationDelay: "0.3s" }} />
            </div>
          )}

          {showQuickReplies && !loading && (
            <div style={styles.quickReplies}>
              {QUICK_REPLIES.map((label) => (
                <button key={label} type="button" style={styles.quickReplyBtn} onClick={() => sendQuickReply(label)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {editingId && (
          <div style={styles.editingBanner}>
            <span>Editing message</span>
            <button type="button" onClick={cancelEdit} style={styles.editingCancelBtn}>Cancel</button>
          </div>
        )}

        <form onSubmit={sendMessage} style={styles.inputRow}>
          <input type="file" id="docUpload" accept=".pdf,.txt" style={{ display: "none" }} onChange={handleDocUpload} />
          <input type="file" id="imgUpload" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
          <button type="button" style={styles.iconBtn} onClick={() => document.getElementById("docUpload").click()}>📎</button>
          <button type="button" style={styles.iconBtn} onClick={() => document.getElementById("imgUpload").click()}>📷</button>
          <button
            type="button"
            style={{ ...styles.iconBtn, background: listening ? "#d9534f" : "#fff", color: listening ? "#fff" : "#000" }}
            onClick={toggleVoiceInput}
            title="Voice input"
          >
            🎤
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message... (try 'walk')" style={styles.input} />
          <button type="submit" style={{ ...styles.button, background: appearance.accent }} disabled={loading}>
            {editingId ? "Save" : "Send"}
          </button>
        </form>
      </div>

      {detailMessage && (
        <div style={styles.modalOverlay} onClick={() => setDetailFor(null)}>
          <div style={{ ...styles.modalCard, background: isDark ? "#202c33" : "#fff", color: bubbleAssistantColor }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Message details</h3>
            <p style={styles.detailRow}><strong>From:</strong> {detailMessage.role === "user" ? visitorName : "Robert"}</p>
            <p style={styles.detailRow}><strong>Sent:</strong> {formatFullDateTime(detailMessage.time)}</p>
            {detailMessage.role === "user" && (
              <p style={styles.detailRow}>
                <strong>Status:</strong> {detailMessage.status === "seen" ? "Seen ✓✓" : detailMessage.status === "delivered" ? "Delivered ✓✓" : "Sent ✓"}
              </p>
            )}
            {detailMessage.edited && <p style={styles.detailRow}><em>This message was edited</em></p>}
            {detailMessage.regenerated && <p style={styles.detailRow}><em>This response was regenerated</em></p>}
            <button type="button" style={{ ...styles.button, background: appearance.accent, marginTop: 8 }} onClick={() => setDetailFor(null)}>Close</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .arm-left, .arm-right { transform-origin: top center; }
        .leg-left, .leg-right { transform-origin: top center; }
        .idle .arm-left { animation: sway 3s ease-in-out infinite; }
        .idle .arm-right { animation: sway 3s ease-in-out infinite reverse; }
        .talking { animation: bob 0.5s ease-in-out infinite; }
        .talking .mouth { animation: flicker 0.35s steps(2) infinite; }
        .talking .antenna-light { animation: glow 0.6s ease-in-out infinite; }
        .walking { animation: shift 2.2s ease-in-out; }
        .walking .leg-left { animation: stepLeft 0.4s ease-in-out infinite; }
        .walking .leg-right { animation: stepRight 0.4s ease-in-out infinite; }
        .walking .arm-left { animation: stepRight 0.4s ease-in-out infinite; }
        .walking .arm-right { animation: stepLeft 0.4s ease-in-out infinite; }
        @keyframes sway { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes flicker { 0%, 100% { width: 40px; } 50% { width: 20px; } }
        @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes stepLeft { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(18deg); } }
        @keyframes stepRight { 0%, 100% { transform: rotate(18deg); } 50% { transform: rotate(-18deg); } }
        @keyframes shift { 0% { transform: translateX(0); } 50% { transform: translateX(20px); } 100% { transform: translateX(0); } }
        @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
        .md-content p { margin: 0 0 8px; }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content h2 { font-size: 15px; margin: 10px 0 6px; }
        .md-content h3 { font-size: 14px; margin: 8px 0 4px; }
        .md-content code { background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 4px; font-size: 13px; }
        .md-content pre { background: rgba(0,0,0,0.08); padding: 8px; border-radius: 6px; overflow-x: auto; }
        .md-content ul, .md-content ol { margin: 4px 0; padding-left: 20px; }
        .md-content .katex-display { margin: 8px 0; overflow-x: auto; overflow-y: hidden; }
      `}</style>
    </div>
  );
}

const styles = {
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, background: "#eceff4" },
  page: { display: "flex", flexDirection: "column", height: "100vh" },
  sidebar: { color: "#eceff4", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", flexWrap: "wrap" },
  headerBtnRow: { marginLeft: "auto", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" },
  headerIconBtn: { background: "rgba(255,255,255,0.1)", border: "none", color: "#eceff4", fontSize: 12, borderRadius: 6, padding: "4px 6px", cursor: "pointer" },
  settingsLink: { color: "#eceff4", textDecoration: "none", fontSize: 16 },
  voicePanel: { display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px", borderBottom: "1px solid #d8dee9" },
  voicePanelLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 },
  voiceSelect: { padding: "4px 6px", borderRadius: 6, border: "1px solid #d8dee9" },
  searchBar: { display: "flex", gap: 6, padding: "6px 10px", borderBottom: "1px solid #d8dee9" },
  pinnedBar: { display: "flex", flexDirection: "column", gap: 4, padding: "6px 10px", borderBottom: "1px solid #d8dee9", maxHeight: 100, overflowY: "auto" },
  pinnedItem: { display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.05)", borderRadius: 8, padding: "4px 8px" },
  pinnedUnpin: { background: "none", border: "none", color: "#8696a0", cursor: "pointer", fontSize: 12 },
  chatArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  messages: { flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "8px", overflowY: "auto" },
  bubble: { maxWidth: "80%", padding: "6px 10px", borderRadius: 10, lineHeight: 1.35, position: "relative" },
  metaRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 2, opacity: 0.7 },
  timeText: { fontSize: 10, cursor: "pointer" },
  ticks: { fontSize: 10 },
  editedTag: { fontSize: 10, fontStyle: "italic" },
  dateSeparator: { display: "flex", justifyContent: "center", margin: "10px 0" },
  dateSeparatorPill: { fontSize: 11, fontWeight: 600, color: "#8696a0", background: "rgba(134,150,160,0.15)", padding: "3px 10px", borderRadius: 10 },
  msgActions: { display: "flex", gap: 6, marginTop: 4 },
  msgActionBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.75, padding: 0 },
  reactionPicker: { display: "flex", gap: 4, background: "#fff", border: "1px solid #d8dee9", borderRadius: 16, padding: "4px 8px", marginTop: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  reactionBtn: { background: "none", border: "none", fontSize: 16, cursor: "pointer" },
  quickReplies: { display: "flex", flexWrap: "wrap", gap: 6, alignSelf: "flex-start", maxWidth: "88%" },
  quickReplyBtn: { background: "rgba(0,0,0,0.06)", border: "1px solid #d8dee9", color: "#00a884", fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 14, cursor: "pointer" },
  typingBubble: { display: "flex", gap: 4, alignItems: "center", alignSelf: "flex-start", padding: "10px 14px" },
  typingDot: { width: 6, height: 6, borderRadius: "50%", background: "#8696a0", display: "inline-block", animation: "typingBounce 1s infinite" },
  editingBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "rgba(94,129,172,0.15)", fontSize: 12 },
  editingCancelBtn: { background: "none", border: "none", color: "#5e81ac", fontWeight: 600, cursor: "pointer", fontSize: 12 },
  inputRow: { display: "flex", gap: 6, padding: "6px", borderTop: "1px solid #d8dee9" },
  input: { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d8dee9" },
  button: { padding: "8px 14px", borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, cursor: "pointer" },
  iconBtn: { padding: "8px 10px", borderRadius: 8, border: "1px solid #d8dee9", background: "#fff", cursor: "pointer", fontSize: 16 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modalCard: { borderRadius: 12, padding: 20, width: "85%", maxWidth: 340, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" },
  detailRow: { fontSize: 13, margin: "6px 0" },
};
