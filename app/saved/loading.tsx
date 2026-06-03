export default function SavedLoading() {
  return (
    <div className="pd24-page-wide animate-pulse space-y-8">
      {/* Header shell */}
      <div className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-[var(--bg-panel)]" />
            <div className="h-8 w-72 rounded-full bg-[var(--bg-panel)]" />
            <div className="h-4 w-80 rounded-full bg-[var(--bg-panel)]" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-36 rounded-2xl bg-[var(--bg-panel)]" />
            <div className="h-11 w-28 rounded-2xl bg-[var(--bg-panel)]" />
          </div>
        </div>
      </div>

      {/* Quick access row */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[136px] min-w-[220px] rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)]" />
        ))}
      </div>

      {/* Segment pills */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-full bg-[var(--bg-panel)]" />
        ))}
      </div>

      {/* Cards grid */}
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <div className="mb-4 h-6 w-48 rounded-full bg-[var(--bg-panel)]" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="space-y-3">
                    <div className="h-3 w-24 rounded-full bg-[var(--bg-panel)]" />
                    <div className="h-5 w-3/4 rounded-full bg-[var(--bg-panel)]" />
                    <div className="h-3 w-1/2 rounded-full bg-[var(--bg-panel)]" />
                    <div className="h-16 rounded-[var(--radius-control)] bg-[var(--bg-panel)]" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-10 w-28 rounded-full bg-[var(--bg-panel)]" />
                      <div className="h-10 w-24 rounded-full bg-[var(--bg-panel)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
