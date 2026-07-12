-- Power Flow Insights — demo schema + read-only Postgres role
--
-- Applied to the existing "Power Flow OS" Supabase project (ref
-- kzqhcgiebkmyclcvagus), isolated in its own `demo` schema — separate from
-- the production CRM tables in `public`. This file is the source of truth;
-- it was applied via Supabase migrations, not run by hand.
--
-- Security model (see docs/security.md for the full defense-in-depth writeup):
-- the AI-generated SQL in api/ask.ts runs as `insights_readonly`, a role that
-- can only SELECT from `demo.leads` and `demo.activities`. Nothing else —
-- no INSERT/UPDATE/DELETE, no access to `public` or any other schema, and a
-- 5s statement timeout so even a runaway query can't hang the connection.

create schema if not exists demo;

create table demo.leads (
  id bigint generated always as identity primary key,
  name text not null,
  company text not null,
  channel text not null check (channel in ('linkedin','upwork','agency','warm','referral')),
  company_size text check (company_size in ('1-10','11-50','51-200','200+')),
  country text,
  status text not null,          -- New/Ready/Contacted/T2 sent/T3 sent/Replied/Call booked/Proposal sent/Won/Lost/Dormant
  created_at timestamptz not null
);

create table demo.activities (
  id bigint generated always as identity primary key,
  lead_id bigint references demo.leads(id),
  type text not null,            -- lead_created/message_sent/touch2_sent/touch3_sent/reply_received/call_booked/proposal_sent/won/lost/marked_dormant
  occurred_at timestamptz not null
);

create index on demo.leads (channel);
create index on demo.leads (status);
create index on demo.leads (created_at);
create index on demo.activities (lead_id);
create index on demo.activities (occurred_at);
create index on demo.activities (type);

-- Read-only role (the piece that actually matters for security).
--
-- Created LOGIN with no password clause — rolpassword starts NULL, so the
-- role can't authenticate until a password is set. On this Supabase project,
-- the platform's own role-sync auto-assigns a random SCRAM password to any
-- new LOGIN role shortly after creation (visible in Database > Roles). That
-- auto-assigned value was never seen or recorded anywhere by the assistant
-- that ran this migration — it must still be reset by hand in the dashboard
-- so the person who will actually use it is the only one who knows it.
create role insights_readonly login;

grant usage on schema demo to insights_readonly;
grant select on all tables in schema demo to insights_readonly;
alter default privileges in schema demo grant select on tables to insights_readonly;

-- Explicitly nothing granted on `public` or any other schema — isolation is
-- the Postgres default (roles start with zero privileges), stated here so
-- it's auditable rather than implicit.

alter role insights_readonly set statement_timeout = '5s';

-- Manual step (see plans/portfolio/pasos_daniel.md):
--   1. Supabase Dashboard > Database > Roles > insights_readonly > reset password.
--   2. Build the pooler connection string with that password as DEMO_DB_URL.
--   3. Paste DEMO_DB_URL into Vercel env vars (Fase 4) and CREDENTIALS.md.
--      Never into this file, a chat, or any other repo file.
