# Remarkabler Full Code Review

Date: 2026-08-23
Reviewer: Codex
Repository: `sanjaykims/remarkabler`
Review mode: Read-only application review; no fixes were applied

## Executive summary

This review found 10 validated issues:

| Priority | Count | Meaning |
|---|---:|---|
| P0 | 0 | No confirmed critical or immediately catastrophic issue |
| P1 | 2 | High priority security or abuse risk |
| P2 | 6 | Medium priority security, privacy, reliability, or delivery risk |
| P3 | 2 | Lower priority correctness or hardening issue |

The two most urgent findings are:

1. The unauthenticated PWA share target can create notebooks and start an
   application-unbounded number of expensive OCR jobs.
2. The OAuth dynamic-client-registration and generic consent flow can be used
   for consent phishing that redirects an authorization code to an attacker.

The repository's important established invariants appeared intact, including
the chat Clear boundary, fail-open memory recall, bounded extraction retries,
chunked chat-memory backfill, API authentication guard coverage, MCP
fail-closed behavior, and synthetic-notebook analytics exclusions.

## Scope and method

The review covered the repository's application code, API routes, data layer,
AI call paths, background work, authentication, MCP and OAuth surfaces,
Dropbox and reMarkable integrations, exports, frontend behavior, deployment
configuration, dependencies, and tests.

The committed Graphify snapshot was checked before broad exploration and was
current relative to the reviewed application source. Review work included:

- Reading `AGENTS.md`, `SKILL.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`,
  recent session logs, and relevant vendored review skills.
- Following cross-cutting paths through Graphify and confirming them in source.
- Running lint, all tests, the production build, and dependency audits.
- Reviewing authentication and authorization coverage across API routes.
- Exercising an isolated local instance with a throwaway SQLite database.
- Browser-checking primary pages on a 390 x 844 mobile viewport.
- Reproducing the public share-target behavior, OAuth registration/consent
  behavior, and `/memory` hydration failure locally.

## Findings

### 1. [P1] Public share target can trigger unauthenticated OCR and storage abuse

#### Evidence

- `app/share/route.ts:16-20` deliberately exempts `/share` from the app lock.
- `app/share/route.ts:34-52` collects every multipart entry.
- `app/share/route.ts:79-100` loops over every usable file with no
  application-level file-count, aggregate-size, request-rate, or concurrency
  limit.
- `app/share/route.ts:95` starts a separate `processNotebook` call for every
  accepted file.
- `lib/upload.ts:22-24` accepts a PDF based only on MIME type or `.pdf`
  extension; it does not verify PDF magic bytes.
- `lib/dropbox.ts:71-86` defines the OCR concurrency limit.
- `lib/dropbox.ts:1237-1249` enforces that limit only while Dropbox ingestion
  starts work.
- `app/api/notebooks/route.ts:50-66` also starts all authenticated manual
  uploads without applying the shared OCR gate.
- `README.md:151` describes `OCR_CONCURRENCY_LIMIT` as covering uploads and
  ingestion, which is broader than the implementation.

#### Validation

On an isolated local instance, one unauthenticated multipart request containing
three small fake files labelled as PDFs returned `Added 3`, created three
notebook records, and started three `processNotebook` calls. The calls failed
only because the isolated instance had no Anthropic API key. In production,
the same path reaches paid Opus OCR.

#### Impact

Anyone who can reach the deployment can create persistent notebook/PDF data,
fill the `/data` volume, clutter the owner's notebook history, and initiate
paid OCR work. Multiple files in one request bypass the intended shared OCR
budget.

#### Recommended remediation

- Preserve Android share-target usability with a high-entropy share-ingest
  secret in the manifest URL, or a short-lived/session handoff mechanism.
- Enforce a small maximum file count and aggregate request size.
- Validate `%PDF-` magic bytes before persisting a file.
- Put every OCR entry point behind one central queue or semaphore.
- Apply rate limiting and bounded pending-work limits to the public route.
- Add route tests proving authentication/secret behavior, aggregate limits,
  content validation, and shared concurrency behavior.

