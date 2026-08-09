// Supabase connection details.
//
// This key is the PUBLISHABLE key — what SPEC.md calls the `anon` key, before
// Supabase renamed it. It is meant to live in committed browser code: it grants
// nothing on its own, and Row Level Security is what decides which rows it can
// reach. See SPEC.md § "The key that goes in the repo".
//
// Its counterpart, the `sb_secret_` key, bypasses RLS entirely and never enters
// this repo — not in a file, not in a .env, not in a commit message.

export const SUPABASE_URL = "https://okmngwryhwpetduuxjyj.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_vCHXtg_uNl3Asm1fWpYToQ_ifxkgfmP";
