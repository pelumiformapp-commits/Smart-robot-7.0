"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");

  async function loadMessages(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin", { headers: { "x-admin-password": password } });
    if (!res.ok) {
      setError("Wrong password.");
      return;
    }
    const data = await res.json();
    setMessages(data.messages);
  }

  if (!messages) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Admin Login</h2>
        <form onSubmit={loadMessages} style={{ display: "flex", gap: 8 }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" />
          <button type="submit">View Conversations</button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  const bySession = {};
  messages.forEach((m) => {
    if (!bySession[m.session_id]) bySession[m.session_id] = { name: m.visitor_name, msgs: [] };
    bySession[m.session_id].msgs.push(m);
  });

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>All Conversations</h2>
      {Object.entries(bySession).map(([sid, data]) => (
        <div key={sid} style={{ marginBottom: 24, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <strong>{data.name}</strong> <span style={{ color: "#888", fontSize: 12 }}>({sid})</span>
          {data.msgs.map((m, i) => (
            <p key={i} style={{ margin: "4px 0" }}>
              <b>{m.role}:</b> {m.content}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
