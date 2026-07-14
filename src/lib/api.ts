import type { AskResponse, AskError } from "../types";

export async function askQuestion(question: string): Promise<AskResponse> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const body = (await res.json()) as AskResponse | AskError;
  if (!res.ok) {
    throw new Error("error" in body ? body.error : "Something went wrong.");
  }
  return body as AskResponse;
}
