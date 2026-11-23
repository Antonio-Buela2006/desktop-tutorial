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

const key = Buffer.from(config.encryptionKey, "hex");

/** AES-256-GCM para segredos em repouso (ex.: segredos TOTP). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