### 2. [P1] OAuth dynamic registration enables consent phishing

#### Evidence

- `app/api/mcp/oauth/register/route.ts:36-57` accepts any nonempty strings in
  `redirect_uris`; there is no allowed-host, URI-scheme, URI-count, or metadata
  length policy.
- `app/api/mcp/oauth/authorize/route.ts:45-57` verifies only that the redirect
  URI exactly matches the URI supplied by that same dynamically registered
  client.
- `app/api/mcp/oauth/authorize/route.ts:103-121` always tells the owner they are
  connecting Remarkabler to Claude.
- The consent screen does not display the registered client name or redirect
  destination.
- `app/api/mcp/oauth/authorize/route.ts:147-162` issues an authorization code
  after the owner enters the MCP secret and redirects the code to the
  registered destination.

#### Validation

An isolated local request successfully registered a client named `Attacker
Connector` with `https://attacker.example/callback`. Its authorization URL
rendered the generic Claude consent screen and kept the attacker-controlled
destination only in a hidden form field.

#### Impact

An attacker can register a public client, keep the PKCE verifier, and send the
owner a genuine Remarkabler authorization URL. If the owner trusts the generic
screen and enters `MCP_AUTH_TOKEN`, the attacker receives the authorization
code and can exchange it for MCP access and refresh tokens. Those tokens expose
all enabled MCP reads and any writes enabled by environment flags.

#### Recommended remediation

- Restrict dynamic registration to expected Claude callback hosts, or adopt a
  strict policy for HTTPS and loopback redirect URIs.
- Display the client name and full redirect destination prominently before the
  owner enters any credential.
- Separate credential verification from explicit client authorization.
- Bound request size, redirect URI count/length, and client-name length.
- Add negative tests for arbitrary hosts and a consent-screen test asserting
  that client identity and destination are visible.

### 3. [P2] Precise location is disclosed to an undocumented third party

#### Evidence

- `app/memory/page.tsx:705-727` obtains exact browser coordinates and sends
  them directly to `api.bigdatacloud.net` for reverse geocoding.
- The direct browser call also reveals the user's IP address to that service.
- `app/memory/page.tsx:942-982` describes the feature as sharing location with
  Remarkabler and does not disclose BigDataCloud.
- `README.md:229-232` lists Nominatim as the location-name dependency but does
  not list BigDataCloud.
- `lib/owntracks.ts:378-406` already provides a server-side Nominatim/cache
  pattern for reverse geocoding.

#### Impact

The feature handles sensitive, precise location data for a private diary. The
current implementation sends that data to a third party under UI language that
suggests it goes only to Remarkabler.

#### Recommended remediation

Route reverse geocoding through the existing server-side geocoder and cache,
or store coordinates without reverse geocoding. If BigDataCloud is retained,
disclose it clearly before location permission is requested and update the
deployment/privacy documentation.

### 4. [P2] Production framework is unsupported and dependencies have an audit backlog

#### Evidence

- `package.json:24` pins `next` to `14.2.35`.
- The official Next.js support policy lists Next 14 as unsupported:
  https://nextjs.org/support-policy
- `npm audit --omit=dev` reports eight production dependency findings: three
  moderate and five high.
- Next.js 14 is in the affected range for conditional App Router/RSC cache
  poisoning described here:
  https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7

#### Triage note

The raw audit output must not be interpreted as eight confirmed exploitable
application vulnerabilities. This repository does not use `next/image`,
middleware, or Server Actions, and the production build generated an empty
server-reference manifest. Several high Next.js advisories therefore do not
match the app's current surface. The validated issue is that the production
framework is unsupported, cannot receive normal security maintenance, and has
at least conditional App Router exposure plus unresolved transitive alerts.

#### Recommended remediation

