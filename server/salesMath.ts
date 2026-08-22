export type SaleLine = { quantity: number; unitPrice: number };

export function calculateSaleTotals(lines: SaleLine[], taxRate = 0.14) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const taxAmount = subtotal * taxRate;
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

export function buildDoubleEntryLines(totalAmount: number, subtotal: number, taxAmount: number) {
  return [
    { accountCode: "11.1", debit: totalAmount, credit: 0 },
    { accountCode: "71.1", debit: 0, credit: subtotal },
    { accountCode: "24.3", debit: 0, credit: taxAmount },
  ];
}
