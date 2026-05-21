"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/planner",
    label: "Planen",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Entdecken",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    href: "/saved",
    label: "Meine Pläne",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
] as const;

/** Seiten ohne Bottom-Nav (Homepage & Run-Erlebnisse) */
const HIDDEN_ON = new Set(["/", "/homepage-concept", "/run"]);

export default function MobileBottomNav() {
  const pathname = usePathname();

  const hideNav =
    HIDDEN_ON.has(pathname) ||
    (pathname.startsWith("/routes/") && pathname.endsWith("/run"));

  if (hideNav) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-[1300] sm:hidden"
    >
      {/* Safe area fill for iOS home indicator */}
      <div className="border-t border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.96)] backdrop-blur-xl pb-safe">
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                  active ? "text-[#171717]" : "text-[#8b7767]"
                }`}
              >
                {/* Active indicator line */}
                <span
                  className={`mb-0.5 h-0.5 w-5 rounded-full transition-all ${
                    active ? "bg-[#171717]" : "bg-transparent"
                  }`}
                />
                {item.icon}
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
