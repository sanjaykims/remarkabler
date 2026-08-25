import { NextResponse } from "next/server";
import {
  registerClient,
  corsHeaders,
  MAX_DCR_BODY_BYTES,
  parseClientRegistrationMetadata,
} from "@/lib/mcpOauth";
import {
  clientIp,
  isThrottled,
  recordAuthFailure,
  recordMcpAudit,
  REGISTER_THROTTLE_BUCKET,
} from "@/lib/mcp";

// RFC 7591 Dynamic Client Registration. claude.ai POSTs its client metadata
// (redirect_uris etc.) and gets a client_id back. Public clients only — we
// return no client_secret and require PKCE at the token endpoint, so an
// unauthenticated registration grants nothing on its own: the /authorize
// consent step still gates on the MCP_AUTH_TOKEN secret. Registration itself
// is intentionally open (no auth) per RFC 7591, but still per-IP rate
// limited — in its own throttle bucket (see REGISTER_THROTTLE_BUCKET) so
// registration spam can't share a budget with, or be capped by, real
// auth-failure throttling on /authorize and /api/mcp — and registerClient()
// caps mcp_oauth_clients so spam can't grow the table unboundedly either.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBoundedJson(req: Request): Promise<unknown> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DCR_BODY_BYTES) {
    throw new Error("too_large");
  }
  if (!req.body) throw new Error("invalid_json");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DCR_BODY_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new Error("invalid_json");
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (isThrottled(ip, Date.now(), REGISTER_THROTTLE_BUCKET)) {
    recordMcpAudit("throttled", { ip, tool: "oauth_register", ok: false });
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429, headers: { ...corsHeaders(), "retry-after": "600" } }
    );
  }
  recordAuthFailure(ip, Date.now(), REGISTER_THROTTLE_BUCKET);

  let body: unknown;
  try {
    body = await readBoundedJson(req);
  } catch (error) {
    const tooLarge = (error as Error).message === "too_large";
    return NextResponse.json(
      {
        error: "invalid_client_metadata",
        error_description: tooLarge
          ? `Registration metadata exceeds ${MAX_DCR_BODY_BYTES} bytes.`
          : "Body must be valid UTF-8 JSON.",
      },
      { status: tooLarge ? 413 : 400, headers: corsHeaders() }
    );
  }

  const parsed = parseClientRegistrationMetadata(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, error_description: parsed.description },
      { status: 400, headers: corsHeaders() }
    );
  }

  const client = registerClient(parsed.metadata.redirect_uris, parsed.metadata.client_name);

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: client.redirect_uris,
      ...(client.client_name ? { client_name: client.client_name } : {}),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders() }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
