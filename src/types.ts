export type ChartType = "line" | "bar" | "table" | "number";

export interface AskResponse {
  answer: string;
  sql: string | null;
  explanation: string | null;
  rows: Record<string, unknown>[];
  chart: ChartType;
  refused: boolean;
}

export interface AskError {
  error: string;
}
