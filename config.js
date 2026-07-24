// GRANULA — runtime config
// Copyright © 2026 Sergei Diuzhev. All rights reserved.
//
// The anon key is PUBLIC by design and safe to commit: it only lets the client
// reach the API, while Row Level Security decides what any given user may read
// or write. Never put the service_role key here — that one bypasses RLS.
//
// Leave these empty to keep the app fully local (no auth, no sync, recordings
// save straight to the device). Filling them in switches the cloud on.
window.GRANULA_CONFIG = {
  SUPABASE_URL: "",       // e.g. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "",  // the "anon / public" key from Project Settings → API
};
