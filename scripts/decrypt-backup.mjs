#!/usr/bin/env node
// Decrypt a Remarkabler off-site backup WITHOUT the app (no dependencies).
//
//   BACKUP_PASSPHRASE='your passphrase' node scripts/decrypt-backup.mjs \
//     backups/2026-11-12-080000.tar.gz.enc restored.tar.gz
//   tar xzf restored.tar.gz      # -> app.db, files/, chat-attachments/
//
// Format must match lib/backupCrypto.ts (pinned by test/backupCrypto.test.ts).
import crypto from "node:crypto";
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
const pass = process.env.BACKUP_PASSPHRASE;
if (!inPath || !outPath || !pass) {
  console.error(
    "Usage: BACKUP_PASSPHRASE=... node scripts/decrypt-backup.mjs <in.tar.gz.enc> <out.tar.gz>"
  );
  process.exit(2);
}

const MAGIC = Buffer.from("RMKB1");
const enc = fs.readFileSync(inPath);
if (enc.length < MAGIC.length + 16 + 12 + 16 || !enc.subarray(0, MAGIC.length).equals(MAGIC)) {
  console.error("Not an encrypted Remarkabler backup (bad header).");
  process.exit(1);
}
let o = MAGIC.length;
const salt = enc.subarray(o, (o += 16));
const iv = enc.subarray(o, (o += 12));
const tag = enc.subarray(enc.length - 16);
const body = enc.subarray(o, enc.length - 16);
try {
  const key = crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  fs.writeFileSync(outPath, Buffer.concat([d.update(body), d.final()]));
  console.log(`Decrypted -> ${outPath}`);
} catch {
  console.error("Wrong passphrase, or the backup file is damaged.");
  process.exit(1);
}
