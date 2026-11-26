/**
 * Rotação da chave de encriptação em repouso (ENCRYPTION_KEY).
 *
 * Procedimento (ver docs/architecture/deployment.md):
 *   1. Gerar uma chave nova (`openssl rand -hex 32`) no secret manager.
 *   2. Publicar com ENCRYPTION_KEY=<nova> e ENCRYPTION_KEYS_PREVIOUS=<antiga>. A aplicação lê as duas.
 *   3. Correr `pnpm keys:rotate` (re-encripta tudo com a nova; idempotente, pode repetir-se).
 *   4. Confirmar com `pnpm keys:rotate --check` (0 pendentes) e retirar a antiga de ENCRYPTION_KEYS_PREVIOUS.
 *      Backups feitos com a chave antiga só se restauram enquanto ela estiver no porta-chaves
 *      (ou com BACKUP_ENCRYPTION_KEY): guarde-a no secret manager até esses backups expirarem.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { and, eq, isNotNull } from "drizzle-orm";
import { unscopedDb as db, sql } from "../db/client.js";
import { platformAdmins, users } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { currentKeyId, decrypt, encrypt, needsReencrypt } from "../core/crypto.js";

/** Tabelas e colunas com valores encriptados com a chave de aplicação. */
const TARGETS = [
  { name: "users.totp_secret", table: users, id: users.id, col: users.totpSecret, field: "totpSecret" as const },
  { name: "platform_admins.totp_secret", table: platformAdmins, id: platformAdmins.id, col: platformAdmins.totpSecret, field: "totpSecret" as const },
];

export async function rotateEncryptedSecrets(opts: { check?: boolean } = {}) {
  const report: Record<string, { total: number; pending: number; rotated: number }> = {};
  for (const t of TARGETS) {
    const rows = await db.select({ id: t.id, value: t.col }).from(t.table as any).where(isNotNull(t.col));
    const pending = rows.filter((r) => r.value && needsReencrypt(r.value));
    let rotated = 0;
    if (!opts.check) {
      for (const r of pending) {
        const fresh = encrypt(decrypt(r.value!)); // falha (e para) se o valor usar uma chave que não está no porta-chaves
        // Atualização condicional: se o valor mudou entretanto (p. ex. o utilizador reconfigurou o 2FA), não se sobrepõe.
        const done = await db.update(t.table as any).set({ [t.field]: fresh }).where(and(eq(t.id, r.id), eq(t.col, r.value!))).returning({ id: t.id });
        rotated += done.length;
      }
    }
    report[t.name] = { total: rows.length, pending: pending.length - rotated, rotated };
  }
  const rotatedTotal = Object.values(report).reduce((s, r) => s + r.rotated, 0);
  if (rotatedTotal)
    await audit({ tenantId: null, actorType: "system", action: "security.keys_rotated", summary: `Segredos re-encriptados com a chave ${currentKeyId()}: ${rotatedTotal}.`, metadata: { keyId: currentKeyId(), report } });
  return { keyId: currentKeyId(), report };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const check = process.argv.includes("--check");
  rotateEncryptedSecrets({ check })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      const pending = Object.values(r.report).reduce((s, x) => s + x.pending, 0);
      if (check && pending) process.exitCode = 2;
    })
    .catch((e) => {
      console.error((e as Error).message);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}
