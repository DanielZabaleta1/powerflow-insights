# Evaluation set — finalized, per Daniel + Fable's review

**Status: not run yet.** Per project rule, this set is validated/edited by
Daniel — his business questions, his judgment of "correct" — not
self-graded by whoever builds the pipeline. Original draft was too close to
the model's own few-shot examples (questions 1-4 nearly mirrored the SQL
baked into `api/_lib/system-prompt.ts`, which would have scored the pipeline
against cases it was explicitly shown how to answer). Revised per Fable's
review: swapped 1-4 for novel angles, added one deliberately ambiguous
question and one that sounds answerable but isn't (no per-message content is
stored — an honest schema gap, not a bug). A harder, honest set beats an easy
20/20 against the model's own examples.

1. How are things going with the pipeline? *(deliberately ambiguous — no fixed metric named)*
2. Which of our messages got the best response rate? *(expected: refused — message content/per-message outcomes aren't stored, only aggregate activity events)*
3. What's the busiest month for closing deals?
4. How many leads have been contacted but never moved past that stage?
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
