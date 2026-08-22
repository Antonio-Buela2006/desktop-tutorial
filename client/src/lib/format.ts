export function money(value: number, currency = "AOA") {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function shortDate(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function statusLabel(status: string) {
  return ({ pendente: "Pendente", pago: "Pago", concluido: "Concluído", agendada: "Agendada", em_transito: "Em trânsito", entregue: "Entregue", vencido: "Vencido", atrasada: "Atrasada" } as Record<string, string>)[status] ?? status;
}
