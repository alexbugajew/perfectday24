export default function PlannerLoading() {
  return (
    <div className="pd24-page-wide animate-pulse space-y-4">
      {/* Hero panel */}
      <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="h-5 w-36 rounded-full bg-[var(--bg-panel)]" />
            <div className="h-7 w-64 rounded-full bg-[var(--bg-panel)]" />
            <div className="h-4 w-80 rounded-full bg-[var(--bg-panel)]" />
          </div>
          <div className="h-28 w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--bg-panel)] lg:w-80" />
        </div>
      </div>

      {/* Controls strip */}
      <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 flex-1 rounded-[var(--radius-control)] bg-[var(--bg-panel)]" />
          ))}
        </div>
      </div>

      {/* Map + output grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Map panel */}
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel)] h-[380px]" />

        {/* Output panel */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--bg-panel)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded-full bg-[var(--bg-panel)]" />
                  <div className="h-3 w-1/2 rounded-full bg-[var(--bg-panel)]" />
                </div>
                <div className="h-8 w-16 rounded-full bg-[var(--bg-panel)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
