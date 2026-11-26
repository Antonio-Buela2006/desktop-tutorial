/**
 * Análise antivírus de uploads via ClamAV (clamd, protocolo INSTREAM).
 * Ativo quando CLAMAV_HOST está definido. Se estiver configurado mas indisponível,
 * o upload é recusado (falha fechada) — nunca se aceita um ficheiro por analisar.
 */
import net from "node:net";
import { AppError } from "./errors.js";

export async function scanBuffer(data: Buffer): Promise<void> {
  const host = process.env.CLAMAV_HOST;
  if (!host) return;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  const verdict = await new Promise<string>((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    sock.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS ?? 15000));
    sock.on("timeout", () => { sock.destroy(); reject(new Error("timeout")); });
    sock.on("error", reject);
    sock.on("data", (d) => chunks.push(Buffer.from(d)));
    sock.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
    sock.on("connect", () => {
      sock.write("zINSTREAM\0");
      for (let i = 0; i < data.length; i += 64 * 1024) {
        const chunk = data.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        sock.write(len);
        sock.write(chunk);
      }
      sock.write(Buffer.alloc(4)); // fim do stream
    });
  }).catch(() => {
    throw new AppError(503, "ANTIVIRUS_UNAVAILABLE", "O serviço antivírus está indisponível; tente carregar o ficheiro mais tarde.");
  });
  if (/FOUND$/.test(verdict)) throw new AppError(422, "FILE_INFECTED", "O ficheiro foi bloqueado pelo antivírus.", { signature: verdict.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "") });
  if (!/OK$/.test(verdict)) throw new AppError(503, "ANTIVIRUS_UNAVAILABLE", "Resposta inesperada do antivírus; ficheiro não aceite.");
}
