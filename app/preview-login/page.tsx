type PreviewLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

function getNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function PreviewLoginPage({ searchParams }: PreviewLoginPageProps) {
  const params = await searchParams;
  const nextPath = getNextPath(params?.next);
  const hasError = params?.error === "1";

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-2 py-12">
      <div className="w-full rounded-[28px] border border-[var(--line-subtle)] bg-[rgba(248,250,252,0.94)] p-6 shadow-[var(--shadow-large)] backdrop-blur-xl sm:p-8">
        <div className="pd24-kicker">Private Preview</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          PerfectDay24 ansehen
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          Diese Vorschau ist vor dem Launch geschützt. Gib das Preview-Passwort ein, um weiterzugehen.
        </p>

        <form action="/api/preview-login" method="post" className="mt-7 space-y-5">
          <input type="hidden" name="next" value={nextPath} />

          <label className="block">
            <span className="text-sm font-medium text-[var(--text-strong)]">Passwort</span>
            <input
              autoComplete="current-password"
              autoFocus
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 text-base text-[var(--text-strong)] shadow-sm outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[rgba(90,118,136,0.14)]"
              name="password"
              required
              type="password"
            />
          </label>

          {hasError ? (
            <p className="rounded-2xl border border-[rgba(161,75,69,0.22)] bg-[rgba(161,75,69,0.08)] px-4 py-3 text-sm text-[var(--state-error)]">
              Das Passwort stimmt noch nicht.
            </p>
          ) : null}

          <button
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-semibold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(90,118,136,0.22)]"
            type="submit"
          >
            Vorschau öffnen
          </button>
        </form>
      </div>
    </section>
  );
}