Plan a tested migration to a currently supported and fully patched Next.js
release. Update production dependencies individually, rerun the complete test
and browser suite, and record why any remaining advisory is not applicable.
Avoid applying `npm audit fix --force` without reviewing the major-version
changes.

### 5. [P2] Logout cannot revoke copied sessions and inactivity is global

#### Evidence

- `lib/auth.ts:55-84` creates a stateless token containing only absolute expiry
  and an HMAC.
- `lib/auth.ts:24-33` stores one global `last_activity_at` setting.
- `lib/auth.ts:95-108` uses and refreshes that global value for every valid
  session.
- `app/api/auth/route.ts:155-158` logs out only by deleting the cookie in the
  requesting browser; no server-side state is revoked.

#### Impact

A copied session cookie remains replayable after logout until its seven-day
absolute expiry. The intended 24-hour inactivity boundary is not per device or
session: activity from any valid session keeps the global timestamp fresh.

#### Recommended remediation

Issue a random session ID, persist only its hash with per-session `last_seen`
and revocation state, and revoke it during logout. An alternative smaller
design is a server-side session epoch that invalidates all existing tokens,
though that provides logout-all rather than per-device control.

### 6. [P2] Global passcode lockout permits unauthenticated denial of service

#### Evidence

- `lib/auth.ts:153-189` stores one global failure counter in the settings
  table, with eight failures and a 15-minute window.
- `app/api/auth/route.ts:53-60` blocks both passcode login and passkey
  registration options whenever that single state is locked.
- `test/authLockout.test.ts:30-75` intentionally verifies the global behavior.

#### Impact

An unauthenticated actor can send eight wrong passcodes every 15 minutes and
prevent the owner from using passcode unlock or registering a first passkey.
An already registered passkey still works, but it may not exist during initial
setup or recovery.

#### Recommended remediation

Use source-aware throttling, taking Railway's trusted proxy behavior into
account, plus progressive delay. Retain a modest global anti-brute-force
control if desired, but do not hard-lock every passcode path based solely on
anonymous failures from one source.

### 7. [P2] `/memory` has a reproducible hydration failure

#### Evidence

- `app/memory/page.tsx:160` reads `window.location.origin` directly during
  render.
- On the server this produces an empty string; in the browser it produces the
  full deployment origin.
- `app/memory/page.tsx:1088-1100` renders that value into two OwnTracks URL
  instructions.

#### Validation

On every local `/memory` visit, the server HTML contained a relative
`/api/owntracks` URL while the initial browser render contained an absolute
URL. React logged a text-content mismatch, reported hydration errors, and
replaced the server root with client-rendered content.

#### Impact

The page discards successful server rendering on every visit, causing extra
work and potential visual/state churn on the owner's Android phone. It also
makes unrelated hydration regressions harder to notice.

#### Recommended remediation

Render a stable relative URL until the component mounts and then populate the
origin in `useEffect`, or pass a canonical origin from a server component.
Add a browser test that fails on hydration console errors.

### 8. [P2] Auto-deployment has no automated quality gate

#### Evidence

- `.github/workflows/review-watcher.yml` is the repository's only GitHub
  Actions workflow and does not build or test the application.
- `next.config.mjs:3-7` disables lint enforcement during `next build`.
- `README.md:220-228` states that Railway auto-deploys each push to `main`.
- Repository instructions require lint, tests, and build to be green, but that
  requirement is currently procedural rather than enforced.

#### Impact

A merge or direct push can auto-deploy code that fails lint, tests, or build.
Dependency regressions also have no automated review gate.

#### Recommended remediation

Add a pull-request and `main` workflow running `npm ci`, `npm run lint`,
`npm test`, and `npm run build`. Make it a required branch-protection check and
add a controlled dependency-review/update process.

### 9. [P3] Entity filename sanitization can merge distinct entities

#### Evidence

- `lib/diaryExportDb.ts:99-104` maps several distinct path characters to a
  space.
- `lib/diaryExportDb.ts:145-157` applies that destructive normalization before
  entities are aggregated.
