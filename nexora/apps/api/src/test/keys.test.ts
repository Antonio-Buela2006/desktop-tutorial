/** Rotação da chave de encriptação: formatos, porta-chaves, re-encriptação e auditoria. */
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { currentKeyId, decrypt, encrypt, needsReencrypt, setKeyRing } from "../core/crypto.js";
import { rotateEncryptedSecrets } from "../ops/rotate-keys.js";
import { db } from "../db/client.js";
import { auditEvents, users } from "../db/schema.js";
import { signupCompany } from "./helpers.js";

const A = "a".repeat(64);
// A chave "nova" é a dos testes: a rotação só mexe em valores de outras chaves, sem afetar
// os segredos dos ficheiros de teste que correm em paralelo na mesma base.
const B = config.encryptionKey;
afterAll(() => setKeyRing(config.encryptionKey));

/** Formato antigo (antes do porta-chaves): iv.tag.dados, sem versão nem chave. */
function legacyEncrypt(hexKey: string, plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", Buffer.from(hexKey, "hex"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

describe("porta-chaves", () => {
  it("o valor identifica a chave sem a revelar, e lê-se com chaves anteriores", () => {
    setKeyRing(A);
    const v = encrypt("segredo");
    expect(v.startsWith(`v2.${currentKeyId()}.`)).toBe(true);
    expect(v).not.toContain(A.slice(0, 16));
    setKeyRing(B, [A]);
    expect(decrypt(v)).toBe("segredo");
    expect(needsReencrypt(v)).toBe(true);
    expect(needsReencrypt(encrypt("x"))).toBe(false);
    // sem a chave antiga, falha com uma mensagem clara
    setKeyRing(B);
    expect(() => decrypt(v)).toThrow(/chave desconhecida/);
    // formato antigo continua legível
    setKeyRing(B, [A]);
    expect(decrypt(legacyEncrypt(A, "antigo"))).toBe("antigo");
    expect(() => setKeyRing("curta")).toThrow(/64 caracteres/);
  });

  it("a rotação re-encripta os segredos de 2FA, é idempotente e fica auditada", async () => {
    const t = await signupCompany();
    const [u] = await db.select().from(users).where(eq(users.email, t.email));
    setKeyRing(A);
    await db.update(users).set({ totpSecret: encrypt("JBSWY3DPEHPK3PXP") }).where(eq(users.id, u.id));
    const t2 = await signupCompany();
    const [u2] = await db.select().from(users).where(eq(users.email, t2.email));
    await db.update(users).set({ totpSecret: legacyEncrypt(A, "KRSXG5CTMVRXEZLU") }).where(eq(users.id, u2.id));

    setKeyRing(B, [A]);
    const check = await rotateEncryptedSecrets({ check: true });
    expect(check.report["users.totp_secret"].pending).toBeGreaterThanOrEqual(2);
    const r = await rotateEncryptedSecrets();
    expect(r.report["users.totp_secret"].pending).toBe(0);
    expect(r.report["users.totp_secret"].rotated).toBeGreaterThanOrEqual(2);
    expect((await rotateEncryptedSecrets()).report["users.totp_secret"].rotated).toBe(0); // idempotente

    // já sem a chave antiga, os segredos continuam legíveis
    setKeyRing(B);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    const [after2] = await db.select().from(users).where(eq(users.id, u2.id));
    expect(after.totpSecret!.startsWith(`v2.${currentKeyId()}.`)).toBe(true);
    expect(decrypt(after.totpSecret!)).toBe("JBSWY3DPEHPK3PXP");
    expect(decrypt(after2.totpSecret!)).toBe("KRSXG5CTMVRXEZLU");
    const [ev] = await db.select().from(auditEvents).where(eq(auditEvents.action, "security.keys_rotated"));
    expect(ev.metadata).toMatchObject({ keyId: currentKeyId() });
    expect(JSON.stringify(ev)).not.toContain(B.slice(0, 16));
  });
});
