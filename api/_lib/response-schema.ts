import { Type, type Schema } from "@google/genai";

/** Structured-output schema for the Gemini NL→SQL step. */
export const SQL_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sql: { type: Type.STRING, description: "A single Postgres SELECT or WITH query. Empty string if refused." },
    explanation: { type: Type.STRING, description: "What the query does, in plain business language." },
    chart: { type: Type.STRING, enum: ["line", "bar", "table", "number"] },
    refused: { type: Type.BOOLEAN },
    refusal_reason: { type: Type.STRING, description: "Required when refused is true, omitted otherwise." },
  },
  required: ["sql", "explanation", "chart", "refused"],
};

export interface SqlGenerationResult {
  sql: string;
  explanation: string;
  chart: "line" | "bar" | "table" | "number";
  refused: boolean;
  refusal_reason?: string;
}
