import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// One client for the whole app. Everything that talks to Supabase imports this
// rather than calling createClient again — two clients would each hold their own
// copy of the session and could disagree about who is signed in.
//
// The version is pinned deliberately. A floating `@2` would let a CDN change the
// app with no commit behind it, which is not something you can bisect later.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
