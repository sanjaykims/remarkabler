/**
 * Best-effort client identity for per-source rate limiting.
 *
 * `X-Real-IP` is preferred because Railway's edge OVERWRITES it with the
 * connecting address — a single value with no list to parse and no
 * client-supplied prefix to strip. `X-Forwarded-For` is the fallback, and its
 * first element is used because that is what Railway documents as the client.
 *
 * IMPORTANT — this is a soft signal, not a trust boundary. The
 * `X-Forwarded-For` convention is APPEND: a proxy adds the peer address to the
 * end of whatever the client sent, so the leftmost element is only
 * trustworthy while an edge that sanitizes the header sits in front of us.
 * That holds on Railway today; it would NOT hold behind an added CDN, on a
 * different host, or if the app were ever reached directly.
 *
 * Callers must therefore treat the result as a fairness/partitioning hint that
 * keeps one noisy source from affecting another — never as the only thing
 * bounding an attacker. `lib/auth.ts` pairs every per-source bucket with a
 * global floor for exactly this reason: if this derivation is ever wrong, the
 * limiter degrades to "slow", not to "unlimited".
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (first || "unknown").slice(0, 128);
}
