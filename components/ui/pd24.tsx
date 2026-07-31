import Link from "next/link";

type WithClassName = {
  className?: string;
};

type SectionIntroProps = WithClassName & {
  eyebrow: string;
  title: string;
  body?: string;
};

type ButtonBaseProps = WithClassName & {
  children: React.ReactNode;
};

type ButtonAsButtonProps = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: never;
  };

type ButtonAsLinkProps = ButtonBaseProps & {
  href: string;
};

type PD24ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

type SurfaceTone = "default" | "muted" | "dark";
type SurfacePadding = "md" | "lg";

type CardProps = WithClassName & {
  children: React.ReactNode;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
};

type SelectionControlProps = WithClassName & {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type StatusTone = "info" | "success" | "warning" | "error" | "neutral" | "warm";

type StatusBadgeProps = WithClassName & {
  children: React.ReactNode;
  tone?: StatusTone;
};

type SiteHeaderLink = {
  href: string;
  label: string;
  active?: boolean;
};

type SiteHeaderProps = WithClassName & {
  title?: string;
  subtitle?: string;
  navItems: SiteHeaderLink[];
  ctaHref: string;
  ctaLabel: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-soft)] focus-visible:ring-offset-2";

const buttonVariants = {
  primary: "bg-[var(--text-strong)] text-white hover:opacity-95",
  secondary:
    "border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-strong)] hover:border-[var(--line-strong)] hover:bg-white",
  tertiary:
    "text-[var(--text-strong)] hover:bg-[rgba(255,255,255,0.7)]",
} as const;

export function PD24Button({
  href,
  children,
  className,
  ...props
}: PD24ButtonProps & { variant?: keyof typeof buttonVariants }) {
  const variant = "variant" in props && props.variant ? props.variant : "primary";
  const classes = cx(buttonBase, buttonVariants[variant], className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  // variant ist bereits in `classes` verarbeitet und darf nicht als
  // DOM-Attribut auf dem <button> landen.
  const buttonProps = { ...props } as ButtonAsButtonProps & {
    variant?: keyof typeof buttonVariants;
  };
  delete buttonProps.variant;

  return (
    <button {...buttonProps} className={classes}>
      {children}
    </button>
  );
}

export function PD24SectionIntro({
  eyebrow,
  title,
  body,
  className,
}: SectionIntroProps) {
  return (
    <div className={cx("max-w-2xl", className)}>
      <div className="pd24-kicker">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-base leading-7 text-[var(--text-muted)] sm:text-lg">{body}</p>
      ) : null}
    </div>
  );
}

export function PD24Card({
  children,
  tone = "default",
  padding = "md",
  className,
}: CardProps) {
  const toneClass =
    tone === "muted"
      ? "pd24-card-muted"
      : tone === "dark"
        ? "rounded-[var(--radius-card)] border border-[rgba(255,255,255,0.08)] bg-[var(--text-strong)] text-white shadow-[var(--shadow-large)]"
        : "pd24-card";

  const paddingClass = padding === "lg" ? "p-7 sm:p-8" : "p-5 sm:p-6";

  return <div className={cx(toneClass, paddingClass, className)}>{children}</div>;
}

export function PD24SelectionControl({
  label,
  value,
  hint,
  icon,
  className,
  ...props
}: SelectionControlProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "pd24-control flex w-full items-center justify-between gap-4 px-5 text-left disabled:pointer-events-none",
        className
      )}
    >
      <div className="min-w-0">
        <div className="pd24-meta">{label}</div>
        <div className="mt-2 truncate text-lg font-medium text-[var(--text-strong)]">{value}</div>
        {hint ? <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <div className="shrink-0 text-lg text-[var(--text-muted)]">{icon ?? "+"}</div>
    </button>
  );
}

export function PD24StatusBadge({
  children,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  const toneClass =
    tone === "info"
      ? "pd24-status-info"
      : tone === "success"
        ? "pd24-status-success"
        : tone === "warning"
          ? "pd24-status-warning"
          : tone === "error"
            ? "pd24-status-error"
            : tone === "warm"
              ? "border border-[rgba(196,137,79,0.28)] bg-[rgba(196,137,79,0.09)] text-[var(--brand-warm-ink)]"
              : "border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}

export function PD24SiteHeader({
  title = "Perfectday24",
  subtitle = "Refined City Planning",
  navItems,
  ctaHref,
  ctaLabel,
  className,
}: SiteHeaderProps) {
  return (
    <header
      className={cx(
        "sticky top-4 z-40 w-full max-w-full rounded-[28px] border border-[var(--line-subtle)] bg-[rgba(248,250,252,0.84)] px-4 py-4 backdrop-blur-xl sm:px-5",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:gap-4">
        <Link href="/" className="min-w-0 flex-1 sm:flex-none">
          <div className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">{title}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {subtitle}
          </div>
        </Link>

        <nav
          aria-label="Marketing-Navigation"
          className="hidden items-center gap-1 rounded-full border border-[var(--line-subtle)] bg-white p-1.5 md:flex"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-full px-4 py-2 text-sm transition",
                item.active
                  ? "bg-[var(--text-strong)] font-medium text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <PD24Button href={ctaHref}>{ctaLabel}</PD24Button>
          </div>
          <div className="sm:hidden">
            <PD24Button href={ctaHref} className="px-4">
              {ctaLabel}
            </PD24Button>
          </div>
        </div>
      </div>
    </header>
  );
}
