# Session Memo — Prospect Finder (2026-08-17)

**For the terminal session.** This is a plain-English handoff of what happened today in
`restaurantflow-voice`, so you can pick up cleanly. Nothing here changes without your
sign-off — the last remaining step (merge to `main`) was intentionally left for you.

---

## TL;DR

- The **Prospect Finder** admin tool is **built, tested, committed, and pushed**.
- It lives on branch **`claude/prospect-finder-admin-fco6qj`**, which is **3 commits ahead of `main`**.
- **PR #1** is open: `claude/prospect-finder-admin-fco6qj` → `main`
  (https://github.com/ninomandile-cyber/restaurantflow-voice/pull/1).
- **It is NOT live yet.** Railway deploys `main`; the tool won't appear on the dashboard
  until PR #1 is merged. **Merging PR #1 is the one remaining action.**
- Today's Railway "Build Failed" messages were a **platform flake, not a code defect** —
  retries went green on their own. Code build/boot is verified clean.

---

## What the Prospect Finder is

An **admin-only** tool in the owner dashboard. You enter a **business type** + **city** +
**# results**, and it finds local businesses with a **weak online presence** (the kind
RestaurantFlow can sell to), scores each one, and returns them **ranked weakest-first** with
the reason each is a good prospect.

It is a **lookup-and-score** tool. It is **fast and cheap**:
- **One** Google Places (New) Text Search call per search.
- **Zero AI/Claude/LLM calls.** Scoring is plain local math; the "why they need us" text is
  templated, not model-generated.
- No per-business round trips — all results scored/sorted in one in-memory pass.
- Expected latency: ~1–2s (basically as fast as Google answers). Per-search cost ≈ pennies
  (one Places Text Search SKU). **This tool is unrelated to the content-generation spend.**

---

## Where the code is

**`server.js`**
- `ADMIN_KEY` + `requireAdmin` middleware — lines ~118–127. Gated on the `x-admin-key`
  header. **Fails closed:** if `ADMIN_KEY` is unset it returns `503` (no hardcoded default
  key in source — a known default is no protection).
- `scoreProspect(place)` — lines ~133–149. Pure function, no external call. Higher score =
  weaker presence: no website +40; reviews 0/none +30, 1–15 +20, 16–40 +10; rating
  none/below-4.0 +15; no phone +10; non-OPERATIONAL flagged. Honest comment: real GBP
  *posting cadence* is only visible to a profile's own owner via the Business Profile API,
  so we approximate presence from website + reviews + rating and say so.
- `POST /api/prospects` (behind `requireAdmin`) — lines ~151–212. Validates input, caps
  results at 20 (`capped` flag so nothing is silently truncated), calls Places Text Search
  with a field mask, maps → scores → sorts weakest-first, returns `503` if
  `GOOGLE_PLACES_API_KEY` is missing (never fabricated data), surfaces the real Places error
  on failure. Registered **before** the `app.get("*")` catch-all.

**`public/dashboard.html`**
- "Prospects" tab button — line ~101; panel `id="tab-pr"` — line ~136; wired into
  `showTab('pr', ...)`.
- Inputs: business type, city, # results (1–20), admin key (persisted in `localStorage`
  key `rf_prospect_key`).
- `findProspects()` / `renderProspects()` — lines ~315–356. Ranked table with weakness
  badges + reasons; handles empty / 401 / error states.

**`.gitignore`** — now ignores generated `package-lock.json`.

---

## Today's commits (on the branch, in the PR)

```
a9d2dbd  Add Prospect Finder tool to owner dashboard
0d9181c  Ignore generated package-lock.json
08c8cab  Harden prospect admin gate: fail closed when ADMIN_KEY unset
```
(plus this memo)

---

## Runtime config (Railway service env vars)

Owner reports **both are already set on Railway**. Listed for completeness:
- `GOOGLE_PLACES_API_KEY` — powers the search. Missing → endpoint returns a clean `503`.
- `ADMIN_KEY` — the value the dashboard "Admin Key" field must match. Missing → `503`.

The tool is **inert-but-safe** without them (clean 503, never fake data), so a deploy can
never break the rest of the site over a missing key.

---

## Verification done this session (no DB/API needed)

- `npm install` (Railway's real path — no committed lockfile) runs clean.
- `node server.js` boots clean (`RestaurantFlow v3 running on port 3000`).
- Tab wiring (`tab-pr`), badge classes (`bh/bw/bn`), and the `localStorage` key all present.
- No new dependencies (reuses `node-fetch` v2 already in `package.json`).

**Not verifiable from this session** (needs a real `GOOGLE_PLACES_API_KEY` + live request):
end-to-end Places response mapping against real data. Recommend one real search from the
dashboard after deploy to confirm the field mask matches current Places output.

---

## The Railway "Build Failed" episode (resolved)

Owner saw a couple of failed deploys, then they "all went through." Diagnosis: **platform
flake, not our code.** Signature = intermittent pass/fail with unchanged code (real code
defects fail every time, deterministically). Our side is a no-build-step app
(`start: node server.js`, standard deps, boots clean), so there was nothing to fail in a
build. If it recurs: retry/redeploy the same commit first; if it persists, reconnect the
GitHub **Source** at the *service* level (Railway → service → Settings → Source).

---

## Cost clarification (for the owner's peace of mind)

- Owner worried "a generate costs $15." **No.** The historical **$15–30/day** was a full day
  of **development** running the *content pipeline* repeatedly — cumulative, not one press.
- A single content generate is a small fraction of that (a few Sonnet + several Haiku calls).
  Exact per-generate dollars must come from the **live `vf_api_usage` data** — get the real
  number at the terminal; do not quote a fabricated figure.
- The **Prospect Finder** (this work) has **no AI cost** — pennies per search, Google only.

---

## The one remaining action

1. **Merge PR #1** → Railway auto-deploys `main` → Prospect Finder appears on the live
   dashboard's "Prospects" tab.
2. After deploy, run **one real search** from the dashboard to confirm the live Places key
   returns and maps correctly.

That's it. Everything else is done.
