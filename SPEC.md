# Habit Tracker — SPEC v1

A small habit tracker, built as a practice project. Two goals sit above the app
itself: learn **Supabase** (auth + Postgres + Row Level Security), and learn
**spec-driven development** — write the checklist first, then build to it.

**Live URL:** `https://growtopia8911-star.github.io/SPEC/` (once Pages is switched on)
**Repo:** https://github.com/growtopia8911-star/SPEC
**Stack:** plain HTML/CSS/JS, no build step · Supabase (auth + Postgres) · GitHub Pages

---

## Purpose

Track a handful of daily habits. Open the app, see today's habits, tap one to
mark it done, see how many days in a row you've kept it up, and glance at the
last week.

It is deliberately small. Anything that would make it a real product is out of
scope (see below) so that the parts that teach Supabase — auth, tables,
policies, constraints — get the attention.

---

## What "done" means

v1 is done when **all** of these are true:

1. Every box in [Acceptance criteria](#acceptance-criteria) is ticked.
2. The app is live at the Pages URL and works from a phone browser, not just localhost.
3. Two different accounts can sign in on that same URL and neither can see the other's data.
4. A full browser refresh loses nothing — the session and the data both survive.

Not part of "done": looking good, being fast, handling offline, or being useful
to anyone but you.

---

## In scope for v1

| Feature | What it means |
| --- | --- |
| Email/password login | Sign up, sign in, sign out. Session survives a page refresh. |
| Create habit | Add a habit with a name. |
| Rename habit | Change an existing habit's name. |
| Delete habit | Remove a habit, and its completions go with it. |
| Check off a day | Mark a habit done for a given date. Tapping again unmarks it. |
| Current streak | Consecutive days ending today (definition below — it's the fiddly bit). |
| Last-7-days grid | A row per habit, 7 columns, filled or empty. |

## Out of scope for v1

Reminders and notifications · sharing habits with other people · charts and
statistics · exporting data · a native mobile app · social login (Google,
Apple) · password reset flow · editing past days from the week view ·
archiving habits · habit categories, colours, or icons · anything scheduled
(e.g. "only on weekdays").

Listing these matters as much as the in-scope list. When one of them feels
tempting mid-build, it's already been decided — it waits for v2.

---

## Data model

Two tables. Both live in the `public` schema. Both have Row Level Security on.

### `habits`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `user_id` | `uuid` | → `auth.users(id)`, `on delete cascade`, not null |
| `name` | `text` | Not null, must not be empty after trimming |
| `created_at` | `timestamptz` | Default `now()` |

### `completions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `habit_id` | `uuid` | → `habits(id)`, `on delete cascade`, not null |
| `user_id` | `uuid` | → `auth.users(id)`, `on delete cascade`, not null |
| `done_on` | `date` | **A date, not a timestamp.** Not null. |
| `created_at` | `timestamptz` | Default `now()` — for debugging only, never read by the app |

**Unique constraint:** `unique (habit_id, done_on)`

One habit can only be completed once per day. This is enforced by the
*database*, not by the UI. Two fast taps, a double-submit, or a bug in the app
all hit the same wall.

### Three decisions worth explaining

**Why `date` and not `timestamptz` for `done_on`.**
A "day" is a human calendar idea, not a moment. If completions were timestamps,
then "did I do this today?" depends on which timezone you ask from, and checking
off at 11pm could land on tomorrow. Storing a plain `date` — the date *you*
considered it, computed from your local clock — makes the question have one
answer. It also makes the unique constraint mean what you want it to mean.

> **Gotcha to remember when building:** `new Date().toISOString().slice(0,10)`
> gives the **UTC** date, which is wrong after ~7pm in some timezones. The local
> date has to be built from `getFullYear()` / `getMonth()` / `getDate()`.

**Why `user_id` is on `completions` too, when it could be reached via `habit_id`.**
It is technically redundant. It's there so the RLS policy can be a direct
comparison (`auth.uid() = user_id`) instead of a subquery joining back to
`habits`. Simpler to read, simpler to reason about, and it can't be got wrong
in a way that silently leaks. The cost is that the two must agree — the insert
path always sets `user_id` to the signed-in user, never to whatever the client
sent.

**Why `on delete cascade` everywhere.**
Deleting a habit should not leave orphaned completions pointing at nothing, and
deleting an account should not leave rows behind. The database handles it, so
the app never has to remember to.

### Row Level Security

RLS is **on** for both tables, with policies for all four operations:

| Operation | Policy |
| --- | --- |
| `select` | `using (auth.uid() = user_id)` |
| `insert` | `with check (auth.uid() = user_id)` |
| `update` | `using (auth.uid() = user_id) with check (auth.uid() = user_id)` |
| `delete` | `using (auth.uid() = user_id)` |

**The point to internalise:** with RLS on, a row that fails the policy doesn't
error — it simply isn't there. A `select *` returns only your rows. This is why
the anon key being public is fine (see below), and it's why the security test in
the checklist asserts *zero rows*, not *permission denied*.

`insert` needs `with check` as well as the others because there's no existing
row to test — the check runs against the row being written. Without it, you
could insert a row owned by someone else.

### The key that goes in the repo

Supabase gives two keys. Only one is safe here.

| Key | Safe to commit? | Why |
| --- | --- | --- |
| `anon` / publishable key | **Yes** | It's designed to ship in browser code. It grants nothing on its own — RLS is what decides what it can see. |
| `service_role` key | **Never** | It bypasses RLS entirely. In a public repo it is a full handover of the database. |

Since the site is static and served from GitHub Pages, the anon key has to be in
a committed file — there is no server to hide it behind. That's expected and
correct. The usual never-commit-secrets rule still holds absolutely for
`service_role`: it never touches this repo, not even in a `.env`.

---

## Screens

Four. No router, no framework — one page, sections shown and hidden.

### 1. Login
Email field, password field, **Sign in** and **Sign up** buttons. Shows an error
message when Supabase rejects it. This is the only screen visible when signed
out; everything else is hidden until there's a session.

### 2. Today *(the home screen)*
A list of habits. Each row: habit name, a checkbox or tappable circle for
today, and the current streak. A **+ Add habit** button. Tapping a habit's name
opens Add/Edit. Empty state when there are no habits yet: a line of text and the
add button.

### 3. Week view
A grid. One row per habit, seven columns, oldest on the left and **today on the
right**. Each cell is filled or empty. Read-only in v1 — editing past days is
out of scope.

### 4. Add / Edit habit
One text field for the name. **Save** and **Cancel**. In edit mode it also has
**Delete**, behind a confirm. Reached from the + button (add) or from tapping a
habit name (edit).

---

## The streak definition

This is the part most likely to be built wrong, so it gets its own section.

**Current streak** = the number of consecutive completed days counting backwards
from an *anchor day*, where:

- The anchor is **today** if today is completed.
- Otherwise the anchor is **yesterday**.
- If the anchor day is not completed, the streak is **0**.

The yesterday fallback is what stops the streak from reading 0 all morning
before you've done anything. Today is still ahead of you; yesterday is settled.

Worked examples, where `D` is today:

| Completed days | Anchor | Streak | Why |
| --- | --- | --- | --- |
| `D-2, D-1, D` | `D` | **3** | Three in a row ending today |
| `D-2, D-1` (today not yet done) | `D-1` | **2** | Today is still open, yesterday anchors it |
| `D-3, D-2, D` (gap at `D-1`) | `D` | **1** | The gap breaks it; earlier days don't count |
| `D-5, D-4, D-3` (nothing since) | `D-1` | **0** | Anchor day isn't completed |
| nothing ever | `D-1` | **0** | |

Consequence worth naming, because it's a checklist item: with `D-2, D-1, D`
completed the streak is 3; **unchecking today** moves the anchor to `D-1` and
the streak becomes **2**. It drops by one, it does not collapse to zero.

---

## Acceptance criteria

Each line is a yes/no you can check by hand, and each is a candidate for a test.
The loop: write the test, watch it fail, then build.

### Auth
- [ ] Signing up with a new email and password creates an account and lands on Today
- [ ] Signing in with the correct password lands on Today
- [ ] Signing in with a wrong password shows an error and stays on Login
- [ ] Refreshing the page while signed in stays signed in
- [ ] Signing out returns to Login, and refreshing does not sneak back in
- [ ] Visiting the URL signed out shows Login and no habit data

### Habits
- [ ] Creating a habit makes it appear in the Today list without a refresh
- [ ] A created habit is still there after closing and reopening the browser
- [ ] Renaming a habit changes the name everywhere it appears
- [ ] Deleting a habit removes it from the list
- [ ] Deleting a habit also deletes its completions (no orphan rows in the table)
- [ ] A habit with an empty or whitespace-only name is rejected

### Checking off
- [ ] Checking a habit for today marks it done and it stays after a refresh
- [ ] Unchecking a habit for today clears it and it stays cleared after a refresh
- [ ] Checking the same habit twice for the same day produces one row, not two
- [ ] Inserting a duplicate `(habit_id, done_on)` directly against the database is rejected by the constraint
- [ ] A completion checked off at 11pm local time is stored with today's local date, not tomorrow's

### Streak
- [ ] Three consecutive days ending today → streak reads **3**
- [ ] Two consecutive days ending yesterday, today not yet done → streak reads **2**
- [ ] A gap yesterday, with today done → streak reads **1**
- [ ] Last completion three days ago → streak reads **0**
- [ ] A habit with no completions → streak reads **0**
- [ ] Starting from a streak of 3, unchecking today → streak reads **2**
- [ ] Re-checking today → streak reads **3** again

### Week view
- [ ] The grid shows exactly 7 columns
- [ ] Today is the rightmost column
- [ ] A day that was checked off shows as filled; an unchecked day shows as empty
- [ ] A completion from 8 days ago does not appear in the grid

### Security — user A cannot reach user B's rows
Set up: sign in as **B**, create a habit, check it off. Note its `id`. Sign out.
Sign in as **A**.

- [ ] A's habit list does not contain B's habit
- [ ] Selecting all habits as A returns **only** A's rows
- [ ] Selecting B's habit by its exact `id` as A returns **0 rows** (not an error — zero rows)
- [ ] Selecting all completions as A returns none of B's
- [ ] A inserting a habit with `user_id` set to B's id is **rejected**
- [ ] A updating B's habit by id affects **0 rows**
- [ ] A deleting B's habit by id affects **0 rows**, and the habit still exists when B signs back in

---

## Build order

Small steps. **Every step ends in a commit and an app that runs** — never a
half-finished state left overnight. Steps 2 and 3 need one browser click each
from Kevin; they're marked.

| # | Step | Done when |
| --- | --- | --- |
| 0 | `.gitignore` and this `SPEC.md` | Committed. No app yet. |
| 1 | Empty page: `index.html`, `style.css`, `app.js`, a heading and nothing else | Opens locally, three separate files from day one |
| 2 | **Kevin:** Settings → Pages → `main` / root | The heading is visible at the live URL |
| 3 | **Kevin:** create the Supabase project; then wire the anon key in and log "connected" | Live page reaches Supabase without error |
| 4 | Login screen — sign up, sign in, sign out, session survives refresh | All Auth criteria pass |
| 5 | `habits` table + RLS policies; list and create habits | Habits appear and persist |
| 6 | Rename and delete, via the Add/Edit screen | All Habits criteria pass |
| 7 | `completions` table + RLS + the unique constraint; check off today | All Checking-off criteria pass |
| 8 | Streak calculation and display | All Streak criteria pass |
| 9 | Week view — the 7-day grid | All Week-view criteria pass |
| 10 | Two-account security pass | All Security criteria pass |
| 11 | `CLAUDE.md` for the repo | Written from what actually went wrong, not guessed |

**Why an empty page goes live before any feature exists.** Deployment is a
separate thing that can break for its own reasons — wrong branch, wrong folder,
a path that only works locally. Proving the pipe works while there's nothing in
it means every later failure is a code failure. Debugging deployment and
features at the same time is the thing to avoid.

**Why the tables come at 5 and 7, not both at the start.** Each table arrives
with the screen that uses it, so RLS gets tested the moment it's written rather
than three steps later.

`CLAUDE.md` is last on purpose — it records decisions already made, and on day
one none have been.

---

## Assumptions I made — say if any are wrong

| Assumption | Alternative |
| --- | --- |
| Plain HTML/CSS/JS, no build step, no framework | React + Vite, which adds a build and a deploy step |
| GitHub Pages, matching your other projects | Vercel or Netlify |
| Supabase's hosted free tier | Local Supabase via Docker |
| No email confirmation on sign-up (turned off in Supabase settings) | Leave it on, and confirm a real inbox for every test account |
| Week view is read-only | Editing past days — currently out of scope |

---

## Related

Kevin's Obsidian vault, `Starting a project/`:

- `Spec + Test Driven` — the checklist-then-red-green loop this spec feeds
- `Starting a New Project` — where this sits in the sequence
- `Git Cheat Sheet` — the Pages toggle and the secrets rule
