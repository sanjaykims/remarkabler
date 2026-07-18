import { NextResponse } from "next/server";
import {
  getClient,
  consentSecretValid,
  issueAuthCode,
} from "@/lib/mcpOauth";
import {
  clientIp,
  isThrottled,
  recordAuthFailure,
  recordMcpAudit,
} from "@/lib/mcp";

// OAuth authorization endpoint. This is the security anchor of the whole
// flow: it renders a consent screen that asks for the MCP_AUTH_TOKEN, and only
// issues an auth code when the token is correct. So even though registration
// is open (public clients), no one can obtain a usable token without knowing
// the single secret. Failed attempts are throttled + audited like the MCP
// endpoint itself.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OAuthParams = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Validates the request against the registered client. Returns an error string
// (safe to show) or null when the params are usable.
function validate(p: OAuthParams): string | null {
  if (p.response_type !== "code") return "Unsupported response_type (expected 'code').";
  if (!p.client_id) return "Missing client_id.";
  if (!p.redirect_uri) return "Missing redirect_uri.";
  if (!p.code_challenge) return "Missing PKCE code_challenge.";
  if (p.code_challenge_method !== "S256")
    return "Unsupported code_challenge_method (expected 'S256').";
  const client = getClient(p.client_id);
  if (!client) return "Unknown client_id.";
  // Exact redirect_uri match — prevents code interception via open redirect.
  if (!client.redirect_uris.includes(p.redirect_uri))
    return "redirect_uri is not registered for this client.";
  return null;
}

function readParams(sp: URLSearchParams): OAuthParams {
  return {
    response_type: sp.get("response_type") || "",
    client_id: sp.get("client_id") || "",
    redirect_uri: sp.get("redirect_uri") || "",
    code_challenge: sp.get("code_challenge") || "",
    code_challenge_method: sp.get("code_challenge_method") || "",
    state: sp.get("state") || "",
    scope: sp.get("scope") || "",
  };
}

function page(body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Remarkabler 연결</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:#f4f1ea;color:#2b2723;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
@media(prefers-color-scheme:dark){body{background:#1c1a17;color:#e8e3da}
  .card{background:#26231f !important;border-color:#3a352e !important}
  input{background:#1c1a17 !important;color:#e8e3da !important;border-color:#3a352e !important}}
.card{background:#fff;border:1px solid #e5ddd943;border-radius:16px;max-width:400px;width:100%;
  padding:28px;box-shadow:0 1px 3px #0000000f}
h1{font-size:19px;margin:0 0 6px}
p{font-size:14px;line-height:1.5;color:#7c756b;margin:0 0 18px}
label{display:block;font-size:13px;font-weight:500;margin:0 0 6px}
input[type=password]{width:100%;padding:12px;font-size:16px;border:1px solid #e0d8cf;border-radius:10px;margin-bottom:16px}
button{width:100%;padding:13px;font-size:15px;font-weight:500;border:0;border-radius:10px;
  background:#c2703d;color:#fff;cursor:pointer}
button:active{background:#a95f31}
.err{background:#f8e6e0;color:#a5432a;padding:10px 12px;border-radius:9px;font-size:13px;margin-bottom:16px}
@media(prefers-color-scheme:dark){.err{background:#3a241e;color:#e8a58f}}
.lock{font-size:32px;margin-bottom:10px}
</style></head><body><div class="card">${body}</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function consentForm(p: OAuthParams, error?: string): NextResponse {
  const hidden = (
    ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"] as const
  )
    .map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`)
    .join("");
  return page(
    `<div class="lock">🔒</div>
    <h1>Remarkabler를 Claude에 연결</h1>
    <p>Claude가 당신의 일기를 읽을 수 있도록 연결합니다. 확인을 위해 <b>MCP 토큰</b>을 입력하세요 (Railway에 설정한 값).</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <form method="POST">
      ${hidden}
      <label for="t">MCP 토큰</label>
      <input id="t" name="mcp_token" type="password" autocomplete="off" autofocus placeholder="토큰 붙여넣기">
      <button type="submit">연결 승인</button>
    </form>`,
    error ? 401 : 200
  );
}

export function GET(req: Request) {
  const p = readParams(new URL(req.url).searchParams);
  const err = validate(p);
  if (err) return page(`<h1>연결할 수 없음</h1><p>${esc(err)}</p>`, 400);
  return consentForm(p);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const sp = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") sp.set(k, v);
  const p = readParams(sp);
  const token = sp.get("mcp_token") || "";

  const err = validate(p);
  if (err) return page(`<h1>연결할 수 없음</h1><p>${esc(err)}</p>`, 400);

  const ip = clientIp(req.headers);
  if (isThrottled(ip)) {
    recordMcpAudit("throttled", { ip, ok: false });
    return consentForm(p, "시도가 너무 많습니다. 잠시 후 다시 시도하세요.");
  }

  if (!consentSecretValid(token)) {
    recordAuthFailure(ip);
    recordMcpAudit("auth_fail", { ip, tool: "oauth_authorize", ok: false });
    return consentForm(p, "토큰이 올바르지 않습니다. Railway의 MCP_AUTH_TOKEN 값과 정확히 같아야 합니다.");
  }

  // Correct token → issue a single-use auth code bound to this client +
  // redirect + PKCE challenge, and redirect back to Claude.
  const code = issueAuthCode(p.client_id, p.redirect_uri, p.code_challenge);
  recordMcpAudit("initialize", { ip, tool: "oauth_authorize" });
  const to = new URL(p.redirect_uri);
  to.searchParams.set("code", code);
  if (p.state) to.searchParams.set("state", p.state);
  return NextResponse.redirect(to.toString(), 302);
}
