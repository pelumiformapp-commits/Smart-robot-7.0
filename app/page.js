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

export default function ChatPage() {
  const [visitorName, setVisitorName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [talking, setTalking] = useState(false);
  const [walking, setWalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [appearance, setAppearance] = useState({ theme: "dark", accent: "#5e81ac" });
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("robert_visitor_name");
    if (saved) setVisitorName(saved);
    setAppearance(loadAppearance());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    localStorage.setItem("robert_visitor_name", nameInput.trim());
    setVisitorName(nameInput.trim());

    const hideGreeting = localStorage.getItem("robert_hide_greeting") === "true";
    if (!hideGreeting) {
      const template = localStorage.getItem("robert_welcome_message") || "Hi [Username]! I'm Robert. Ask me anything.";
      const greeting = template.replace(/\[Username\]/g, nameInput.trim());
      setMessages([{ role: "assistant", content: greeting }]);
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

  function compressImage(file, maxWidth = 1400, useJpeg = false, quality = 0.9) {
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
  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    if (isWalkCommand(input)) {
      triggerWalk();
    }

    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setTalking(true);

    const settings = loadSettings();

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMsg.content,
        history: messages,
        visitorName,
        sessionId: getSessionId(),
        settings,
      }),
    });
    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.reply, image: data.generatedImage || null },
    ]);
    setLoading(false);
    setTalking(false);

    if (data.speechText && "speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.speechText));
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const { base64, mimeType } = await compressImage(file);
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
    const userMsg = { role: "user", content: `[Sent an image: ${file.name}]`, previewImage: URL.createObjectURL(file) };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTalking(true);

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
        setMessages((prev) => [...prev, { role: "assistant", content: errData.reply || "Sorry, that took too long — please try a smaller or clearer photo." }]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);

      if (data.speechText && "speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.speechText));
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong reading that image. Please try again." }]);
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
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function clearChat() {
    if (confirm("Clear this conversation? This can't be undone.")) {
      setMessages([]);
    }
  }

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

  return (
    <div style={{ ...styles.page, background: pageBg }}>
      <div style={{ ...styles.sidebar, background: isDark ? "#202c33" : "#3b4252" }}>
        <div className={`robot ${talking ? "talking" : "idle"} ${walking ? "walking" : ""}`}>
          <svg viewBox="0 0 160 220" width="90" height="120">
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
        <span style={{ fontSize: 13, color: "#eceff4" }}>Hi, {visitorName}</span>
        <button type="button" onClick={clearChat} title="Clear chat" style={styles.headerIconBtn}>🗑️</button>
        <a href="/settings" style={styles.settingsLink}>⚙️</a>
      </div>

      <div style={styles.chatArea}>
        <div style={styles.messages}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.bubble,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? appearance.accent : bubbleAssistantBg,
                color: m.role === "user" ? "#fff" : bubbleAssistantColor,
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
            </div>
          ))}
          {loading && <div style={{ ...styles.bubble, background: bubbleAssistantBg, color: bubbleAssistantColor }}>Robert is typing...</div>}
          <div ref={bottomRef} />
        </div>

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
          <button type="submit" style={{ ...styles.button, background: appearance.accent }} disabled={loading}>Send</button>
        </form>
      </div>

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
        @keyframes shift {
          0% { transform: translateX(0); }
          50% { transform: translateX(20px); }
          100% { transform: translateX(0); }
        }

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
  sidebar: { color: "#eceff4", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" },
  headerIconBtn: { marginLeft: "auto", background: "none", border: "none", color: "#eceff4", fontSize: 16, cursor: "pointer" },
  settingsLink: { color: "#eceff4", textDecoration: "none", fontSize: 18 },
  chatArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  messages: { flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "8px", overflowY: "auto" },
  bubble: { maxWidth: "80%", padding: "6px 10px", borderRadius: 10, fontSize: 14, lineHeight: 1.35 },
  inputRow: { display: "flex", gap: 6, padding: "6px", borderTop: "1px solid #d8dee9" },
  input: { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d8dee9" },
  button: { padding: "8px 14px", borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, cursor: "pointer" },
  iconBtn: { padding: "8px 10px", borderRadius: 8, border: "1px solid #d8dee9", background: "#fff", cursor: "pointer", fontSize: 16 },
};
