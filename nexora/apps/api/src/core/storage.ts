/**
 * Armazenamento de ficheiros privado e desacoplado.
 * - "local": disco (desenvolvimento / instalação simples) em STORAGE_DIR.
 * - "s3": object storage compatível com S3 (AWS, MinIO, Cloudflare R2…), sem acesso público.
 * As chaves são sempre prefixadas por tenants/<tenantId>/ — o isolamento também existe no armazenamento.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "./errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const driver = process.env.STORAGE_DRIVER ?? "local";
const localDir = path.resolve(process.env.STORAGE_DIR ?? path.resolve(here, "../../../../.data/files"));

let s3: S3Client | null = null;
const bucket = process.env.S3_BUCKET ?? "";
function client() {
  if (!s3) {
    if (!bucket) throw new AppError(500, "STORAGE_MISCONFIGURED", "Armazenamento S3 não configurado.");
    s3 = new S3Client({ region: process.env.S3_REGION ?? "auto", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT });
  }
  return s3;
}

export function storageKey(tenantId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(tenantId) || !/^[0-9a-f-]{36}$/.test(id)) throw new AppError(400, "BAD_KEY", "Chave inválida.");
  return `tenants/${tenantId}/files/${id}`;
}

function localPath(key: string) {
  const p = path.resolve(localDir, key);
  // Proteção contra path traversal
  if (!p.startsWith(localDir + path.sep)) throw new AppError(400, "BAD_KEY", "Chave inválida.");
  return p;
}

export async function putObject(key: string, data: Buffer, contentType: string) {
  if (driver === "s3") {
    await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: "AES256" }));
    return;
  }
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data, { mode: 0o600 });
}

export async function getObject(key: string): Promise<Buffer> {
  if (driver === "s3") {
    const r = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return fs.readFile(localPath(key));
}

export async function deleteObject(key: string) {
  if (driver === "s3") {
    await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await fs.rm(localPath(key), { force: true });
}

/** Tipos permitidos com verificação da assinatura do conteúdo (magic bytes). */
const ALLOWED: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) => b[0] === 0x50 && b[1] === 0x4b,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (b) => b[0] === 0x50 && b[1] === 0x4b,
  "text/plain": (b) => !b.subarray(0, 512).includes(0),
};
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function validateFile(contentType: string, data: Buffer) {
  const check = ALLOWED[contentType];
  if (!check) throw new AppError(415, "FILE_TYPE_NOT_ALLOWED", "Tipo de ficheiro não permitido. Use PDF, PNG, JPEG, DOCX, XLSX ou TXT.");
  if (data.length === 0) throw new AppError(400, "EMPTY_FILE", "Ficheiro vazio.");
  if (data.length > MAX_FILE_BYTES) throw new AppError(413, "FILE_TOO_LARGE", "Ficheiro demasiado grande (máx. 10 MB).");
  if (!check(data)) throw new AppError(415, "FILE_CONTENT_MISMATCH", "O conteúdo do ficheiro não corresponde ao tipo declarado.");
}

export const sanitizeFileName = (n: string) => n.replace(/[\\/\r\n"]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 150) || "ficheiro";
