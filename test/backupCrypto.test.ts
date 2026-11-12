import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  backupPassphrase,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from "@/lib/backupCrypto";

const PASS = "correct horse battery staple";

describe("backup encryption", () => {
  it("round-trips and never contains the plaintext", () => {
    const plain = Buffer.from("SECRET DIARY ENTRY about family 가족");
    const enc = encryptBackup(plain, PASS);
    expect(isEncryptedBackup(enc)).toBe(true);
    expect(enc.includes(Buffer.from("SECRET DIARY"))).toBe(false);
    expect(decryptBackup(enc, PASS).equals(plain)).toBe(true);
  });

  it("uses a fresh salt/iv each time", () => {
    const a = encryptBackup(Buffer.from("x"), PASS);
    const b = encryptBackup(Buffer.from("x"), PASS);
    expect(a.equals(b)).toBe(false);
  });

  it("fails closed on a wrong passphrase, tampering, or non-backups", () => {
    const enc = encryptBackup(Buffer.from("hello"), PASS);
    expect(() => decryptBackup(enc, "another long passphrase")).toThrow(/Wrong passphrase/);
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 20] ^= 0xff;
    expect(() => decryptBackup(tampered, PASS)).toThrow(/Wrong passphrase|damaged/);
    expect(() => decryptBackup(Buffer.from("plain tar.gz bytes ....................."), PASS)).toThrow(/bad header/);
    expect(isEncryptedBackup(Buffer.from("short"))).toBe(false);
  });

  it("rejects short passphrases", () => {
    expect(() => encryptBackup(Buffer.from("x"), "short")).toThrow(/at least 12/);
  });

  it("backupPassphrase is null when unset or too short", () => {
    const old = process.env.BACKUP_PASSPHRASE;
    try {
      delete process.env.BACKUP_PASSPHRASE;
      expect(backupPassphrase()).toBeNull();
      process.env.BACKUP_PASSPHRASE = "short";
      expect(backupPassphrase()).toBeNull();
      process.env.BACKUP_PASSPHRASE = PASS;
      expect(backupPassphrase()).toBe(PASS);
    } finally {
      if (old === undefined) delete process.env.BACKUP_PASSPHRASE;
      else process.env.BACKUP_PASSPHRASE = old;
    }
  });

  it("scripts/decrypt-backup.mjs agrees with the library format", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bk-"));
    const plain = Buffer.from("tarball bytes \u0000\u0001\u0002 end");
    writeFileSync(path.join(dir, "a.tar.gz.enc"), encryptBackup(plain, PASS));
    const run = (pass: string) =>
      spawnSync(
        "node",
        ["scripts/decrypt-backup.mjs", path.join(dir, "a.tar.gz.enc"), path.join(dir, "out.tar.gz")],
        { env: { ...process.env, BACKUP_PASSPHRASE: pass }, encoding: "utf8" }
      );
    expect(run("wrong wrong wrong wrong").status).toBe(1);
    expect(run(PASS).status).toBe(0);
    expect(readFileSync(path.join(dir, "out.tar.gz")).equals(plain)).toBe(true);
  });
});

describe("runBackup / encryptExistingBackups", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "bk-data-"));
    process.env.BACKUP_REPO = "me/backup";
    process.env.BACKUP_GITHUB_TOKEN = "tok";
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("refuses to back up without a passphrase and never touches the network", async () => {
    delete process.env.BACKUP_PASSPHRASE;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { runBackup } = await import("@/lib/backup");
    await expect(runBackup()).rejects.toThrow(/BACKUP_PASSPHRASE/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encrypts old plaintext backups: uploads ciphertext BEFORE deleting plaintext", async () => {
    process.env.BACKUP_PASSPHRASE = PASS;
    const original = Buffer.from("old plaintext tarball");
    const calls: string[] = [];
    let uploaded: Buffer | null = null;
    const json = (o: unknown, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.endsWith("/contents/backups")) {
          return json([
            { name: "2026-10-01-000000.tar.gz", path: "backups/2026-10-01-000000.tar.gz", sha: "abc", type: "file" },
            { name: "2026-11-01-000000.tar.gz.enc", path: "backups/2026-11-01-000000.tar.gz.enc", sha: "def", type: "file" },
          ]);
        }
        if (method === "GET" && url.endsWith("2026-10-01-000000.tar.gz")) {
          return new Response(new Uint8Array(original), { status: 200 });
        }
        if (method === "GET") return json({}, 404); // pushToGithub's existing-sha probe
        if (method === "PUT") {
          calls.push("PUT " + url.split("/contents/")[1]);
          uploaded = Buffer.from(JSON.parse(String(init!.body)).content, "base64");
          return json({ ok: true });
        }
        if (method === "DELETE") {
          calls.push("DELETE " + url.split("/contents/")[1]);
          return json({ ok: true });
        }
        return json({}, 500);
      })
    );
    const { encryptExistingBackups } = await import("@/lib/backup");
    const res = await encryptExistingBackups();
    expect(res).toEqual({ encrypted: 1, failed: 0, remainingPlain: 0 });
    expect(calls).toEqual([
      "PUT backups/2026-10-01-000000.tar.gz.enc",
      "DELETE backups/2026-10-01-000000.tar.gz",
    ]);
    expect(decryptBackup(uploaded!, PASS).equals(original)).toBe(true);
  });

  it("encryptExistingBackups needs the passphrase", async () => {
    delete process.env.BACKUP_PASSPHRASE;
    const { encryptExistingBackups } = await import("@/lib/backup");
    await expect(encryptExistingBackups()).rejects.toThrow(/BACKUP_PASSPHRASE/);
  });
});
