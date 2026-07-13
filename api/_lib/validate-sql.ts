/**
 * Layer 2 of 4 (see docs/security.md): server-side validation of AI-generated
 * SQL. This never trusts the model's own `refused` flag or its promise to
 * follow the system prompt's rules — every query is re-checked here before
 * it ever reaches Postgres. Layer 3 (the insights_readonly role, scoped to
 * schema `demo`, SELECT-only) and layer 4 (5s statement_timeout) are what
 * actually bound the damage if this layer has a gap; this one exists to
 * reject obviously-wrong queries early and give a legible error instead of
 * relying solely on Postgres to reject them.
 */

const ALLOWED_TABLES = ["demo.leads", "demo.activities"];

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|vacuum|do|call|set|pg_)\b/i;

const AGGREGATE_HINT = /\b(count|sum|avg|min|max|group\s+by)\b/i;

export interface ValidationResult {
  ok: boolean;
  sql?: string;
  error?: string;
}

/**
 * Walks the SQL once, tracking single/double-quote string state. Returns
 * both the semicolon-delimited statements (quote-aware, so a semicolon
 * inside a string literal doesn't split it) and a "codeOnly" version with
 * every string literal's contents blanked out to spaces.
 *
 * The blanking matters: this schema's own status values include 'Call
 * booked', and demo data can contain company names or countries with
 * incidental dots — without this, a completely legitimate `where status =
 * 'Call booked'` would trip the forbidden-keyword check on "call", and a
 * value like 'example.com' would trip the table-allowlist check. Keywords
 * and identifiers only matter outside of string literals.
 */
function tokenize(sql: string): { statements: string[]; codeOnly: string } {
  const statements: string[] = [];
  let current = "";
  let codeOnly = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      codeOnly += ch === quote ? ch : " ";
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      codeOnly += ch;
      continue;
    }
    if (ch === ";") {
      statements.push(current);
      current = "";
      codeOnly += ch;
      continue;
    }
    current += ch;
    codeOnly += ch;
  }
  if (current.trim()) statements.push(current);
  return { statements, codeOnly };
}

export function validateSql(rawSql: string): ValidationResult {
  const { statements, codeOnly } = tokenize(rawSql);
  if (statements.length !== 1) {
    return { ok: false, error: "Query must be exactly one SQL statement." };
  }

  let sql = statements[0].trim();
  if (!sql) {
    return { ok: false, error: "Empty query." };
  }

  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, error: "Query must start with SELECT or WITH." };
  }

  if (FORBIDDEN_KEYWORDS.test(codeOnly)) {
    return { ok: false, error: "Query contains a forbidden keyword (only read-only SELECT/WITH is allowed)." };
  }

  // Table allowlist: check only what actually follows FROM/JOIN, not every
  // dotted identifier in the query. A join like
  // `demo.activities r join demo.activities m on m.lead_id = r.lead_id`
  // uses aliases (r, m) and alias.column references (m.lead_id) constantly
  // — those aren't table references and scanning the whole string for any
  // "word.word" pattern rejects completely legitimate multi-table joins.
  // Anchoring to FROM/JOIN is what actually distinguishes "this is a table"
  // from "this is alias.column in a WHERE/ON/SELECT clause".
  const tableRefs = codeOnly.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi);
  for (const match of tableRefs) {
    const ref = match[1];
    if (ref.includes(".") && !ALLOWED_TABLES.includes(ref.toLowerCase())) {
      return { ok: false, error: `Query references a table outside the allowed schema: "${ref}".` };
    }
    // A bare (non-dotted) name after FROM/JOIN is either a CTE defined
    // earlier in this same query, or an invalid/unqualified table — either
    // way Postgres itself (layer 3) will reject anything that doesn't
    // resolve, so this layer doesn't need to re-derive CTE scoping.
  }

  if (!/\blimit\s+\d+/i.test(codeOnly) && !AGGREGATE_HINT.test(codeOnly)) {
    sql = `${sql} LIMIT 100`;
  }

  return { ok: true, sql };
}
