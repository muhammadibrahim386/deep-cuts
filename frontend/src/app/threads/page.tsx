export default function ThreadsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Thought Threads</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Recurring themes and ideas that connect across episodes.
        </p>
      </div>

      {/* D3 force-directed graph will go here */}
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] h-[500px] flex items-center justify-center text-[var(--text-secondary)]">
        Thread graph visualization (D3 force-directed) — requires analyzed episodes
      </div>

      {/* Thread list placeholder */}
      <section>
        <h3 className="text-md font-semibold mb-3">All Threads</h3>
        <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)] text-center text-[var(--text-secondary)]">
          No threads yet. Run the connect pass after analyzing episodes.
          <pre className="mt-4 text-xs bg-[var(--bg-primary)] p-3 rounded inline-block">
            npm run process -- --connect
          </pre>
        </div>
      </section>
    </div>
  )
}
