# Tracking plan — Power Flow OS product analytics

Written before any instrumentation code, per standard practice: a tracking
plan is a product decision (what to measure, why), not an implementation
detail — it shouldn't be reverse-engineered from whatever the code happened
to touch.

## Why this exists alongside the `demo.activities` funnel

Power Flow OS already logs a business-state trail in `activities`
(`lead_created`, `message_sent`, `reply_received`, etc. — see
`db/schema.sql`). That answers *business* questions: where is the pipeline,
what's the conversion rate. PostHog answers a different question: how is the
**product** actually being used — which screens get opened, how often drafts
get edited before sending, whether the operator works from the Pipeline
board or Session Mode. Power Flow OS is single-user today, so "product
analytics" here means feature adoption and workflow friction, not cohort
behavior across many users — a real caveat, stated plainly rather than
inflated.

## Events

| Event | Fires when | Properties | Business question it answers |
|---|---|---|---|
| `lead_created` | A new lead is saved via the New Lead form | `channel` | How many leads come in, and from which channel — is sourcing keeping up with the pipeline burning through leads? |
| `draft_approved` | A LinkedIn content draft is approved (edited or as-is) before publishing | `was_edited` (bool: did the approved text differ from the AI draft) | How much of the AI-drafted content survives review untouched vs. needs rework — is the draft quality good enough to trust more, or does it need a better prompt? |
| `message_sent` | An outreach message is marked sent — first touch or a scheduled follow-up (T2/T3) | `touch` (`1`, `2`, or `3`), `source` (`"today"` or `"session_mode"`) | How much outreach volume actually goes out per week, and which of the two send workflows (daily Today ritual vs. batched Session Mode) the operator actually uses |
| `status_changed` | A lead's pipeline status changes, from any of the 7 places that write `leads.status` | `from`, `to`, `source` (`"pipeline_board"`, `"lead_drawer"`, `"today"`, or `"session_mode"`) | Where in the product do status transitions actually happen — does the kanban board drive the pipeline, or does most movement happen inside the daily ritual screens? |
| `dashboard_viewed` | The Dashboard view mounts | — | How often the operator checks the dashboard vs. spends all their time in the working screens (Today, Pipeline, Session Mode) |
| `ask_opened` *(future)* | The natural-language "Ask" feature (this repo, Fase 4) is opened | — | Whether the NL query layer actually gets used once shipped, and how that compares to time spent elsewhere. No hook exists yet in `power-flow-os` — added when the Ask UI ships. |

## Coverage notes (why 7 call sites for 2 events)

`message_sent` and `status_changed` aren't emitted from one centralized
function today — `power-flow-os` has two independent "mark sent" workflows
(`Today.tsx`, `SessionMode.tsx`) and status gets written from 4 places
(`Pipeline.tsx`, `Leads.tsx` via the shared `setLeadStatus` helper, plus
inline writes inside both "mark sent" flows and `leadReplied`/
`followupDone`). Rather than refactor Power Flow OS to route every status
write through one function — out of scope for a minimal, low-risk diff on a
production CRM — each of the 7 existing call sites gets its own `track()`
call with a `source` property that identifies which UI triggered it. The
`track()` helper itself stays centralized (`src/lib/track.ts`); only the call
*sites* are distributed, matching where the business logic already lives.

## What's explicitly not tracked (v1)

- Lead names, companies, or message content — no PII in event properties.
- Anything from `Content.tsx` beyond the approve action (no view/scroll
  tracking) — not useful at single-user volume.
- Session/page-view analytics beyond `dashboard_viewed` — PostHog's default
  autocapture is left off; every event here is an explicit business action.
