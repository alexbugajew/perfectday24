export default function CityExploreLoading() {
  return (
    <div className="pd24-page-standard space-y-6 pb-20 pt-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        <div className="h-4 w-2 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--bg-panel)]" />
      </div>

      {/* Hero skeleton */}
      <div className="overflow-hidden rounded-[32px] border border-[var(--line-subtle)]">
        <div className="h-52 w-full animate-pulse bg-[var(--bg-panel)] sm:h-72" />
        <div className="space-y-2 bg-[var(--bg-surface)] p-6">
          <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--bg-panel)]" />
          <div className="h-8 w-48 animate-pulse rounded-full bg-[var(--bg-panel)]" />
          <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        </div>
      </div>

      {/* Occasion chips skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        ))}
      </div>

      {/* Routes grid skeleton */}
      <div>
        <div className="mb-4 h-7 w-48 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)]">
              <div className="aspect-[3/2] w-full animate-pulse bg-[var(--bg-panel)]" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--bg-panel)]" />
                <div className="h-5 w-3/4 animate-pulse rounded-full bg-[var(--bg-panel)]" />
                <div className="h-3 w-full animate-pulse rounded-full bg-[var(--bg-panel)]" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--bg-panel)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
