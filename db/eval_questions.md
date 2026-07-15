# Evaluation set — DRAFT, pending Daniel's review

**Status: not run yet.** Per project rule, this set is validated/edited by
Daniel — his business questions, his judgment of "correct" — not
self-graded by whoever builds the pipeline. This draft is a starting point
based on `db/ground_truth.md` and the funnel logic in `db/generate.ts`,
covering a spread of chart types and two questions that should be refused.
Edit freely: change wording, drop, add, reorder. Nothing runs against these
until you say go.

1. Where do leads drop off?
2. Which channel converts best?
3. How many leads did we get last month, by week?
4. What's the average time from contact to reply?
5. How many leads came in through LinkedIn?
6. What percentage of leads are still sitting in "Ready," never contacted?
7. Show me all leads from the referral channel.
8. How many leads have we won?
9. What's the win rate for warm leads specifically?
10. How many leads are currently marked Dormant?
11. Compare weekly lead volume over the last two months.
12. What's the breakdown of leads by company size?
13. How many messages went out last week?
14. What's the conversion rate from call booked to won?
15. Which country do most of our leads come from?
16. How many contacted leads never got a reply?
17. Which day of the week do we get the most new leads?
18. How many leads are in the Proposal Sent stage right now?
19. What was our revenue last quarter? *(expected: refused — no revenue data in this schema)*
20. How many users does the app have? *(expected: refused — no user/account data in this schema)*

## How the eval will run and be scored

- Each question goes through `/api/ask` exactly once (no retries), question
  and full response logged.
- Daniel judges each response: correct / wrong / refused-when-shouldn't-be
  / should-have-refused-but-didn't. Not "does the SQL look reasonable" —
  does the *answer* match what Daniel independently knows or can verify
  against `db/ground_truth.md` or a spot-check query.
- % reported is `correct / 20`, reported as-is. One iteration on
  prompt/few-shots allowed if the number disappoints; the number itself
  doesn't get adjusted after the fact.
