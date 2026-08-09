import { supabase } from "./supabase.js";

// Everything here returns the same shape — { ok: true } or { ok: false, message }
// — so callers never have to know what a Supabase error object looks like. The
// UI's job is to display `message`, not to interpret it.

// Supabase's own messages are written for developers. Most are fine to show as
// they are ("Invalid login credentials" says exactly the right thing), but a few
// leak internals. This is the single place that decides what a person reads.
function readable(error) {
  const raw = error?.message ?? "Something went wrong.";

  if (/invalid login credentials/i.test(raw)) {
    return "Wrong email or password.";
  }
  if (/user already registered/i.test(raw)) {
    return "That email already has an account — try signing in.";
  }
  // Not a user error at all: the Email provider is switched off in Supabase.
  // Easy to cause by accident, because the master "Enable Email provider" toggle
  // sits directly above the "Confirm email" one this project needs turned off.
  if (/signups are disabled|provider.*disabled/i.test(raw)) {
    return (
      "Email sign-in is switched off for this project. Turn Enable Email provider " +
      "back ON in Supabase → Authentication → Providers → Email (leave Confirm email OFF)."
    );
  }
  if (/password should be at least/i.test(raw)) {
    return raw; // Already specific and actionable.
  }
  if (/fetch|network/i.test(raw)) {
    return "Could not reach the server. Check your connection.";
  }
  return raw;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, message: readable(error) };

  // With email confirmation off, signUp returns a live session and the account
  // is immediately usable — which is what SPEC.md assumes. If that setting is
  // ever turned back on, `session` comes back null and the app would otherwise
  // report success while leaving the user signed out. Failing loudly here is the
  // difference between a five-minute fix and an afternoon.
  if (!data.session) {
    return {
      ok: false,
      message:
        "Account created, but it needs email confirmation before you can sign in. " +
        "Turn off Confirm email in Supabase → Authentication → Providers → Email.",
    };
  }
  return { ok: true };
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: readable(error) };
  return { ok: true };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: readable(error) };
  return { ok: true };
}

export async function currentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, message: readable(error) };
  return { ok: true, session: data.session };
}

// Fires on sign in, sign out, and token refresh. Used for routing only — calling
// back into supabase from inside this callback can deadlock the client.
export function onAuthChange(handler) {
  supabase.auth.onAuthStateChange((_event, session) => handler(session));
}
