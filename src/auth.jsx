import { useState } from "react";
import { supabase } from "./supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'Outfit', sans-serif; }
        ::placeholder { color: #b5afa8; }
      `}</style>
      <div style={S.card}>
        <div style={S.logoRow}>
          <span style={S.logo}>🍳</span>
          <h1 style={S.title}>Kitchen Hub</h1>
        </div>

        {!sent ? (
          <>
            <p style={S.subtitle}>Enter your email to sign in</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
              placeholder="you@example.com"
              style={S.input}
              autoFocus
            />
            {error && <p style={S.error}>{error}</p>}
            <button onClick={sendMagicLink} disabled={loading} style={{
              ...S.btn,
              ...(loading ? S.btnDisabled : {}),
            }}>
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </>
        ) : (
          <div style={S.sentBox}>
            <span style={{ fontSize: 44 }}>📬</span>
            <p style={S.sentHeading}>Check your email</p>
            <p style={S.sentSub}>
              We sent a sign-in link to <b>{email}</b>
            </p>
            <p style={S.sentNote}>
              Tap the link in the email to open the app. On a home-screen PWA
              you may need to copy the link and paste it into the app&apos;s browser.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: {
    fontFamily: "'Outfit', sans-serif",
    background: "#FAF7F2",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "40px 48px",
    border: "1px solid #E8E4DF",
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  logo: { fontSize: 32 },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#2D2A26",
  },
  subtitle: { color: "#8A8580", fontSize: 14, margin: 0 },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "2px solid #E8E4DF",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    background: "#FAF7F2",
  },
  btn: {
    width: "100%",
    padding: 13,
    background: "#D4856A",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  error: { color: "#C0392B", fontSize: 13, margin: 0, alignSelf: "flex-start" },
  sentBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    textAlign: "center",
    paddingTop: 8,
  },
  sentHeading: {
    fontSize: 20,
    fontWeight: 600,
    color: "#2D2A26",
    margin: 0,
  },
  sentSub: { color: "#2D2A26", fontSize: 15, margin: 0 },
  sentNote: {
    color: "#B5AFA8",
    fontSize: 12,
    margin: 0,
    lineHeight: 1.6,
    marginTop: 4,
  },
};
