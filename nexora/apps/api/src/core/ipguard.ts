/**
 * Deteção de comportamento anómalo por IP: muitas falhas de autenticação num
 * intervalo curto bloqueiam temporariamente novas tentativas desse IP (resposta
 * automática), registam auditoria de plataforma e contam em métricas.
 * Estado em memória por instância — em produção com várias instâncias, complementar com WAF/rate limit no edge.
 */
import { audit } from "./audit.js";
import { AppError } from "./errors.js";
import { incCounter } from "./observability.js";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = Number(process.env.IP_MAX_AUTH_FAILURES ?? 20);
const failures = new Map<string, number[]>();
const blocked = new Map<string, number>();

export function assertIpAllowed(ip: string) {
  const until = blocked.get(ip);
  if (until && until > Date.now()) throw new AppError(429, "IP_TEMPORARILY_BLOCKED", "Demasiadas tentativas falhadas a partir desta rede. Tente mais tarde.");
  if (until) blocked.delete(ip);
}

export async function recordAuthFailure(ip: string, kind: string) {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  failures.set(ip, list);
  incCounter("nexora_auth_failures_total");
  if (list.length >= MAX_FAILURES && !blocked.has(ip)) {
    blocked.set(ip, now + WINDOW_MS);
    failures.delete(ip);
    incCounter("nexora_ip_blocks_total");
    await audit({ tenantId: null, actorType: "system", action: "security.ip_blocked", summary: `IP ${ip} bloqueado 15 min após ${list.length} falhas de autenticação (${kind}).`, ip });
  }
}

export const resetIpGuard = () => { failures.clear(); blocked.clear(); };
