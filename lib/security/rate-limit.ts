// lib/security/rate-limit.ts
// Sliding-Window-Rate-Limit ohne externe Abhängigkeit.
//
// WICHTIG — bekannte Grenze: Der Zähler liegt im Prozessspeicher. Auf Vercel
// bedeutet das "pro Serverless-Instanz", nicht global. Gegen Floods aus einer
// Quelle (der realistische Missbrauchsfall bei KI-Kosten) wirkt das trotzdem;
// gegen breit verteilte Angriffe braucht es einen gemeinsamen Zähler
// (Upstash/Redis oder eine Supabase-Tabelle). Das ist bewusst als nächster
// Schritt offen — siehe docs/security-audit-2026-07-30.md, Fund 4.

export type RateLimitRule = {
  /** Erlaubte Anfragen pro Fenster. */
  limit: number;
  /** Fenstergröße in Millisekunden. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  /** Zeitstempel der Treffer im aktuellen Fenster. */
  hits: number[];
};

const buckets = new Map<string, Bucket>();

/** Ab dieser Größe wird beim nächsten Zugriff aufgeräumt. */
const PRUNE_THRESHOLD = 5000;

function prune(now: number, maxWindowMs: number) {
  for (const [key, bucket] of buckets) {
    const cutoff = now - maxWindowMs;
    bucket.hits = bucket.hits.filter((ts) => ts > cutoff);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

/**
 * Zählt einen Treffer für `key` und sagt, ob er noch im Limit liegt.
 * Ein abgelehnter Versuch wird **nicht** mitgezählt, damit ein Angreifer sich
 * nicht selbst dauerhaft aussperrt und legitime Nutzer nach dem Fenster
 * wieder durchkommen.
 */
export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const cutoff = now - rule.windowMs;

  if (buckets.size > PRUNE_THRESHOLD) prune(now, rule.windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((ts) => ts > cutoff);

  if (bucket.hits.length >= rule.limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + rule.windowMs - now);
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - bucket.hits.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Stabiler Schlüssel pro Aufrufer. Bevorzugt die Client-IP; hinter Vercel ist
 * das erste Element von `x-forwarded-for` die echte Client-IP.
 */
export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

/** Standard-429 mit Retry-After-Header. */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", retryAfter: result.retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Bequemer Wrapper für Route-Handler: prüft und liefert im Zweifel direkt die
 * 429-Antwort zurück.
 *
 *   const limited = enforceRateLimit(req, "ai:plan", AI_RULE);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  rule: RateLimitRule
): Response | null {
  const result = checkRateLimit(`${scope}:${clientKeyFromRequest(req)}`, rule);
  return result.allowed ? null : rateLimitResponse(result);
}

/** Vorkonfigurierte Regeln, damit Limits an einer Stelle stehen. */
export const RATE_RULES = {
  /** Teure LLM-Aufrufe. */
  ai: { limit: 12, windowMs: 60 * 60 * 1000 } as RateLimitRule,
  /** Günstigere KI-Hilfsrouten (Intent-Parsing etc.). */
  aiLight: { limit: 60, windowMs: 60 * 60 * 1000 } as RateLimitRule,
  /** Schreibende Endpunkte (Tracking, Anfragen). */
  write: { limit: 120, windowMs: 60 * 1000 } as RateLimitRule,
  /** Mail-auslösende Endpunkte. */
  mail: { limit: 5, windowMs: 60 * 60 * 1000 } as RateLimitRule,
  /** Suchen und Lookups. */
  search: { limit: 120, windowMs: 60 * 1000 } as RateLimitRule,
  /** Login-Versuche (Preview-Lock). */
  login: { limit: 10, windowMs: 15 * 60 * 1000 } as RateLimitRule,
  /** Generischer Fallback für /api/** in der Middleware. */
  apiDefault: { limit: 300, windowMs: 60 * 1000 } as RateLimitRule,
} as const;
