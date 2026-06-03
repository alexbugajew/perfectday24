export default function ExploreLoading() {
  return (
    <div className="pd24-page-wide animate-pulse px-1 py-4 sm:px-2 lg:px-4">
      {/* Header shell */}
      <div className="mb-5 overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)]">
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="h-6 w-48 rounded-full bg-[var(--bg-panel)]" />
              <div className="h-8 w-72 rounded-full bg-[var(--bg-panel)]" />
              <div className="h-4 w-56 rounded-full bg-[var(--bg-panel)]" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-full bg-[var(--bg-panel)]" />
              <div className="h-9 w-28 rounded-full bg-[var(--bg-panel)]" />
            </div>
          </div>
          {/* Filter row */}
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-[var(--bg-panel)]" />
            ))}
          </div>
          {/* Occasion pills */}
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-[var(--bg-panel)]" />
            ))}
          </div>
        </div>
      </div>

      {/* Route grid */}
      <div className="space-y-10">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <div className="mb-4 flex items-end justify-between">
              <div className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-[var(--bg-panel)]" />
                <div className="h-6 w-52 rounded-full bg-[var(--bg-panel)]" />
              </div>
              <div className="h-4 w-16 rounded-full bg-[var(--bg-panel)]" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)]">
                  <div className="aspect-[3/2] bg-[var(--bg-panel)]" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-4/5 rounded-full bg-[var(--bg-panel)]" />
                    <div className="h-3 w-3/5 rounded-full bg-[var(--bg-panel)]" />
                    <div className="flex gap-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="h-6 w-16 rounded-full bg-[var(--bg-panel)]" />
                      ))}
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
