import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export const hmacSha256 = (secret: string, v: string) => crypto.createHmac("sha256", secret).update(v).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Política mínima de palavra-passe: 10+ caracteres, letras e números. */
export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "A palavra-passe deve conter letras e números.";
  return null;
}

/* ---------------- Encriptação em repouso com rotação de chaves ---------------- */
/**
 * AES-256-GCM para segredos em repouso (ex.: segredos TOTP).
 * Porta-chaves: `ENCRYPTION_KEY` (atual, usada para encriptar) + `ENCRYPTION_KEYS_PREVIOUS` (só leitura).
 * Formato: `v2.<kid>.<iv>.<tag>.<dados>`, onde kid identifica a chave (8 hex do SHA-256 da chave),
 * sem nunca a revelar. Valores antigos sem versão (`<iv>.<tag>.<dados>`) continuam legíveis.
 * Rotação: ver `src/ops/rotate-keys.ts` e docs/architecture/deployment.md.
 */
export type KeyEntry = { id: string; key: Buffer };

function toEntry(hex: string): KeyEntry {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Chave de encriptação inválida: são precisos 64 caracteres hexadecimais.");
  return { id: sha256(hex.toLowerCase()).slice(0, 8), key: Buffer.from(hex, "hex") };
}

let ring: { current: KeyEntry; previous: KeyEntry[] } = {
  current: toEntry(config.encryptionKey),
  previous: config.previousEncryptionKeys.map(toEntry),
};

/** Chaves conhecidas, a atual primeiro (também usado para ler backups antigos). */
export const allKeys = (): KeyEntry[] => [ring.current, ...ring.previous];
export const currentKeyId = () => ring.current.id;

/** Só para testes e para o comando de rotação: define o porta-chaves a partir de chaves em hex. */
export function setKeyRing(current: string, previous: string[] = []) {
  ring = { current: toEntry(current), previous: previous.map(toEntry) };
}

function gcmDecrypt(key: Buffer, iv: Buffer, tag: Buffer, enc: Buffer) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ring.current.key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v2", ring.current.id, ...[iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url"))].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts[0] === "v2" && parts.length === 5) {
    const entry = allKeys().find((k) => k.id === parts[1]);
    if (!entry) throw new Error(`Valor encriptado com uma chave desconhecida (${parts[1]}). Acrescente-a a ENCRYPTION_KEYS_PREVIOUS.`);
    const [iv, tag, enc] = parts.slice(2).map((p) => Buffer.from(p, "base64url"));
    return gcmDecrypt(entry.key, iv, tag, enc);
  }
  // Formato antigo, sem identificação da chave: tenta todas as chaves conhecidas.
  const [iv, tag, enc] = parts.map((p) => Buffer.from(p, "base64url"));
  for (const k of allKeys()) {
    try {
      return gcmDecrypt(k.key, iv, tag, enc);
    } catch {
      /* chave seguinte */
    }
  }
  throw new Error("Não foi possível desencriptar com nenhuma das chaves conhecidas.");
}

/** Verdadeiro se o valor não está encriptado com a chave atual (deve ser re-encriptado na rotação). */
export const needsReencrypt = (payload: string) => !payload.startsWith(`v2.${ring.current.id}.`);
