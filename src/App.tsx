import { useEffect, useState } from "react";
import { askQuestion } from "./lib/api";
import { track } from "./lib/track";
import { CACHED_ANSWERS } from "./lib/cachedAnswers";
import type { AskResponse } from "./types";
import AnswerChart from "./components/AnswerChart";
import DataTable from "./components/DataTable";
import SqlDetails from "./components/SqlDetails";

const SUGGESTIONS = [
  "Where do leads drop off?",
  "Which channel converts best?",
  "How many leads did we get last month, by week?",
  "What's the average time from contact to reply?",
];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: AskResponse };

export default function App() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    track("ask_opened");
  }, []);

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed || state.status === "loading") return;
    setQuestion(trimmed);

    // The 4 suggested questions always work, even if the live API is down
    // or the day's free-tier Gemini quota is exhausted — no network call.
    const cached = CACHED_ANSWERS[trimmed];
    if (cached) {
      setState({ status: "done", result: cached });
      return;
    }

    setState({ status: "loading" });
    try {
      const result = await askQuestion(trimmed);
      setState({ status: "done", result });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(question);
  }

  const loading = state.status === "loading";

  return (
    <div className="page">
      <header className="page-head">
        <span className="wordmark">
          <span className="light">POWER&nbsp;</span>
          <span className="heavy">FLOW</span>
          <span className="dot" />
        </span>
        <h1>
          Ask your pipeline<span className="period">.</span>
        </h1>
        <p>Plain-English questions over the Power Flow OS funnel — every answer shows its work.</p>
      </header>

      <form className="ask-form" onSubmit={onSubmit}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which channel converts best?"
          disabled={loading}
          autoFocus
        />
        <button className="btn blue" disabled={loading || !question.trim()}>
          Ask
        </button>
      </form>

      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => run(s)} disabled={loading} type="button">
            {s}
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <div className="state-loading">
          <span className="spinner" />
          Thinking about "{question}"…
        </div>
      )}

      {state.status === "error" && <div className="state-error">{state.message}</div>}

      {state.status === "done" && state.result.refused && (
        <div className="state-refused">{state.result.answer}</div>
      )}

      {state.status === "done" && !state.result.refused && (
        <div className="answer">
          <p className="answer-text">{state.result.answer}</p>

          <AnswerChart chart={state.result.chart} rows={state.result.rows} />

          {state.result.chart !== "table" && state.result.chart !== "number" && (
            <DataTable rows={state.result.rows} />
          )}

          {state.result.sql && (
            <SqlDetails sql={state.result.sql} explanation={state.result.explanation ?? ""} />
          )}
        </div>
      )}

      <p className="footer-note">
        Runs against a synthetic dataset mirroring the production schema — real prospect data stays private.
      </p>
    </div>
  );
}
