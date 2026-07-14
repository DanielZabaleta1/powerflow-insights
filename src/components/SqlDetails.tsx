export default function SqlDetails({ sql, explanation }: { sql: string; explanation: string }) {
  return (
    <details className="sql-details">
      <summary>
        <span className="chevron" />
        How this was answered — show the SQL
      </summary>
      <div className="sql-details-body">
        <p className="explanation">{explanation}</p>
        <pre>
          <code>{sql}</code>
        </pre>
      </div>
    </details>
  );
}