- `lib/diaryExport.ts:451-460` derives the stub filename only from the
  normalized name.
- `lib/diaryExport.ts:542-553` stores generated stubs in a filename-keyed map,
  so duplicate paths overwrite.

#### Impact

Distinct same-kind names such as `A/B` and `A:B` both become `A B`. Their
mentions can aggregate under one display name, their wiki metadata can attach
to the wrong entity, and one generated stub can replace the other.

#### Recommended remediation

Preserve readable filenames but detect normalized-name collisions and append a
stable identifier or short hash. Use Obsidian aliases/frontmatter to retain the
original display text. Add collision tests for every stripped path character.

### 10. [P3] Production container runs as root from a mutable base tag

#### Evidence

- `Dockerfile:16` uses
  `nikolaik/python-nodejs:python3.11-nodejs20` without a digest.
- The runner stage begins at `Dockerfile:46` and never declares a non-root
  `USER` before the command at `Dockerfile:95`.

#### Impact

A runtime compromise receives root privileges inside the container, and a
future base-tag change can alter the production image without a corresponding
repository change. Container isolation limits the blast radius, but the app's
persistent `/data` volume remains highly sensitive.

#### Recommended remediation

Pin the base image by digest, create a dedicated runtime user, assign ownership
of `/app` and the writable data path deliberately, and confirm Railway's
persistent volume permissions under that user.

## Verification results

| Check | Result |
|---|---|
| Graphify snapshot freshness | Current for reviewed application source |
| `npm run lint` | Passed |
| `npm test -- --reporter=dot` | Passed: 634 tests across 65 files |
| `npm run build` | Passed, including TypeScript checking |
| `npm audit --omit=dev` | 8 production findings: 3 moderate, 5 high |
| Mobile browser review | Primary pages checked at 390 x 844 |
| Git worktree after review | Clean before this report was added |

The local environment did not contain real Anthropic, Voyage, Dropbox,
Railway, or reMarkable-cloud credentials. Real OCR, chat, embeddings, external
sync, and deployed-proxy behavior were therefore not exercised end to end.

## Suggested review order

Claude Code should independently validate findings in this order:

1. Public share-target/OCR abuse boundary.
2. OAuth dynamic-registration and consent flow.
3. Location privacy disclosure.
4. Next.js and production dependency upgrade path.
5. Session lifecycle and passcode throttling as one authentication design pass.
6. `/memory` hydration.
7. CI quality gate.
8. Entity collision handling.
9. Container hardening.

Related findings should be designed together, but fixes should remain in small,
reviewable PRs. In particular, the share-target fix must preserve Android PWA
sharing, and authentication changes must not accidentally weaken passkey login
or the app-lock API guard.

## Ready-to-paste Claude Code handoff

Use this prompt from the repository root:

```text
Please read AGENTS.md, SKILL.md, and CLAUDE.md first, then read
docs/reviews/2026-08-23-full-code-review.md.

This is a read-only second-opinion review. Do not change any files yet.
Independently verify every finding against the current source and the committed
Graphify snapshot. For each finding, report:

1. Verdict: confirmed, partially confirmed, or rejected.
2. Evidence: exact files and line numbers, including counterevidence.
3. Severity: whether you agree with P1/P2/P3 and why.
4. Fix design: the smallest safe remediation that preserves the hard-won rules
   in CLAUDE.md.
5. Tests: the exact tests and runtime checks the eventual fix needs.
6. Dependencies: which findings should be fixed together and which should be
   separate PRs.

Pay special attention to the Android PWA share-target constraint, Railway proxy
behavior, MCP fail-closed/write-flag invariants, the app-lock API guard, and the
absence of production API credentials locally. Do not take the report at face
value, and do not implement, commit, push, open a PR, or merge anything until I
approve the proposed fix plan.
```

## Change-control note

This file records review findings only. Its presence does not authorize code
changes or deployment. Each remediation should be revalidated and explicitly
approved before implementation.
