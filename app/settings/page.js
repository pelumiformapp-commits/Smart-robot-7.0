"use client";

import { useEffect, useState } from "react";

const DEFAULT_WELCOME = "Hi [Username]! I'm Robert. Ask me anything.";
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Yoruba", "Igbo", "Hausa"];
const FONT_SIZES = [13, 14, 15, 16, 18];

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

function getSessionId() {
  let id = safeGet("robert_session_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now();
    safeSet("robert_session_id", id);
  }
  return id;
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
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [toast, setToast] = useState("");

  // Voice & Speech
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [autoTalkDefault, setAutoTalkDefault] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Appearance
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("#5e81ac");
  const [fontIndex, setFontIndex] = useState(1);

  // Alarms & Notifications
  const [pushStatus, setPushStatus] = useState("unknown"); // unknown | registering | enabled | unsupported | failed
  const [pushMessage, setPushMessage] = useState("");

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
    setPreferredLanguage(safeGet("robert_preferred_language", "English"));

    try {
      const rawVoice = safeGet("robert_voice_settings");
      if (rawVoice) {
        const v = JSON.parse(rawVoice);
        setVoiceURI(v.voiceURI || "");
        setRate(typeof v.rate === "number" ? v.rate : 1);
        setPitch(typeof v.pitch === "number" ? v.pitch : 1);
      }
    } catch (e) {}
    setAutoTalkDefault(safeGet("robert_autotalk") !== "false");

    setTheme(safeGet("robert_theme", "dark"));
    setAccent(safeGet("robert_accent_color", "#5e81ac"));
    const savedFont = parseInt(safeGet("robert_font_index", "1"), 10);
    if (!isNaN(savedFont) && savedFont >= 0 && savedFont < FONT_SIZES.length) setFontIndex(savedFont);

    setPushStatus(safeGet("robert_push_registered") === "true" ? "enabled" : "unknown");

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const populateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }

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
      preferredLanguage: next.preferredLanguage ?? preferredLanguage,
    };
    safeSet("robert_settings", JSON.stringify(merged));
  }

  function saveVoiceSettings(patch = {}) {
    const merged = {
      voiceURI: patch.voiceURI ?? voiceURI,
      rate: patch.rate ?? rate,
      pitch: patch.pitch ?? pitch,
    };
    safeSet("robert_voice_settings", JSON.stringify(merged));
  }

  function testVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Voice isn't supported in this browser.");
      return;
    }
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hi, I'm Robert. This is how I sound.");
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (voiceURI) {
      const match = availableVoices.find((v) => v.voiceURI === voiceURI);
      if (match) utterance.voice = match;
    }
    window.speechSynthesis.speak(utterance);
  }

  async function enableAlarmNotifications() {
    setPushStatus("registering");
    setPushMessage("");
    try {
      const MedianBridge = typeof window !== "undefined" ? (window.Median || window.median) : null;
      if (!MedianBridge?.oneSignal?.getOneSignalId) {
        setPushStatus("unsupported");
        setPushMessage("This only works inside the Robert Android/iOS app (Median build), not a regular browser.");
        return;
      }
      const result = await MedianBridge.oneSignal.getOneSignalId();
      const oneSignalId = result?.oneSignalId || result?.oneSignalUserId;
      if (!oneSignalId) {
        setPushStatus("failed");
        setPushMessage("Couldn't get a device ID. Make sure notifications are allowed for this app in your phone settings.");
        return;
      }
      const res = await fetch("/api/register-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), oneSignalId }),
      });
      const data = await res.json();
      if (data.success) {
        safeSet("robert_push_registered", "true");
        setPushStatus("enabled");
        setPushMessage("Alarm and reminder notifications are now enabled on this device.");
      } else {
        setPushStatus("failed");
        setPushMessage(data.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      setPushStatus("failed");
      setPushMessage("Something went wrong enabling notifications.");
    }
  }

  async function deleteAllChatData() {
    if (!confirm("Delete ALL your chat history from Robert's memory? This can't be undone.")) return;
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId() }),
      });
      const data = await res.json();
      if (data.success) {
        safeRemove("robert_messages_" + getSessionId());
        showSaved("Chat history deleted");
      } else {
        alert(data.error || "Couldn't delete chat history.");
      }
    } catch (err) {
      alert("Couldn't delete chat history. Check your connection.");
    }
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
          <h2 style={styles.h2}>🎤 Voice & Speech</h2>
          <div style={styles.field}>
            <label style={styles.label}>Voice</label>
            <select
              style={styles.input}
              value={voiceURI}
              onChange={(e) => { setVoiceURI(e.target.value); saveVoiceSettings({ voiceURI: e.target.value }); showSaved(); }}
            >
              <option value="">Default</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Speed: {rate.toFixed(1)}x</label>
            <input
              type="range" min="0.5" max="2" step="0.1" style={{ width: "100%" }}
              value={rate}
              onChange={(e) => { const v = parseFloat(e.target.value); setRate(v); saveVoiceSettings({ rate: v }); }}
              onMouseUp={() => showSaved()}
              onTouchEnd={() => showSaved()}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pitch: {pitch.toFixed(1)}</label>
            <input
              type="range" min="0" max="2" step="0.1" style={{ width: "100%" }}
              value={pitch}
              onChange={(e) => { const v = parseFloat(e.target.value); setPitch(v); saveVoiceSettings({ pitch: v }); }}
              onMouseUp={() => showSaved()}
              onTouchEnd={() => showSaved()}
            />
          </div>
          <Row label="Robert speaks replies aloud" sub="Default for new chats (can still be toggled per-chat)">
            <Switch checked={autoTalkDefault} onChange={(v) => { setAutoTalkDefault(v); safeSet("robert_autotalk", v.toString()); showSaved(); }} />
          </Row>
          <button style={styles.primaryBtn} onClick={testVoice}>🔊 Test voice</button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🎨 Appearance</h2>
          <Row label="Dark mode" sub="Switch between light and dark theme">
            <Switch checked={theme === "dark"} onChange={(v) => { const next = v ? "dark" : "light"; setTheme(next); safeSet("robert_theme", next); showSaved(); }} />
          </Row>
          <div style={{ ...styles.field, marginTop: 14 }}>
            <label style={styles.label}>Accent color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {["#5e81ac", "#00a884", "#d9534f", "#a3be8c", "#b48ead", "#ebcb8b"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setAccent(c); safeSet("robert_accent_color", c); showSaved(); }}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer",
                    border: accent === c ? "3px solid #fff" : "1px solid #2a3942",
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ ...styles.field, marginTop: 14 }}>
            <label style={styles.label}>Default text size</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                style={styles.smallBtn}
                onClick={() => { const next = Math.max(0, fontIndex - 1); setFontIndex(next); safeSet("robert_font_index", next.toString()); showSaved(); }}
              >
                A−
              </button>
              <span style={{ fontSize: FONT_SIZES[fontIndex] }}>Sample text</span>
              <button
                type="button"
                style={styles.smallBtn}
                onClick={() => { const next = Math.min(FONT_SIZES.length - 1, fontIndex + 1); setFontIndex(next); safeSet("robert_font_index", next.toString()); showSaved(); }}
              >
                A+
              </button>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>🌐 Language</h2>
          <p style={styles.hint}>Robert will reply in this language by default, unless you write to him in another one.</p>
          <select
            style={styles.input}
            value={preferredLanguage}
            onChange={(e) => { setPreferredLanguage(e.target.value); safeSet("robert_preferred_language", e.target.value); saveSettings({ preferredLanguage: e.target.value }); showSaved(); }}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>⏰ Alarms & Notifications</h2>
          <p style={styles.hint}>
            Real alarm and reminder notifications (the ones that work even when the app is closed) need this device
            registered for push notifications. This only works inside the Robert app installed on your phone — not in a
            regular browser tab.
          </p>
          {pushStatus === "enabled" && <p style={styles.pill}>✅ Notifications enabled on this device</p>}
          {pushStatus !== "enabled" && (
            <button style={styles.primaryBtn} onClick={enableAlarmNotifications} disabled={pushStatus === "registering"}>
              {pushStatus === "registering" ? "Enabling..." : "Enable Alarm Notifications"}
            </button>
          )}
          {pushMessage && <p style={{ fontSize: 12, color: pushStatus === "failed" || pushStatus === "unsupported" ? "#d9534f" : "#8696a0", marginTop: 8 }}>{pushMessage}</p>}
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
          <h2 style={styles.h2}>🗑️ Data & Privacy</h2>
          <p style={styles.hint}>Removes your chat history from Robert's memory on the server. To-dos, notes, and reminders are kept separately.</p>
          <button style={styles.dangerBtn} onClick={deleteAllChatData}>Delete all chat history</button>
          <button
            style={{ ...styles.dangerBtn, marginTop: 8 }}
            onClick={() => {
              if (confirm("Forget everything Robert knows about you? This can't be undone.")) {
                safeRemove("robert_memory_notes");
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
  hint: { fontSize: 11, color: "#8696a0", marginTop: 4, marginBottom: 10 },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
  textarea: { width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#2a3942", color: "#e9edef", fontSize: 14, fontFamily: "inherit" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#2a3942", color: "#e9edef", fontSize: 14 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 },
  rowLabel: { fontSize: 13, fontWeight: 600 },
  rowSub: { fontSize: 11, color: "#8696a0", marginTop: 2 },
  smallBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #2a3942", background: "#2a3942", color: "#e9edef", cursor: "pointer", fontSize: 13 },
  dangerBtn: { padding: "10px 14px", borderRadius: 8, border: "1px solid #d9534f", background: "transparent", color: "#d9534f", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 },
  primaryBtn: { padding: "10px 14px", borderRadius: 8, border: "none", background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" },
  pill: { display: "inline-flex", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 12, background: "rgba(0,168,132,0.18)", color: "#00d9a3" },
  toggleGroup: { display: "flex", flexWrap: "wrap", background: "#2a3942", borderRadius: 20, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, minWidth: 70, border: "none", background: "none", color: "#8696a0", padding: "8px 6px", borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  toggleBtnActive: { background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c" },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(90deg, #00a884, #00d9a3)", color: "#05221c", fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 20, zIndex: 200 },
};
