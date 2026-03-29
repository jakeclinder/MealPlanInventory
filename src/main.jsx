import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import AuthScreen from "./auth";
import { supabase } from "./supabase";

function Root() {
  // undefined = still loading session, null = signed out, object = signed in
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Check for an existing session on mount (covers the magic-link redirect
    // case where Supabase embeds the token in the URL hash).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    // Keep in sync with sign-in / sign-out events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Blank screen while we resolve the session — avoids a flash of the login
  // screen for users who are already signed in.
  if (session === undefined) return null;

  if (!session) return <AuthScreen />;

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// Register service worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}
