import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Step 3 proves exactly one thing: the live page can reach Supabase. Nothing
// else is built yet, so the check has to work with no tables and nobody signed
// in — getSession() is the cheapest call that fits. Signed out it returns
// { session: null } and no error, and that is a success: the question is
// whether the auth server answered, not whether anyone is logged in.
//
// Proving this now, in isolation, is the same reasoning as putting the empty
// page live before any feature existed. A later auth bug should never have
// "...or maybe the key is wrong" as a live possibility.

const statusEl = document.querySelector("#status");

function show(message, ok) {
  statusEl.textContent = message;
  statusEl.className = ok ? "status status-ok" : "status status-bad";
}

try {
  const { error } = await supabase.auth.getSession();
  if (error) throw error;
  show("Connected to Supabase.", true);
  console.log("connected");
} catch (err) {
  show(`Could not reach Supabase — ${err.message}`, false);
  console.error("Supabase connection failed:", err);
}
