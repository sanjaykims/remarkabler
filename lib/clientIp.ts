/** Railway's edge controls X-Forwarded-For; its first value is the client. */
export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (first || "unknown").slice(0, 128);
}
