import Link from "next/link";
import ConsentSettingsLink from "@/components/consent/ConsentSettingsLink";

type LegalPageShellProps = {
  title: string;
  updatedAt: string;
  intro: string;
  children: React.ReactNode;
};

type LegalSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="rounded-3xl border border-[var(--line-subtle)] bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function LegalPageShell({
  title,
  updatedAt,
  intro,
  children,
}: LegalPageShellProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-[var(--text-muted)]">
          <Link
            href="/impressum"
            className="rounded-full border border-[var(--line-subtle)] px-3 py-1 transition hover:border-[var(--brand-accent)] hover:text-[var(--text-strong)]"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="rounded-full border border-[var(--line-subtle)] px-3 py-1 transition hover:border-[var(--brand-accent)] hover:text-[var(--text-strong)]"
          >
            Datenschutz
          </Link>
          <Link
            href="/agb"
            className="rounded-full border border-[var(--line-subtle)] px-3 py-1 transition hover:border-[var(--brand-accent)] hover:text-[var(--text-strong)]"
          >
            AGB
          </Link>
          <ConsentSettingsLink className="rounded-full border border-[var(--line-subtle)] px-3 py-1 transition hover:border-[var(--brand-accent)] hover:text-[var(--text-strong)]" />
        </div>

        <div className="mt-6 inline-flex rounded-full border border-[rgba(202,138,4,0.18)] bg-[rgba(254,249,195,0.7)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#92400e]">
          Platzhalterversion
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
          {intro}
        </p>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Stand: {updatedAt}</p>
      </div>

      {children}
    </div>
  );
}
