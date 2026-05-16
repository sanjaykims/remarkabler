import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";

const RP_NAME = "Remarkabler";

type StoredCredential = {
  id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
};

function listCredentials(): StoredCredential[] {
  return db()
    .prepare(
      `SELECT id, credential_id, public_key, counter, transports FROM credentials`
    )
    .all() as StoredCredential[];
}

export function hasCredentials(): boolean {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM credentials`)
    .get() as { c: number };
  return row.c > 0;
}

function parseTransports(raw: string | null) {
  return raw ? JSON.parse(raw) : undefined;
}

/** Build the options the browser needs to create a new passkey. */
export async function buildRegistrationOptions(rpID: string) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: "owner",
    userID: new TextEncoder().encode("feed-claude-owner"),
    attestationType: "none",
    excludeCredentials: listCredentials().map((c) => ({
      id: c.credential_id,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });
}

/** Verify a new passkey and store it. Returns true on success. */
export async function verifyRegistration(opts: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}): Promise<boolean> {
  const verification = await verifyRegistrationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: opts.expectedOrigin,
    expectedRPID: opts.expectedRPID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) return false;

  const { credential } = verification.registrationInfo;
  db()
    .prepare(
      `INSERT INTO credentials(credential_id, public_key, counter, transports)
       VALUES(?,?,?,?)
       ON CONFLICT(credential_id) DO UPDATE SET
         public_key=excluded.public_key,
         counter=excluded.counter,
         transports=excluded.transports`
    )
    .run(
      credential.id,
      Buffer.from(credential.publicKey).toString("base64url"),
      credential.counter,
      opts.response.response.transports
        ? JSON.stringify(opts.response.response.transports)
        : null
    );
  return true;
}

/** Build the options the browser needs to sign in with an existing passkey. */
export async function buildAuthenticationOptions(rpID: string) {
  return generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: listCredentials().map((c) => ({
      id: c.credential_id,
      transports: parseTransports(c.transports),
    })),
  });
}

/** Verify a passkey assertion. Returns true on success. */
export async function verifyAuthentication(opts: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}): Promise<boolean> {
  const cred = db()
    .prepare(
      `SELECT id, credential_id, public_key, counter, transports
       FROM credentials WHERE credential_id = ?`
    )
    .get(opts.response.id) as StoredCredential | undefined;
  if (!cred) return false;

  const verification = await verifyAuthenticationResponse({
    response: opts.response,
    expectedChallenge: opts.expectedChallenge,
    expectedOrigin: opts.expectedOrigin,
    expectedRPID: opts.expectedRPID,
    requireUserVerification: true,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
      counter: cred.counter,
      transports: parseTransports(cred.transports),
    },
  });
  if (!verification.verified) return false;

  db()
    .prepare(`UPDATE credentials SET counter = ? WHERE credential_id = ?`)
    .run(verification.authenticationInfo.newCounter, cred.credential_id);
  return true;
}
