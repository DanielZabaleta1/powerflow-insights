import { faker } from '@faker-js/faker';

export type Channel = 'linkedin' | 'upwork' | 'agency' | 'warm' | 'referral';
export type CompanySize = '1-10' | '11-50' | '51-200' | '200+';

export interface GeneratedLead {
  name: string;
  company: string;
  channel: Channel;
  company_size: CompanySize;
  country: string;
  status: string;
  created_at: string;
}

export interface GeneratedActivity {
  leadIndex: number;
  type: string;
  occurred_at: string;
}

const DAY_MS = 86_400_000;
const NUM_LEADS = 500;
const WINDOW_DAYS = 180;
const SEED = 42;

// Channel mix — cold LinkedIn outreach is the bulk of volume, referral is rare
// but converts far better. This is the shape that makes the funnel questions
// in Fase 4 interesting to ask.
const CHANNEL_MIX: [Channel, number][] = [
  ['linkedin', 0.45],
  ['upwork', 0.25],
  ['agency', 0.15],
  ['warm', 0.10],
  ['referral', 0.05],
];

const SIZE_MIX: [CompanySize, number][] = [
  ['1-10', 0.35],
  ['11-50', 0.35],
  ['51-200', 0.20],
  ['200+', 0.10],
];

const COUNTRY_MIX: [string, number][] = [
  ['United States', 0.40],
  ['Canada', 0.15],
  ['United Kingdom', 0.10],
  ['Mexico', 0.08],
  ['Costa Rica', 0.07],
  ['Colombia', 0.07],
  ['Spain', 0.05],
  ['Australia', 0.03],
  ['Germany', 0.03],
  ['Panama', 0.02],
];

// Every lead has the same chance of getting a first touch — outreach cadence
// doesn't care about channel. What differs by channel is engagement quality
// downstream: referral/warm leads already trust you, cold LinkedIn doesn't.
const CONTACTED_RATE = 0.76;

// Conditional probabilities per stage, by channel. Derived so the population
// average (weighted by CHANNEL_MIX) lands on the funnel targets from the
// project guide — contacted 75% -> replied 22% -> call booked 8% ->
// proposal 5% -> won 2% (as % of total leads) — while referral/warm convert
// ~3x better than cold linkedin at every stage. See db/ground_truth.md for
// the measured result.
const CHANNEL_RATES: Record<Channel, { replied: number; callBooked: number; proposal: number; won: number }> = {
  linkedin: { replied: 0.19, callBooked: 0.24, proposal: 0.41, won: 0.26 },
  upwork: { replied: 0.27, callBooked: 0.34, proposal: 0.58, won: 0.37 },
  agency: { replied: 0.32, callBooked: 0.40, proposal: 0.68, won: 0.44 },
  warm: { replied: 0.58, callBooked: 0.72, proposal: 0.95, won: 0.79 },
  referral: { replied: 0.64, callBooked: 0.80, proposal: 0.95, won: 0.88 },
};

