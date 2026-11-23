/**
 * Regras puras (sem I/O) de subscrição: estados derivados, atraso, troca de
 * módulos e cálculo proporcional. Testadas em subscription.test.ts.
 */

export const DAY = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 14;
export const MODULE_SWAP_FREE_DAYS = 7;

/** Estados efetivos de acesso (especificação §5.3 e §6.1). */
export type AccessState =
  | "trial"
  | "trial_expired"
  | "pending_payment"
  | "active"
  | "grace" // dias 1–3 após vencimento: acesso normal + avisos
  | "read_only" // dias 4–8: só consulta e exportação
  | "suspended" // dia 9+: acesso operacional suspenso
  | "cancel_scheduled" // cancelada, ativa até ao fim do período pago
  | "canceled" // terminou o período após cancelamento
  | "expired";

export type SubscriptionLike = {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Dias completos de atraso desde o vencimento (dia 1 = primeiras 24h após vencer). */
export function daysOverdue(oldestUnpaidDueAt: Date | null, now: Date): number {
  if (!oldestUnpaidDueAt) return 0;
  const diff = now.getTime() - oldestUnpaidDueAt.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / DAY) + 1;
}

export function overdueState(days: number): "ok" | "grace" | "read_only" | "suspended" {
  if (days <= 0) return "ok";
  if (days <= 3) return "grace";
  if (days <= 8) return "read_only";
  return "suspended";
}

export function computeAccessState(sub: SubscriptionLike, oldestUnpaidDueAt: Date | null, now: Date): AccessState {
  if (sub.status === "trial") {
    return sub.trialEndsAt && now > sub.trialEndsAt ? "trial_expired" : "trial";
  }
  if (sub.status === "pending_payment") return "pending_payment";
  if (sub.status === "canceled") return "canceled";
  if (sub.status === "expired") return "expired";
  // active
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && now > sub.currentPeriodEnd) return "canceled";
  const o = overdueState(daysOverdue(oldestUnpaidDueAt, now));
  if (o === "suspended") return "suspended";
  if (o === "read_only") return "read_only";
  if (o === "grace") return "grace";
  if (sub.cancelAtPeriodEnd) return "cancel_scheduled";
  return "active";
}

export type AccessCapabilities = { read: boolean; write: boolean; export: boolean; billing: boolean };

/** O que cada estado permite. Faturação/pagamento é sempre possível para regularizar. */
export function capabilitiesFor(state: AccessState): AccessCapabilities {
  switch (state) {
    case "trial":
    case "active":
    case "grace":
    case "cancel_scheduled":
      return { read: true, write: true, export: true, billing: true };
    case "read_only":
      return { read: true, write: false, export: true, billing: true };
    case "pending_payment":
    case "trial_expired":
    case "suspended":
    case "canceled":
    case "expired":
      // Dados preservados; acesso operacional bloqueado. Exportação dos próprios dados
      // após cancelamento é permitida (§6.4) — controlada pelo período de retenção.
      return { read: false, write: false, export: state === "canceled", billing: true };
  }
}

/** Janela de troca gratuita de módulos: 7 dias desde a ativação inicial, não reinicia. */
export function isWithinFreeSwapWindow(swapWindowEndsAt: Date | null, now: Date): boolean {
  return !!swapWindowEndsAt && now <= swapWindowEndsAt;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valor proporcional de uma diferença de preço mensal para o resto do período.
 * Positivo = cobrança; negativo = crédito.
 */
export function prorate(priceDelta: number, periodStart: Date, periodEnd: Date, now: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.max(0, periodEnd.getTime() - now.getTime());
  return round2(priceDelta * (remaining / total));
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

export type Limits = { maxEmployees: number | null; maxUsers: number | null; maxSecondaryAdmins: number | null; includedModules: number | null };

/** Limites efetivos = plano + capacidade adicional comprada. null = sem limite configurado (pendente). */
export function effectiveLimits(plan: Limits, extraUsers: number, extraEmployees: number): Limits {
  return {
    maxEmployees: plan.maxEmployees === null ? null : plan.maxEmployees + extraEmployees,
    maxUsers: plan.maxUsers === null ? null : plan.maxUsers + extraUsers,
    maxSecondaryAdmins: plan.maxSecondaryAdmins,
    includedModules: plan.includedModules,
  };
}

/** Pré-visualização de mudança de plano: lista os limites que ficariam ultrapassados. */
export function limitViolations(
  target: Limits,
  usage: { employees: number; users: number; secondaryAdmins: number; modules: number },
): string[] {
  const out: string[] = [];
  if (target.maxEmployees !== null && usage.employees > target.maxEmployees)
    out.push(`Funcionários registados (${usage.employees}) acima do limite (${target.maxEmployees}).`);
  if (target.maxUsers !== null && usage.users > target.maxUsers)
    out.push(`Utilizadores ativos (${usage.users}) acima do limite (${target.maxUsers}).`);
  if (target.maxSecondaryAdmins !== null && usage.secondaryAdmins > target.maxSecondaryAdmins)
    out.push(`Administradores secundários (${usage.secondaryAdmins}) acima do limite (${target.maxSecondaryAdmins}).`);
  if (target.includedModules !== null && usage.modules > target.includedModules)
    out.push(`Módulos ativos (${usage.modules}) acima da franquia (${target.includedModules}); excedentes passam a adicionais pagos.`);
  return out;
}

/** Verifica dependências: devolve as dependências em falta para ativar `code`. */
export function missingDependencies(code: string, active: Set<string>, catalog: Map<string, string[]>): string[] {
  return (catalog.get(code) ?? []).filter((d) => !active.has(d));
}

/** Devolve os módulos ativos que dependem de `code` (impedem a desativação). */
export function dependents(code: string, active: Set<string>, catalog: Map<string, string[]>): string[] {
  return [...active].filter((m) => m !== code && (catalog.get(m) ?? []).includes(code));
}
