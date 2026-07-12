# Power Flow Insights

**A natural-language query layer over a real product's business data, with AI-generated SQL locked down by four independent security layers.**

Work in progress. Full case study (problem, architecture, risk table, results) lands when the query pipeline and eval set are done.

## What this is

[Power Flow OS](https://github.com/) is a live outreach CRM I built and run. This project adds a "Ask" layer on top of a synthetic dataset that mirrors its schema: ask a business question in plain English, get back an answer, a chart, and the exact SQL that produced it — never a black box.

The synthetic dataset stays deliberately separate from production data. Real prospect data stays private; the query layer runs against ~500 simulated leads that mirror the real funnel shape.

## Status

- [x] Repo scaffolded (Vite + React + TS)
- [ ] `demo` schema + read-only Postgres role
- [ ] Synthetic seed data
- [ ] PostHog instrumentation on Power Flow OS
- [ ] `/api/ask` — NL→SQL pipeline
- [ ] Frontend
- [ ] Docs + eval set + deploy

## Stack

React + Vite + TypeScript, Vercel serverless functions, Supabase (Postgres), Gemini 2.5 Flash for NL→SQL, PostHog for product analytics, Recharts for charts.

## Local dev

```
npm install
cp .env.example .env   # fill in values, never commit this file
npm run dev
```
