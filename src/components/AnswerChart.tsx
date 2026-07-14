import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartType } from "../types";
import DataTable, { humanize, formatCell } from "./DataTable";

const INK_100 = "#eceef3";
const INK_500 = "#565c6b";
const PF_BLUE = "#1c5dea";

function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--pure)",
        border: "1px solid var(--ink-100)",
        borderRadius: "var(--r-sm)",
        padding: "8px 12px",
        fontSize: 12.5,
        boxShadow: "0 4px 16px rgba(5,7,13,0.08)",
      }}
    >
      <div style={{ color: "var(--ink-500)", marginBottom: 2 }}>{formatCell(label)}</div>
      <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>
        {payload[0].value.toLocaleString("en-US")}
      </div>
    </div>
  );
}

function NumberFigures({ row }: { row: Record<string, unknown> }) {
  const entries = Object.entries(row);
  return (
    <div className="stats">
      {entries.map(([key, value]) => {
        const num = isNumeric(value) ? Number(value) : null;
        const display =
          num !== null
            ? key.toLowerCase().includes("pct")
              ? `${num}%`
              : num.toLocaleString("en-US")
            : formatCell(value);
        return (
          <div key={key} className="stat">
            <div className="num">{display}</div>
            <div className="label">{humanize(key)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnswerChart({ chart, rows }: { chart: ChartType; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="muted">No rows returned.</p>;
  }

  if (chart === "number" && rows.length === 1) {
    return (
      <div className="chart-card card">
        <NumberFigures row={rows[0]} />
      </div>
    );
  }

  if (chart === "table") {
    return <DataTable rows={rows} />;
  }

  // line or bar: pick the category (first non-numeric column) and the
  // headline metric (last numeric column — matches the ordering convention
  // in the few-shot SQL, e.g. pct_won, leads_created). Every other numeric
  // column stays visible in the table rendered alongside this chart.
  const columns = Object.keys(rows[0]);
  const categoryKey = columns.find((c) => !isNumeric(rows[0][c])) ?? columns[0];
  const numericKeys = columns.filter((c) => c !== categoryKey && isNumeric(rows[0][c]));
  const metricKey = numericKeys[numericKeys.length - 1];

  if (!metricKey) {
    return <DataTable rows={rows} />;
  }

  const data = rows.map((row) => ({
    ...row,
    [categoryKey]: formatCell(row[categoryKey]),
    [metricKey]: Number(row[metricKey]),
  }));

  return (
    <div className="chart-card card">
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={INK_100} />
              <XAxis dataKey={categoryKey} tick={{ fontSize: 12, fill: INK_500 }} axisLine={{ stroke: INK_100 }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: INK_500 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={metricKey} stroke={PF_BLUE} strokeWidth={2} dot={{ r: 4, fill: PF_BLUE, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={INK_100} />
              <XAxis dataKey={categoryKey} tick={{ fontSize: 12, fill: INK_500 }} axisLine={{ stroke: INK_100 }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: INK_500 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--paper)" }} />
              <Bar dataKey={metricKey} fill={PF_BLUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="muted" style={{ marginTop: "var(--sp-3)" }}>
        Charting {humanize(metricKey)} — full breakdown in the table below.
      </p>
    </div>
  );
}
