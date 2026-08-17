# OpenAI Integration — Ready-to-Apply Plan (for the VisibilityFlow repo)

> **This code goes in the VisibilityFlow `server.js`, NOT this repo.** It's saved here
> because this session can only push to `restaurantflow-voice`. The terminal (which has the
> VisibilityFlow repo + API access) applies it. Everything below is **dormant** — it changes
> nothing until you set a key AND flip a flag AND map a task.

**Owner intent this satisfies:** install OpenAI as an *option*, reduce cost, but **Sophia stays
the brain** and **content quality is never gambled** — each task is A/B-tested before it
switches. Written against the real VisibilityFlow code (shared `fetchAnthropicWithTimeout` /
`fetchWithTimeout`, `logApiUsage`, `estimateApiCostUsd`, `VF_MODEL_PRICING`).

**Verified in isolation (2026-08-17):** the router block passes `node --check` and 4 runtime
shape tests — (1) flag off → Anthropic untouched, (2) flag on but task unmapped → Anthropic,
(3) flag on + mapped + key → OpenAI normalized to Claude's shape, (4) mapped but no key →
falls back to Anthropic. It has NOT been run against the live OpenAI API (needs the key).

---

## The idea in one line

Sophia = the brain (prompts, logic, persona — unchanged). The model (Claude or GPT) = the
engine underneath. This adds a **router** so a given task can run on either engine, defaulting
100% to Claude, and only using GPT for a task **after** GPT is proven equal-or-better for it.

---

## STEP 1 — Add OpenAI prices to `VF_MODEL_PRICING` (additive, ~line 411)

```js
  // ---- OpenAI (verify current rates; unknown models fall back to Sonnet pricing = safe over-estimate) ----
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 }
```

## STEP 2 — Paste the dormant router (anywhere after `fetchWithTimeout`, e.g. ~line 1303)

```js
// ============================================================================
// MULTI-PROVIDER MODEL ROUTER (DORMANT — installed 2026-08-17)
// Sophia stays the brain. This only swaps the ENGINE (Claude vs OpenAI) under a
// call; it replaces no prompt or logic. OpenAI is used for a task ONLY when ALL:
//   (1) AI_PROVIDER_ROUTING_ENABLED === 'true'
//   (2) AI_TASK_ROUTING[feature] === 'openai'   (map starts EMPTY)
//   (3) process.env.OPENAI_API_KEY is present
// Any miss -> Anthropic. callModel() returns the SAME Anthropic-shaped JSON existing
// code consumes ({content:[{text}], usage:{input_tokens,output_tokens}}), so a call
// site switches with no other change and logApiUsage()/estimateApiCostUsd() are
// unmodified. OpenAI failure fails SAFE back to Anthropic.
// ============================================================================
var AI_PROVIDER_ROUTING_ENABLED = (process.env.AI_PROVIDER_ROUTING_ENABLED === 'true');

// Per-task engine map. Everything defaults to Anthropic. Add 'feature':'openai' ONLY
// after the A/B proves parity for that feature. Starts EMPTY = zero behavior change.
var AI_TASK_ROUTING = {
  // 'runContentQualityGate': 'openai',
};

var OPENAI_MODEL_FOR_TIER = {
  strong: 'gpt-4o',       // Sonnet-class tasks (content/strategy) — switch LAST, only if it wins
  cheap:  'gpt-4o-mini'   // Haiku-class tasks (gates/classification) — safe to try FIRST
};

function resolveModelEngine(feature) {
  if (!AI_PROVIDER_ROUTING_ENABLED) return 'anthropic';
  if (AI_TASK_ROUTING[feature] === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  return 'anthropic';
}

// opts: { feature, model (anthropic id), openaiModel?, max_tokens, prompt, system?, temperature? }
async function callModel(opts) {
  var engine = resolveModelEngine(opts.feature);
  if (engine === 'openai') {
    try { return await _callOpenAIClaudeShaped(opts); }
    catch (e) {
      console.error('[ModelRouter] OpenAI failed for', opts.feature, '- falling back to Anthropic:', e.message);
      return await _callAnthropicClaudeShaped(opts);
    }
  }
  return await _callAnthropicClaudeShaped(opts);
}

async function _callAnthropicClaudeShaped(opts) {
  var body = { model: opts.model, max_tokens: opts.max_tokens, messages: [{ role: 'user', content: opts.prompt }] };
  if (opts.system) body.system = opts.system;
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  var r = await fetchAnthropicWithTimeout({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  var d = await r.json();
  if (d && !d._engine) { d._engine = 'anthropic'; d._model = opts.model; }
  return d;
}

async function _callOpenAIClaudeShaped(opts) {
  var oaModel = opts.openaiModel || OPENAI_MODEL_FOR_TIER.strong;
  var messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.prompt });
  var body = { model: oaModel, messages: messages, max_tokens: opts.max_tokens };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  var r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify(body)
  });
  var d = await r.json();
  if (d && d.error) throw new Error('OpenAI: ' + (d.error.message || 'unknown error'));
  var text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  var u = d.usage || {};
  return {
    content: [{ type: 'text', text: text }],
    usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 },
    _engine: 'openai', _model: oaModel, _raw: d
  };
}
```

