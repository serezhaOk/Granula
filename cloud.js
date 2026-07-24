// GRANULA — cloud module (auth + recording sync via Supabase)
// Copyright © 2026 Sergei Diuzhev. All rights reserved.
//
// Dormant by default: with an empty config.js the whole cloud is OFF — the SDK is
// never even downloaded and the app stays 100% local, exactly as it shipped. It
// wakes up the moment config.js gets a Supabase URL + anon key.
//
// The inline app talks to this only through window.GranulaCloud. Nothing here
// touches IndexedDB or the DOM — the app owns local storage and UI.
(() => {
  "use strict";

  const cfg = (window.GRANULA_CONFIG || {});
  const ENABLED = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const BUCKET = "recordings";

  let client = null;       // supabase client, created lazily
  let clientPromise = null;

  // Pull the 204 KB SDK only when the cloud is actually enabled.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function getClient() {
    if (client) return client;
    if (!ENABLED) throw new Error("cloud disabled");
    if (!clientPromise) {
      clientPromise = (async () => {
        if (!window.supabase) await loadScript("vendor/supabase.js");
        client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        return client;
      })();
    }
    return clientPromise;
  }

  // ---- auth ----------------------------------------------------------------
  async function currentUser() {
    if (!ENABLED) return null;
    const c = await getClient();
    const { data } = await c.auth.getUser();
    return data && data.user ? data.user : null;
  }

  function onAuthChange(cb) {
    if (!ENABLED) return () => {};
    let unsub = () => {};
    getClient().then((c) => {
      const { data } = c.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
  }

  // Google: full-page OAuth redirect. Returns to redirectTo (the app URL); the SDK
  // then picks the session out of the URL (detectSessionInUrl).
  async function signInWithGoogle() {
    const c = await getClient();
    return c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname },
    });
  }

  // Email: send a 6-digit code (no magic link, so the user never leaves the PWA).
  async function sendEmailCode(email) {
    const c = await getClient();
    return c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  }
  async function verifyEmailCode(email, token) {
    const c = await getClient();
    return c.auth.verifyOtp({ email, token, type: "email" });
  }

  async function signOut() {
    if (!ENABLED) return;
    const c = await getClient();
    return c.auth.signOut();
  }

  // ---- recordings ----------------------------------------------------------
  // rec: { id (uuid), name, duration, blob (WAV) }
  async function upload(rec) {
    const c = await getClient();
    const user = await currentUser();
    if (!user) throw new Error("not signed in");
    const path = `${user.id}/${rec.id}.wav`;
    const up = await c.storage.from(BUCKET).upload(path, rec.blob, {
      contentType: "audio/wav", upsert: true,
    });
    if (up.error) throw up.error;
    const row = {
      id: rec.id, user_id: user.id, name: rec.name,
      duration: rec.duration, size_bytes: rec.blob.size, storage_path: path,
    };
    const ins = await c.from("recordings").upsert(row).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  }

  async function listRemote() {
    const c = await getClient();
    const { data, error } = await c.from("recordings")
      .select("id,name,duration,storage_path,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function download(storage_path) {
    const c = await getClient();
    const { data, error } = await c.storage.from(BUCKET).download(storage_path);
    if (error) throw error;
    return data; // Blob
  }

  async function rename(id, name) {
    const c = await getClient();
    const { error } = await c.from("recordings").update({ name }).eq("id", id);
    if (error) throw error;
  }

  async function remove(id, storage_path) {
    const c = await getClient();
    await c.storage.from(BUCKET).remove([storage_path]).catch(() => {});
    const { error } = await c.from("recordings").delete().eq("id", id);
    if (error) throw error;
  }

  window.GranulaCloud = {
    enabled: ENABLED,
    currentUser, onAuthChange,
    signInWithGoogle, sendEmailCode, verifyEmailCode, signOut,
    upload, listRemote, download, rename, remove,
  };
})();
