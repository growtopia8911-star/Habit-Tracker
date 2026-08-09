# Tests

Checks the acceptance criteria in [../SPEC.md](../SPEC.md) by driving a real
browser. Not a unit test suite — it signs up, signs in, reloads, and signs out
against the real Supabase project, because that is what the criteria describe.

## Setup (once)

```bash
cd tests
npm install
```

Uses the copy of Chrome already installed on the machine (`channel: "chrome"`),
so there is no browser download.

## Running

```bash
npm run serve     # terminal 1 — serves the repo root on :8765
npm test          # terminal 2 — runs against localhost
```

Against the deployed site, which is the bar `SPEC.md` actually sets:

```bash
npm run test:live
```

Exit code is 0 only when every check passes.

## Why the app has no package.json and this does

`SPEC.md` commits the app to plain HTML/CSS/JS with no build step, and that is
still true — nothing in `../` imports anything from here. Keeping the
dependency in its own folder is what lets both statements stay honest.

## Why a browser and not asserts

Half the Auth criteria are about what survives a page load: "refreshing while
signed in stays signed in", "refreshing after sign out does not sneak back in".
Those live in `localStorage`, the Supabase client's boot sequence, and the
order the first render happens in. There is no way to assert on them without
actually reloading a page.

## Notes for future tests

- **Wait on `body[data-ready="true"]`**, set by `app.js` once the first render
  settles. Timeouts pass on a fast day and fail on a slow one.
- **A test can cause the failure it reports.** Sign-out returns to Login when
  the *local* session clears, before `/auth/v1/logout` answers. Reloading in
  that gap aborts a request that already returned `204`, and Chrome calls it
  `net::ERR_ABORTED`. The suite ignores an abort only for a URL that already
  responded successfully — anything else still fails.
- **Test accounts use `@gmail.com`, never `@example.com`.** Supabase rejects
  reserved domains with `email_address_invalid`. Nothing is ever sent, because
  the project has email confirmation off.
- Every run leaves a new user behind. Clear them out occasionally in
  Authentication → Users; they all start `habit.test`.
