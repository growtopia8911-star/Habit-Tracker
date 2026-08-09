import { signUp, signIn, signOut, currentSession, onAuthChange } from "./auth.js";

const el = {
  fatal: document.querySelector("#fatal"),
  login: document.querySelector("#screen-login"),
  today: document.querySelector("#screen-today"),
  form: document.querySelector("#login-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  signUp: document.querySelector("#sign-up"),
  signOut: document.querySelector("#sign-out"),
  error: document.querySelector("#auth-error"),
  signedInAs: document.querySelector("#signed-in-as"),
};

// --- rendering -------------------------------------------------------------

// The only function that decides which screen is visible. Everything else
// changes the session and lets this react, so there is never a code path that
// shows Today without a session.
function render(session) {
  const signedIn = Boolean(session);
  el.login.hidden = signedIn;
  el.today.hidden = !signedIn;
  el.signedInAs.textContent = signedIn ? `Signed in as ${session.user.email}` : "";
  if (signedIn) clearError();
}

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = false;
}

function clearError() {
  el.error.textContent = "";
  el.error.hidden = true;
}

function showFatal(message) {
  el.fatal.textContent = message;
  el.fatal.hidden = false;
}

// Stops a second click while the first request is still in flight — the fastest
// way to end up with two accounts or two confusing errors.
function setBusy(busy) {
  for (const node of [el.signUp, el.signOut, ...el.form.elements]) {
    node.disabled = busy;
  }
}

// --- form handling ---------------------------------------------------------

// Checked here rather than with the `required` attribute so the message appears
// in the same place as every other error, instead of in a browser tooltip that
// looks nothing like the rest of the app.
function credentials() {
  const email = el.email.value.trim();
  const password = el.password.value;

  if (!email) return { ok: false, message: "Enter an email address." };
  if (!password) return { ok: false, message: "Enter a password." };
  return { ok: true, email, password };
}

async function submit(action) {
  clearError();

  const input = credentials();
  if (!input.ok) return showError(input.message);

  setBusy(true);
  try {
    const result = await action(input.email, input.password);
    // On success, render() runs via onAuthChange rather than here — one path to
    // Today, whether you just signed in or arrived with a stored session.
    if (!result.ok) showError(result.message);
    else el.password.value = "";
  } finally {
    setBusy(false);
  }
}

el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  submit(signIn);
});

el.signUp.addEventListener("click", () => submit(signUp));

el.signOut.addEventListener("click", async () => {
  setBusy(true);
  try {
    const result = await signOut();
    if (!result.ok) showError(result.message);
  } finally {
    setBusy(false);
  }
});

// --- boot ------------------------------------------------------------------

// The stored session is read before anything renders, so a refresh while signed
// in goes straight to Today instead of flashing the login form first.
const initial = await currentSession();
if (!initial.ok) {
  showFatal(`Could not reach Supabase — ${initial.message}`);
  render(null);
} else {
  render(initial.session);
}

onAuthChange(render);

// Lets the test harness wait for a settled first render instead of guessing with
// a timeout. Costs one attribute and removes a whole class of flaky test.
document.body.dataset.ready = "true";
