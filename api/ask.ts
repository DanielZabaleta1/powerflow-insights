import { GoogleGenAI } from "@google/genai";
import postgres from "postgres";
import { SYSTEM_INSTRUCTION } from "./_lib/system-prompt.js";
import { SQL_RESPONSE_SCHEMA, type SqlGenerationResult } from "./_lib/response-schema.js";
import { validateSql } from "./_lib/validate-sql.js";
import { trackAskQuestion } from "./_lib/analytics.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Reused across warm serverless invocations; postgres.js manages its own
// connection pool internally. max: 1 keeps this endpoint from opening more
// connections than a single-user tool ever needs against the pooler.
let sqlClient: ReturnType<typeof postgres> | undefined;
function db() {
  if (!sqlClient) {
    sqlClient = postgres(process.env.DEMO_DB_URL!, { ssl: "require", max: 1, idle_timeout: 10 });
  }
  return sqlClient;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// The Gemini free tier's daily request quota (see docs/security.md) is low
// enough that a public demo can exhaust it — this is a known, accepted
// trade-off (see README "Trade-offs"), not a bug, so it gets a message that
// says what actually happened instead of a generic error.
function isQuotaError(err: unknown): boolean {
  return (err as { status?: number })?.status === 429;
}
const QUOTA_MESSAGE = "Live demo limit reached for today — try one of the example questions above (they're always available).";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const startedAt = Date.now();
  let question: string;
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  if (!question) {
    return jsonResponse({ error: "Missing 'question' field." }, 400);
  }

  // Layer 1 of 4: Gemini generates SQL as structured output. This is a
  // starting point, never a source of trust — see docs/security.md.
  let generated: SqlGenerationResult;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SQL_RESPONSE_SCHEMA,
      },
    });
    generated = JSON.parse(response.text ?? "{}") as SqlGenerationResult;
  } catch (err) {
    if (isQuotaError(err)) {
      await trackAskQuestion({ success: false, reason: "quota_exceeded", latency_ms: Date.now() - startedAt });
      return jsonResponse({ error: QUOTA_MESSAGE }, 429);
    }
    await trackAskQuestion({ success: false, reason: "generation_error", latency_ms: Date.now() - startedAt });
    return jsonResponse({ error: "Couldn't turn that into a query. Try rephrasing the question." }, 502);
  }

  if (generated.refused) {
    await trackAskQuestion({ success: false, refused: true, latency_ms: Date.now() - startedAt });
    return jsonResponse({
      answer: generated.refusal_reason || "That's outside what this data can answer.",
      sql: null,
      explanation: null,
      rows: [],
      chart: generated.chart,
      refused: true,
    });
  }

  // Layer 2 of 4: server-side validation. Never trusts the model's own
  // promise to follow the rules in the system prompt.
  const validation = validateSql(generated.sql);
  if (!validation.ok) {
    await trackAskQuestion({ success: false, reason: "validation_failed", latency_ms: Date.now() - startedAt });
    return jsonResponse({ error: `Rejected by the security validator: ${validation.error}` }, 400);
  }

  // Layer 3 + 4 of 4: executed as insights_readonly — SELECT-only, scoped to
  // schema "demo", 5s statement_timeout enforced at the role level.
  let rows: Record<string, unknown>[];
  try {
    rows = (await db().unsafe(validation.sql!)) as unknown as Record<string, unknown>[];
  } catch (err) {
    await trackAskQuestion({ success: false, reason: "sql_error", latency_ms: Date.now() - startedAt });
    return jsonResponse({ error: `The database rejected the query: ${(err as Error).message}` }, 400);
  }

  // Second Gemini call: a plain-language answer grounded in the actual rows.
  const truncatedRows = rows.slice(0, 50);
  let answer: string;
  try {
    const nl = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        `Business question: "${question}"\n\n` +
        `Query result (JSON, ${truncatedRows.length} of ${rows.length} rows):\n${JSON.stringify(truncatedRows)}\n\n` +
        `Answer in 2-3 sentences for a non-technical business reader. Cite concrete numbers from the result. No SQL, no jargon. ` +
        `If the question asked for a single "top" or "busiest" item and the top rows are tied on the metric being ranked, say so explicitly instead of naming only the first one.`,
    });
    answer = nl.text?.trim() || "Here's what the data shows — see the table below.";
  } catch (err) {
    answer = isQuotaError(err)
      ? "Got the data, but hit today's demo limit before writing it up in words — see the table below."
      : "Got the data, but couldn't summarize it in words this time — see the table below.";
  }

  await trackAskQuestion({ success: true, latency_ms: Date.now() - startedAt, row_count: rows.length });

  return jsonResponse({
    answer,
    sql: validation.sql,
    explanation: generated.explanation,
    rows,
    chart: generated.chart,
    refused: false,
  });
}
