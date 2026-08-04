"use client";

import { useEffect, useRef, useState } from "react";

function getSessionId() {
  let id = localStorage.getItem("robert_session_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("robert_session_id", id);
  }
  return id;
}

export default function ChatPage() {
  const [visitorName, setVisitorName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [talking, setTalking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("robert_visitor_name");
    if (saved) setVisitorName(saved);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    localStorage.setItem("robert_visitor_name", nameInput.trim());
    setVisitorName(nameInput.trim());
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setTalking(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMsg.content,
        history: messages,
        visitorName,
        sessionId: getSessionId(),
      }),
    });
    const data = await res.json();

    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    setLoading(false);
    setTalking(false);
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

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <div className={`robot ${talking ? "talking" : "idle"}`}>
          <svg viewBox="0 0 160 220" width="90" height="120">
            <rect x="58" y="170" width="14" height="40" rx="4" fill="#3b4252" />
            <rect x="88" y="170" width="14" height="40" rx="4" fill="#3b4252" />
            <rect x="40" y="90" width="80" height="85" rx="14" fill="#4c566a" />
            <rect x="55" y="105" width="50" height="30" rx="6" fill="#88c0d0" />
            <rect x="18" y="95" width="16" height="60" rx="8" fill="#3b4252" className="arm-left" />
            <rect x="126" y="95" width="16" height="60" rx="8" fill="#3b4252" className="arm-right" />
            <rect x="72" y="75" width="16" height="18" fill="#3b4252" />
            <rect x="35" y="15" width="90" height="65" rx="20" fill="#5e81ac" />
            <circle cx="62" cy="45" r="8" fill="#eceff4" />
            <circle cx="98" cy="45" r="8" fill="#eceff4" />
            <circle cx="62" cy="45" r="3.5" fill="#2e3440" />
            <circle cx="98" cy="45" r="3.5" fill="#2e3440" />
            <rect x="60" y="62" width="40" height="6" rx="3" fill="#eceff4" className="mouth" />
            <line x1="80" y1="15" x2="80" y2="2" stroke="#5e81ac" strokeWidth="3" />
            <circle cx="80" cy="2" r="4" fill="#a3be8c" className="antenna-light" />
          </svg>
        </div>
        <span style={{ fontSize: 13 }}>Hi, {visitorName}</span>
      </div>

      <div style={styles.chatArea}>
        <div style={styles.messages}>
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.bubble, alignSelf: m.role === "user" ? "flex-end" : "flex-start", background: m.role === "user" ? "#5e81ac" : "#e5e9f0", color: m.role === "user" ? "#fff" : "#2e3440" }}>
              {m.content}
            </div>
          ))}
          {loading && <div style={{ ...styles.bubble, background: "#e5e9f0" }}>Robert is typing...</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} style={styles.inputRow}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." style={styles.input} />
          <button type="submit" style={styles.button} disabled={loading}>Send</button>
        </form>
      </div>

      <style jsx global>{`
        .arm-left, .arm-right { transform-origin: top center; }
        .idle .arm-left { animation: sway 3s ease-in-out infinite; }
        .idle .arm-right { animation: sway 3s ease-in-out infinite reverse; }
        .talking { animation: bob 0.5s ease-in-out infinite; }
        .talking .mouth { animation: flicker 0.35s steps(2) infinite; }
        .talking .antenna-light { animation: glow 0.6s ease-in-out infinite; }
        @keyframes sway { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes flicker { 0%, 100% { width: 40px; } 50% { width: 20px; } }
        @keyframes glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

const styles = {
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, background: "#eceff4" },
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#eceff4" },
  sidebar: { background: "#3b4252", color: "#eceff4", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" },
  chatArea: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  messages: { flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "8px", overflowY: "auto" },
  bubble: { maxWidth: "80%", padding: "6px 10px", borderRadius: 10, fontSize: 14, lineHeight: 1.35 },
  inputRow: { display: "flex", gap: 6, padding: "6px", borderTop: "1px solid #d8dee9" },
  input: { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d8dee9" },
  button: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#5e81ac", color: "#fff", fontWeight: 600, cursor: "pointer" },
};
