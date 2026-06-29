// Storage layer: localStorage as an instant cache, Supabase for cloud sync.
//
// On every load:
//   1. Return localStorage value immediately (fast, works offline).
//   2. Fetch from Supabase; if the remote row is newer, update localStorage
//      and return the fresher value (the component re-renders automatically
//      because this all happens inside the same async load call before
//      setLoaded(true) is reached).
//
// On every save:
//   1. Write to localStorage synchronously (instant).
//   2. Upsert to Supabase in the background; log failures but don't throw —
//      the UI continues working even if the device is offline.

import { supabase } from "./supabase";

// ── LocalStorage helpers ─────────────────────────────────────────────────────

// Reads a cache entry.  Handles two formats:
//   New format:  { value: <data>, updated_at: "<iso>" }
//   Legacy fmt:  <raw data>   (written by the localStorage-only v1)
function readLocalCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: null, updated_at: null };
    const parsed = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "value" in parsed &&
      "updated_at" in parsed
    ) {
      return parsed; // new format
    }
    // Legacy format — treat as cached but no timestamp
    return { value: parsed, updated_at: null };
  } catch {
    return { value: null, updated_at: null };
  }
}

function writeLocalCache(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ value, updated_at: new Date().toISOString() })
    );
  } catch {
    // Storage quota exceeded or private-mode restriction — silently ignore.
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function load(key, fallback) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fallback;
    }

    const cacheKey = `user:${user.id}:${key}`;
    const cached = readLocalCache(cacheKey);

    const { data, error } = await supabase
      .from("user_data")
      .select("value, updated_at")
      .eq("user_id", user.id)
      .eq("key", key)
      .single();

    if (error || !data) {
      // No row yet (PGRST116) or network error — fall back to cache.
      return cached.value ?? fallback;
    }

    // Use the newer of the two copies.
    const supabaseNewer =
      !cached.updated_at ||
      new Date(data.updated_at) > new Date(cached.updated_at);

    if (supabaseNewer) {
      writeLocalCache(cacheKey, data.value);
      return data.value;
    }

    return cached.value ?? fallback;
  } catch {
    // Network failure, Supabase down, etc. — degrade gracefully.
    return fallback;
  }
}

export async function save(key, val) {
  // Sync to Supabase and write to the user-scoped cache.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    writeLocalCache(`user:${user.id}:${key}`, val);

    const { error } = await supabase.from("user_data").upsert(
      {
        user_id: user.id,
        key,
        value: val,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

    if (error) console.error("Supabase save failed:", error.message);
  } catch (e) {
    console.error("Supabase save failed:", e);
  }
}
