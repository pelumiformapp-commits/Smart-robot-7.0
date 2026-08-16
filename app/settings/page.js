"use client";

import { useEffect, useState } from "react";

const DEFAULT_WELCOME = "Hi [Username]! I'm Robert. Ask me anything.";

function safeGet(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    return val === null ? fallback : val;
  } catch (e) {
    return fallback;
  }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

export default function SettingsPage() {
  const [welcome, setWelcome] = useState(DEFAULT_WELCOME);
  const [hideGreeting, setHideGreeting] = useState(false);
  const [memoryNotes, setMemoryNotes] = useState("");
  const [creativity, setCreativity] = useState("medium");
  const [personality, setPersonality] = useState("friendly");
  const [learningMode, setLearningMode] = useState(false);
  const [mathMode, setMathMode] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState(false);
  const [toast, setToast] = useState("");

  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    setWelcome(safeGet("robert_welcome_message", DEFAULT_WELCOME));
    setHideGreeting(safeGet("robert_hide_greeting") === "true");
    setMemoryNotes(safeGet("robert_memory_notes", ""));
    setCreativity(safeGet("robert_creativity", "medium"));
    setPersonality(safeGet("robert_personality", "friendly"));
    setLearningMode(safeGet("robert_learning_mode") === "true");
    setMathMode(safeGet("robert_math_mode") === "true");
    setSmartSuggestions(safeGet("robert_smart_suggestions") === "true");
    try {
      setIsAdmin(!!sessionStorage.getItem("robert_admin_pw"));
    } catch (e) {}
  }, []);

  function showSaved(msg = "Saved") {
    setToast(msg);
    setTimeout(() => setToast(""), 1200);
  }

  function saveSettings(next = {}) {
    const merged = {
      personality: next.personality ?? personality,
      learningMode: next.learningMode ?? learningMode,
      mathMode: next.mathMode ?? mathMode,
      smartSuggestions: next.smartSuggestions ?? smartSuggestions,
      creativity: next.creativity ?? creativity,
      memoryNotes: next.memoryNotes ?? memoryNotes,
    };
    safeSet("robert_settings", JSON.stringify(merged));
  }

  async function handleAdminLogin() {
    if (!adminPassword) return;
    setAdminLoading(true);
    setAdminError(false);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        try { sessionStorage.setItem("robert_admin_pw", adminPassword); } catch (e) {}
        setIsAdmin(true);
        setAdminPassword("");
        showSaved("Logged in as admin");
      } else {
        setAdminError(true);
      }
    } catch (err) {
      setAdminError(true);
    } finally {
      setAdminLoading(false);
    }
  }

  function handleAdminLogout() {
    try { sessionStorage.removeItem("robert_admin_pw"); } catch (e) {}
    setIsAdmin(false);
    showSaved("Logged out");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <a href="/" style={styles.backBtn}>←</a>
        <h1 style={styles.h1}>🔧 Settings</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2 style={styles.h2}>🤖 About Robert</h2>
          <p style={styles.p}><strong>Robert</strong> — an AI assistant engineered by <strong>Engineer Pelumi</strong>.</p>
          <p style={styles.p}><strong>Salawu Pelumi Dayo</strong> is a 400 Level Computer Engineering student, building production-grade software spanning backend systems, real-time chat infrastructure, and AI-integrated applications.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>👋 Welcome Message</h2>
          <textarea
            style={styles.textarea}
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            onBlur={() => { safeSet("robert_welcome_message", welcome || DEFAULT_WELCOME); showSaved(); }}
          />
          <p style={styles.hint}>Use [Username] anywhere — replaced with the visitor's name automatically.</p>
          <Row label="Hide greeting" sub="Skip the welcome message for new chats">
            <Switch checked={hideGreeting} onChange={(v) => { setHideGreeting(v); safeSet("robert_hide_greeting", v.toString()); showSaved(); }} />
          </Row>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>💾 AI Memory</h2>
          <div style={styles.field}>
            <label style={styles.label}>Things Robert should remember</label>
            <textarea
              style={styles.textarea}
              placeholder="e.g. I prefer short answers, I'm a Computer Engineering student..."
              value={memoryNotes}
              onChange={(e) => setMemoryNotes(e.target.value)}
              onBlur={() => { safeSet("robert_memory_notes", memoryNotes); saveSettings({ memoryNotes }); showSaved(); }}
            />
          </div>
          <button
            style={styles.dangerBtn}
            onClick={() => {
              if (confirm("Forget everything Robert knows about you? This can't be undone.")) {
                safeRemove("robert_memory_notes");
                safeRemove("robert_chat_history");
                setMemoryNotes("");
                saveSettings({ memoryNotes: "" });
                showSaved("Memory cleared");
              }
            }}
          >
            Forget everything Robert knows about me
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>⚡ AI Creativity</h2>
          <ToggleGroup
            options={[{ v: "low", l: "Low" }, { v: "medium", l: "Medium" }, { v: "high", l: "High" }]}
            value={creativity}
            onChange={(v) => { setCreativity(v); safeSet("robert_creativity", v); saveSettings({ creativity: v }); showSaved(); }}
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🎭 Robert Personality</h2>
          <ToggleGroup
            options={[
              { v: "friendly", l: "😊 Friendly" },
              { v: "funny", l: "😄 Funny" },
              { v: "formal", l: "🎩 Formal" },
              { v: "motivational", l: "🔥 Motivational" },
            ]}
            value={personality}
            onChange={(v) => { setPersonality(v); safeSet("robert_personality", v); saveSettings({ personality: v }); showSaved(); }}
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🎓 Learning Mode</h2>
          <Row label="Enable Learning Mode" sub="Breaks concepts down like a tutor">
            <Switch checked={learningMode} onChange={(v) => { setLearningMode(v); safeSet("robert_learning_mode", v.toString()); saveSettings({ learningMode: v }); showSaved(); }} />
          </Row>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🧮 Math Mode</h2>
          <Row label="Enable Math Mode" sub="Full LaTeX step-by-step working every time">
            <Switch checked={mathMode} onChange={(v) => { setMathMode(v); safeSet("robert_math_mode", v.toString()); saveSettings({ mathMode: v }); showSaved(); }} />
          </Row>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>💡 Smart Suggestions</h2>
          <Row label="Enable Smart Suggestions" sub='Adds "you might also ask" under replies'>
            <Switch checked={smartSuggestions} onChange={(v) => { setSmartSuggestions(v); safeSet("robert_smart_suggestions", v.toString()); saveSettings({ smartSuggestions: v }); showSaved(); }} />
          </Row>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🔑 Admin Controls</h2>
          <p style={styles.hint}>For Engineer Pelumi only.</p>
          {!isAdmin ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Admin password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                />
              </div>
              {adminError && <p style={{ color: "#d9534f", fontSize: 12 }}>Wrong password. Try again.</p>}
              <button style={styles.primaryBtn} onClick={handleAdminLogin} disabled={adminLoading}>
                {adminLoading ? "Logging in..." : "Log In"}
              </button>
            </>
          ) : (
            <>
              <p style={styles.pill}>👑 Logged in as admin</p>
              <button style={styles.dangerBtn} onClick={handleAdminLogout}>Log Out of Admin</button>
            </>
          )}
        </section>
      </main>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function Row({ label, sub, children }) {
  return (
    <div style={styles.row}>
      <div>
        <div style={styles.rowLabel}>{label}</div>
        <div style={styles.rowSub}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <label style={{ position: "relative", width: 42, height: 24, display: "inline-block", flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <span
        style={{
          position: "absolute", inset: 0, borderRadius: 24, cursor: "pointer",
          background: checked ? "linear-gradient(90deg, #00a884, #00d9a3)" : "#2a3942",
          border: "1px solid #2a3942", transition: "background 0.2s",
        }}
        onClick={() => onChange(!checked)}
      >
        <span
          style={{
            position: "absolute", width: 18, height: 18, top: 2, left: checked ? 20 : 2,
            background: checked ? "#fff" : "#8696a0", borderRadius: "50%", transition: "left 0.2s",
          }}
        />
      </span>
    </label>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={styles.toggleGroup}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          style={{
            ...styles.toggleBtn,
            ...(value === o.v ? styles.toggleBtnActive : {}),
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0b141a", color: "#e9edef", fontFamily: "-apple-system, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#202c33", borderBottom: "1px solid #2a3942", position: "sticky", top: 0 },
  backBtn: { color: "#e9edef", textDecoration: "none", fontSize: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#2a3942" },
  h1: { margin: 0, fontSize: 17 },
  main: { maxWidth: 480, margin: "0 auto", padding: 16, paddingBottom: 60 },
  section: { background: "#202c33", border: "1px solid #2a3942", borderRadius: 12, padding: 16, marginBottom: 16 },
  h2: { margin: "0 0 10px", fontSize: 14, color: "#00d9a3", textTransform: "uppercase", letterSpacing: "0.04em" },
  p: { margin: "0 0 8px", fontSize: 13, lineHeight: 1.5 },
  hint: { fontSize: 11, color: "#8696a0", marginTop: 4 },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
  textarea: { width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#2a3942", color: "#e9edef", fontSize: 14, fontFamily: "inherit" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#2a3942", color: "#e9edef", fontSize: 14 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 },
  rowLabel: { fontSize: 13, fontWeight: 600 },
  rowSub: { fontSize: 11, color: "#8696a0", marginTop: 2 },
  dangerBtn: { padding: "10px 14px", borderRadius: 8, border: "1px solid #d9534f", background: "transparent", color: "#d9534f", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 },
  primaryBtn: { padding: "10px 14px", borderRadius: 8, border: "none", background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" },
  pill: { display: "inline-flex", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 12, background: "rgba(0,168,132,0.18)", color: "#00d9a3" },
  toggleGroup: { display: "flex", flexWrap: "wrap", background: "#2a3942", borderRadius: 20, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, minWidth: 70, border: "none", background: "none", color: "#8696a0", padding: "8px 6px", borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  toggleBtnActive: { background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c" },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c", fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 20, zIndex: 200 },
};