function mulberry32(seed: number) {
  let t = seed;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(rng: () => number, pool: [T, number][]): T {
  const roll = rng();
  let cumulative = 0;
  for (const [value, weight] of pool) {
    cumulative += weight;
    if (roll < cumulative) return value;
  }
  return pool[pool.length - 1][0];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Weighted day sampling over the last WINDOW_DAYS: weekends get 40% the
 *  weight of weekdays, so lead creation visibly thins out on Sat/Sun. */
function sampleCreatedAt(rng: () => number, now: Date): Date {
  const offsets: number[] = [];
  const weights: number[] = [];
  for (let d = 0; d < WINDOW_DAYS; d++) {
    const candidate = addDays(now, -d);
    offsets.push(d);
    weights.push(isWeekend(candidate) ? 0.4 : 1.0);
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pool: [number, number][] = offsets.map((d, i) => [d, weights[i] / totalWeight]);
  const daysAgo = weightedPick(rng, pool);
  const day = addDays(now, -daysAgo);
  // business hours, 8am-6pm local
  const hour = 8 + rng() * 10;
  day.setHours(Math.floor(hour), Math.floor(rng() * 60), 0, 0);
  return day;
}

export function generateDataset(now: Date = new Date()): { leads: GeneratedLead[]; activities: GeneratedActivity[] } {
  faker.seed(SEED);
  const rng = mulberry32(SEED);

  const leads: GeneratedLead[] = [];
  const activities: GeneratedActivity[] = [];

  for (let i = 0; i < NUM_LEADS; i++) {
    const channel = weightedPick(rng, CHANNEL_MIX);
    const companySize = weightedPick(rng, SIZE_MIX);
    const country = weightedPick(rng, COUNTRY_MIX);
    const name = faker.person.fullName();
    const company = faker.company.name();
    const createdAt = sampleCreatedAt(rng, now);

    const leadActivities: GeneratedActivity[] = [
      { leadIndex: i, type: 'lead_created', occurred_at: createdAt.toISOString() },
    ];

    let status: string;
    const rates = CHANNEL_RATES[channel];
    const contacted = rng() < CONTACTED_RATE;

    if (!contacted) {
      const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
      status = ageDays < 2 ? 'New' : 'Ready';
    } else {
      const messageSentAt = addDays(createdAt, randInt(rng, 0, 2));
      leadActivities.push({ leadIndex: i, type: 'message_sent', occurred_at: messageSentAt.toISOString() });

      // Decide, up front, whether this lead ever replies and after which
      // touch — then only materialize it if the reply date has actually
      // happened by `now`. Anything past `now` falls back to "still mid
      // sequence", which keeps every activity chronologically real.
      const willReply = rng() < rates.replied;
      const replyTouch = willReply ? weightedPick(rng, [[1, 0.5], [2, 0.3], [3, 0.2]] as [number, number][]) : 0;

      const touch2At = addDays(messageSentAt, 4);
      const touch3At = addDays(touch2At, 4);

      let replySourceAt = messageSentAt;
      if (replyTouch >= 2) replySourceAt = touch2At;
      if (replyTouch >= 3) replySourceAt = touch3At;
      const candidateReplyAt = willReply ? addDays(replySourceAt, randInt(rng, 1, 5)) : null;
      const repliedInTime = !!candidateReplyAt && candidateReplyAt.getTime() <= now.getTime();

      if (!repliedInTime) {
        const dormantAt = addDays(touch3At, 3);
        if (now.getTime() >= touch2At.getTime()) {
          leadActivities.push({ leadIndex: i, type: 'touch2_sent', occurred_at: touch2At.toISOString() });
        }
        if (now.getTime() >= touch3At.getTime()) {
          leadActivities.push({ leadIndex: i, type: 'touch3_sent', occurred_at: touch3At.toISOString() });
        }
        if (now.getTime() >= dormantAt.getTime()) {
          leadActivities.push({ leadIndex: i, type: 'marked_dormant', occurred_at: dormantAt.toISOString() });
          status = 'Dormant';
        } else if (now.getTime() >= touch3At.getTime()) {
          status = 'T3 sent';
        } else if (now.getTime() >= touch2At.getTime()) {
          status = 'T2 sent';
        } else {
          status = 'Contacted';
        }
      } else {
        const replyAt = candidateReplyAt as Date;
        if (replyTouch >= 2) leadActivities.push({ leadIndex: i, type: 'touch2_sent', occurred_at: touch2At.toISOString() });
        if (replyTouch >= 3) leadActivities.push({ leadIndex: i, type: 'touch3_sent', occurred_at: touch3At.toISOString() });
        leadActivities.push({ leadIndex: i, type: 'reply_received', occurred_at: replyAt.toISOString() });
        status = 'Replied';

        if (rng() < rates.callBooked) {
          const callBookedAt = addDays(replyAt, randInt(rng, 1, 4));
          if (callBookedAt.getTime() <= now.getTime()) {
            leadActivities.push({ leadIndex: i, type: 'call_booked', occurred_at: callBookedAt.toISOString() });
            status = 'Call booked';

            if (rng() < rates.proposal) {
              const proposalAt = addDays(callBookedAt, randInt(rng, 1, 5));
              if (proposalAt.getTime() <= now.getTime()) {
                leadActivities.push({ leadIndex: i, type: 'proposal_sent', occurred_at: proposalAt.toISOString() });
                status = 'Proposal sent';

                if (rng() < rates.won) {
                  const wonAt = addDays(proposalAt, randInt(rng, 3, 14));
                  if (wonAt.getTime() <= now.getTime()) {
                    leadActivities.push({ leadIndex: i, type: 'won', occurred_at: wonAt.toISOString() });
                    status = 'Won';
                  }
                } else {
                  const lostAt = addDays(proposalAt, randInt(rng, 5, 20));
                  if (lostAt.getTime() <= now.getTime()) {
                    leadActivities.push({ leadIndex: i, type: 'lost', occurred_at: lostAt.toISOString() });
                    status = 'Lost';
                  }
                }
              }
            }
          }
        }
      }
    }

    leads.push({ name, company, channel, company_size: companySize, country, status, created_at: createdAt.toISOString() });
    activities.push(...leadActivities);
  }

  return { leads, activities };
}
