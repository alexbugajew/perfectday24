export const PREVIEW_LOCK_COOKIE = "pd24_preview_access";
export const PREVIEW_LOCK_LOGIN_PATH = "/preview-login";
export const PREVIEW_LOCK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const TOKEN_VERSION = "v1";

/**
 * HMAC-Secret für das Access-Cookie.
 *
 * Der Fallback auf das Preview-Passwort bleibt bestehen, damit bestehende
 * Deployments nicht kaputtgehen — er ist aber schwächer, weil Passwort und
 * Signaturschlüssel dann identisch sind. Deshalb wird er einmalig geloggt,
 * damit die fehlende Variable auffällt.
 */
let warnedAboutSecretFallback = false;

function getSecret() {
  const dedicated = process.env.SITE_PREVIEW_COOKIE_SECRET;
  if (dedicated) return dedicated;

  const fallback = process.env.SITE_PREVIEW_PASSWORD || "";
  if (fallback && !warnedAboutSecretFallback) {
    warnedAboutSecretFallback = true;
    console.warn(
      "[preview-lock] SITE_PREVIEW_COOKIE_SECRET fehlt — es wird das Preview-Passwort " +
        "als HMAC-Secret verwendet. Bitte ein separates Secret setzen."
    );
  }
  return fallback;
}

export function isPreviewLockEnabled() {
  const enabled = process.env.SITE_LOCK_ENABLED === "true" || process.env.SITE_LOCK_ENABLED === "1";
  return enabled && Boolean(process.env.SITE_PREVIEW_PASSWORD);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string) {
  const secret = getSecret();
  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return bytesToHex(new Uint8Array(signature));
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

export async function createPreviewAccessToken(now = Date.now()) {
  const expiresAt = now + PREVIEW_LOCK_COOKIE_MAX_AGE_SECONDS * 1000;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  const signature = await sign(payload);

  return `${payload}.${signature}`;
}

export async function verifyPreviewAccessToken(token?: string | null, now = Date.now()) {
  if (!token) {
    return false;
  }

  const [version, expiresAtValue, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !expiresAtValue || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const expected = await sign(`${version}.${expiresAtValue}`);
  return timingSafeEqual(signature, expected);
}

export function isPreviewPassword(input: FormDataEntryValue | null) {
  const expected = process.env.SITE_PREVIEW_PASSWORD;
  if (!expected) return false;
  if (typeof input !== "string") return false;
  // Konstantzeitiger Vergleich statt ===, damit die Antwortzeit nichts über
  // das Passwort verrät.
  return timingSafeEqual(input, expected);
}
