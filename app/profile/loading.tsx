export default function ProfileLoading() {
  return (
    <div className="pd24-page-standard animate-pulse min-h-screen bg-[var(--bg-canvas-warm)]">
      <div className="space-y-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full bg-[var(--bg-panel)]" />
          <div className="h-8 w-40 rounded-full bg-[var(--bg-panel)]" />
          <div className="h-4 w-80 rounded-full bg-[var(--bg-panel)]" />
        </div>

        {/* Auth card */}
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[var(--bg-panel)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded-full bg-[var(--bg-panel)]" />
              <div className="h-3 w-56 rounded-full bg-[var(--bg-panel)]" />
            </div>
            <div className="h-9 w-24 rounded-xl bg-[var(--bg-panel)]" />
          </div>
        </div>

        {/* Two-column cards */}
        <div className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
              <div className="space-y-3">
                <div className="h-3 w-24 rounded-full bg-[var(--bg-panel)]" />
                <div className="h-6 w-48 rounded-full bg-[var(--bg-panel)]" />
                <div className="h-4 w-64 rounded-full bg-[var(--bg-panel)]" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={j} className="h-8 w-20 rounded-full bg-[var(--bg-panel)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
