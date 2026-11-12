import crypto from "crypto";

// Off-site backup encryption. The GitHub backup repo is a SECOND copy of the
// whole diary, so a stolen GitHub account/token must not be enough to read it.
//
// Format (all binary, nothing secret in the header):
//   "RMKB1" (5 bytes magic/version) | salt (16) | iv (12) | ciphertext | tag (16)
// Key = scrypt(passphrase, salt, N=2^15, r=8, p=1) -> 32 bytes, AES-256-GCM.
// GCM authenticates the whole payload, so a wrong passphrase OR any tampering
// fails closed with a clear error rather than yielding garbage.
//
// scripts/decrypt-backup.mjs is a dependency-free copy of the DEcrypt half so
// a backup can be restored without this app. test/backupCrypto.test.ts pins
// that the script and this module agree on the format — change both together.

export const BACKUP_MAGIC = Buffer.from("RMKB1");
export const ENCRYPTED_SUFFIX = ".tar.gz.enc";
export const MIN_PASSPHRASE_LENGTH = 12;

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

/** The configured passphrase, or null when unset/too short (fail closed). */
export function backupPassphrase(): string | null {
  const p = process.env.BACKUP_PASSPHRASE;
  if (!p || p.length < MIN_PASSPHRASE_LENGTH) return null;
  return p;
}

export function isEncryptedBackup(buf: Buffer): boolean {
  return (
    buf.length >= BACKUP_MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN &&
    buf.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)
  );
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32, SCRYPT);
}

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Backup passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`
    );
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([BACKUP_MAGIC, salt, iv, body, cipher.getAuthTag()]);
}

export function decryptBackup(enc: Buffer, passphrase: string): Buffer {
  if (!isEncryptedBackup(enc)) {
    throw new Error("Not an encrypted Remarkabler backup (bad header).");
  }
  let o = BACKUP_MAGIC.length;
  const salt = enc.subarray(o, (o += SALT_LEN));
  const iv = enc.subarray(o, (o += IV_LEN));
  const tag = enc.subarray(enc.length - TAG_LEN);
  const body = enc.subarray(o, enc.length - TAG_LEN);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.");
  }
}