## STEP 3 — Env vars (Railway, VisibilityFlow service)

- `OPENAI_API_KEY` — the `sk-...` key. **Absent = router can never use OpenAI** (safe).
- `AI_PROVIDER_ROUTING_ENABLED` — leave **unset/`false`** until you're ready to test. Set to
  `true` only when at least one task is mapped and you want it live.

Both absent today = literally zero change to production.

---

## STEP 4 — Convert ONE cheap call site (the only edit that touches a live path)

Start with a **cheap, low-risk** task — a Haiku gate/classifier, e.g. `runContentQualityGate`
(~line 4431). **Do NOT start with `generateContent` or `runJarvis` (the published content).**

**Before:**
```js
var r = await fetchAnthropicWithTimeout({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, temperature: 0, messages: [{ role: 'user', content: prompt }] })
});
var d = await r.json();
logApiUsage(profile && profile.id, 'runContentQualityGate', 'claude-haiku-4-5-20251001', d);
```

**After (behaves identically until the task is mapped + flag on + key set):**
```js
var d = await callModel({
  feature: 'runContentQualityGate',
  model: 'claude-haiku-4-5-20251001',
  openaiModel: OPENAI_MODEL_FOR_TIER.cheap,
  max_tokens: 500, temperature: 0, prompt: prompt
});
logApiUsage(profile && profile.id, 'runContentQualityGate', d._model, d);
```

Note `d._model` in logApiUsage — cost is attributed to whichever engine actually ran, so
`/api/admin/cost-summary` stays accurate.

---

## STEP 5 — A/B test BEFORE mapping a task to OpenAI (the quality gate)

Run each candidate task on real inputs through BOTH engines and read the outputs side by side.
Minimal harness (run at the terminal with both keys set):

```js
// scripts/ab_provider.js  — run: railway run node scripts/ab_provider.js
var s = require('../server.js');
(async () => {
  var prompt = '...a real prompt captured from the task under test...';
  var claude = await s.callModel({ feature:'_ab', model:'claude-haiku-4-5-20251001', max_tokens:500, temperature:0, prompt });
  // temporarily force openai for the test:
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  var gpt = await s._callOpenAIClaudeShaped({ openaiModel:'gpt-4o-mini', max_tokens:500, temperature:0, prompt });
  console.log('CLAUDE:\n', claude.content[0].text, '\n\nGPT:\n', gpt.content[0].text);
})();
```
(Export `callModel` and `_callOpenAIClaudeShaped` in `module.exports` for this.)

**Rule:** map a task to `'openai'` in `AI_TASK_ROUTING` **only if GPT is clearly equal-or-better
for it.** If worse or uncertain → leave it on Claude. This is the owner's non-negotiable:
never lower content quality to save money.

---

## Rollout order (safest → most sensitive)

1. **Classification / gates / observation** (Haiku tasks: `runContentQualityGate`, family/dup
   classifiers, extract* helpers) → `gpt-4o-mini`. Low quality risk, biggest call *count*.
2. **Research/citation checks** → test individually.
3. **Published strategy + content** (`runJarvis`, `generateContent`, blog, smart-website) →
   `gpt-4o`, **LAST, and only if it wins the A/B on real customer content.** When in doubt,
   these stay on Claude. This is where your $49 product lives.

## Do NOT
- Do NOT set `AI_PROVIDER_ROUTING_ENABLED=true` before at least one task passed its A/B.
- Do NOT map `generateContent`/`runJarvis` to OpenAI on price alone — quality gate first.
- Do NOT remove the Anthropic path. The router *falls back* to it on any OpenAI failure.
- Do NOT paste the key anywhere but Railway env vars.

## How you'll SEE it working
`/api/admin/cost-summary` already logs per-call model + cost. After a task switches, its rows
show the `gpt-*` model and lower cost. Compare a day before vs. after for the real dollar drop.
