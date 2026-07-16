import type { AskResponse } from "../types";

/**
 * Pre-computed answers for the 4 suggested questions, so those buttons
 * always work even when the Gemini free-tier's daily quota is exhausted
 * (see README "Trade-offs" and docs/security.md). Numbers are real,
 * independently verified against the live database during Fase 6's
 * evaluation run — not invented for the demo.
 *
 * "Last month, by week" is date-relative and will drift out of sync with
 * a literal "now" as real time passes; that's an accepted trade-off, not
 * an oversight — the underlying dataset is static synthetic data seeded
 * once, so a live query for the same question degrades the same way once
 * enough real time passes beyond the dataset's own date range.
 */
export const CACHED_ANSWERS: Record<string, AskResponse> = {
  "Where do leads drop off?": {
    answer:
      "75% of leads get contacted, but the funnel narrows fast after that — only 18.6% reply, 7.2% book a call, 4.8% get a proposal, and 3.6% ultimately close. The biggest single drop is between being contacted and getting a reply.",
    sql: "select count(*) as total_leads, round(100.0 * count(*) filter (where status not in ('New','Ready')) / count(*), 1) as pct_contacted, round(100.0 * count(*) filter (where status in ('Replied','Call booked','Proposal sent','Won','Lost')) / count(*), 1) as pct_replied, round(100.0 * (select count(distinct lead_id) from demo.activities where type = 'call_booked') / count(*), 1) as pct_call_booked, round(100.0 * (select count(distinct lead_id) from demo.activities where type = 'proposal_sent') / count(*), 1) as pct_proposal, round(100.0 * count(*) filter (where status = 'Won') / count(*), 1) as pct_won from demo.leads",
    explanation: "Computes what percentage of all leads reach each pipeline stage, so you can see exactly where the funnel narrows.",
    rows: [
      { total_leads: "500", pct_contacted: "75.0", pct_replied: "18.6", pct_call_booked: "7.2", pct_proposal: "4.8", pct_won: "3.6" },
    ],
    chart: "number",
    refused: false,
  },

  "Which channel converts best?": {
    answer:
      "The 'warm' channel converts best by far, with 25.0% of its leads resulting in a win — outperforming referral (16.7%) and agency (3.0%). LinkedIn brings in the most volume (236 leads) but converts worst, at 0.0%.",
    sql: "select channel, count(*) as total, round(100.0 * count(*) filter (where status not in ('New','Ready')) / count(*), 1) as pct_contacted, round(100.0 * count(*) filter (where status in ('Replied','Call booked','Proposal sent','Won','Lost')) / count(*), 1) as pct_replied_or_further, round(100.0 * count(*) filter (where status = 'Won') / count(*), 1) as pct_won from demo.leads group by channel order by pct_replied_or_further desc",
    explanation: "Groups leads by acquisition channel and shows how far each channel's leads make it through the funnel, ranked by engagement.",
    rows: [
      { channel: "warm", total: "40", pct_contacted: "72.5", pct_replied_or_further: "40.0", pct_won: "25.0" },
      { channel: "referral", total: "24", pct_contacted: "75.0", pct_replied_or_further: "33.3", pct_won: "16.7" },
      { channel: "agency", total: "67", pct_contacted: "74.6", pct_replied_or_further: "19.4", pct_won: "3.0" },
      { channel: "upwork", total: "133", pct_contacted: "72.2", pct_replied_or_further: "17.3", pct_won: "1.5" },
      { channel: "linkedin", total: "236", pct_contacted: "77.1", pct_replied_or_further: "11.4", pct_won: "0.0" },
    ],
    chart: "bar",
    refused: false,
  },

  "How many leads did we get last month, by week?": {
    answer:
      "Over that stretch, weekly lead volume held steady in the high teens to low twenties — 16, 19, 20, and 17 leads across four consecutive weeks, 72 total.",
    sql: "select date_trunc('week', created_at)::date as week_start, count(*) as leads_created from demo.leads where created_at >= now() - interval '1 month' group by 1 order by 1",
    explanation: "Counts new leads per week over the last month, so you can see whether volume is trending up or down.",
    rows: [
      { week_start: "2026-06-15T00:00:00.000Z", leads_created: "16" },
      { week_start: "2026-06-22T00:00:00.000Z", leads_created: "19" },
      { week_start: "2026-06-29T00:00:00.000Z", leads_created: "20" },
      { week_start: "2026-07-06T00:00:00.000Z", leads_created: "17" },
    ],
    chart: "line",
    refused: false,
  },

  "What's the average time from contact to reply?": {
    answer:
      "On average, it takes 6.0 days from the first outreach message to get a reply, based on 93 measured replies. That's higher than any single touch's 1-5 day window because some replies land after the 2nd or 3rd follow-up, not the first message.",
    sql: "select round(avg(extract(epoch from (r.occurred_at - m.occurred_at)) / 86400.0), 1) as avg_days_contact_to_reply, count(*) as replies_measured from demo.activities r join demo.activities m on m.lead_id = r.lead_id and m.type = 'message_sent' where r.type = 'reply_received'",
    explanation: "Measures the average number of days between the first outreach message and a reply, across every lead that has replied so far.",
    rows: [{ avg_days_contact_to_reply: "6.0", replies_measured: "93" }],
    chart: "number",
    refused: false,
  },
};
