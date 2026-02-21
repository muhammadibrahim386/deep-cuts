export default function Home() {
  return (
    <div className="space-y-8">
      {/* Search bar */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <input
            type="text"
            placeholder="Search episodes, topics, quotes..."
            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition"
          />
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
          Semantic search powered by pgvector
        </p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        <div className="bg-[var(--bg-card)] rounded-lg p-4 text-center border border-[var(--border)]">
          <div className="text-2xl font-bold">—</div>
          <div className="text-xs text-[var(--text-secondary)]">Episodes</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-4 text-center border border-[var(--border)]">
          <div className="text-2xl font-bold">—</div>
          <div className="text-xs text-[var(--text-secondary)]">Keywords</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-4 text-center border border-[var(--border)]">
          <div className="text-2xl font-bold">—</div>
          <div className="text-xs text-[var(--text-secondary)]">Threads</div>
        </div>
      </div>

      {/* Recent episodes placeholder */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Episodes</h2>
        <div className="bg-[var(--bg-card)] rounded-lg p-8 border border-[var(--border)] text-center text-[var(--text-secondary)]">
          No episodes yet. Add a show with the CLI to get started.
          <pre className="mt-4 text-xs bg-[var(--bg-primary)] p-3 rounded inline-block">
            npm run ingest -- --add-show &quot;https://youtube.com/@channel&quot; --name &quot;Show Name&quot;
          </pre>
        </div>
      </section>
    </div>
  );
}
