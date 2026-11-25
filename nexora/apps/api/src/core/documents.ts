/** Geração de documentos: XLSX (folhas de cálculo) e PDF (relatórios e faturas). */
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

type Rows = Record<string, unknown>[];
type Lc = "pt" | "en";

/** Textos fixos dos documentos em PT/EN. */
const TX = {
  pt: {
    report: "Relatório Nexora", exportedAt: "exportado em", noRecords: "Sem registos.", moreRows: (n: number) => `… ${n} registos adicionais disponíveis na exportação CSV/XLSX.`,
    tagline: "Plataforma SaaS de gestão empresarial", invoice: "Fatura", status: "Estado", customer: "Cliente", taxId: "NIF", issued: "Emissão", due: "Vencimento", paidOn: "Pagamento",
    cols: ["Descrição", "Qtd", "Preço unit.", "Total"], subtotal: "Subtotal", tax: "Imposto", total: "Total", paid: "Pago", outstanding: "Em dívida",
    invoiceNote: "Documento informativo. Não constitui fatura fiscal certificada — formato fiscal e impostos pendentes de validação com consultoria local (Angola).",
    invoiceStatus: { issued: "EMITIDA", paid: "PAGA", partially_paid: "PARCIALMENTE PAGA", void: "ANULADA", refunded: "REEMBOLSADA", draft: "RASCUNHO" } as Record<string, string>,
    guide: "Guia de transporte", origin: "Origem", destination: "Destino", reason: "Motivo", carrier: "Transportador", requested: "Pedida", shipped: "Expedida", received: "Recebida",
    guideCols: ["SKU", "Produto", "Quantidade"], units: "Total de unidades", receivedCol: "Recebida", receiptNote: "Diferenças na receção", shippedBy: "Expedido por", receivedBy: "Recebido por",
    guideNote: "Documento interno de movimentação de mercadorias. O modelo fiscal de guia de transporte (Angola) está pendente de validação com consultoria local.",
    guideStatus: { requested: "PEDIDA", in_transit: "EM TRÂNSITO", received: "RECEBIDA", rejected: "REJEITADA", canceled: "CANCELADA" } as Record<string, string>,
    numberLocale: "pt-PT",
  },
  en: {
    report: "Nexora report", exportedAt: "exported on", noRecords: "No records.", moreRows: (n: number) => `… ${n} more records available in the CSV/XLSX export.`,
    tagline: "Business management SaaS platform", invoice: "Invoice", status: "Status", customer: "Customer", taxId: "Tax ID", issued: "Issued", due: "Due", paidOn: "Paid",
    cols: ["Description", "Qty", "Unit price", "Total"], subtotal: "Subtotal", tax: "Tax", total: "Total", paid: "Paid", outstanding: "Outstanding",
    invoiceNote: "Informational document. Not a certified tax invoice — tax format and taxes pending validation with local advisors (Angola).",
    invoiceStatus: { issued: "ISSUED", paid: "PAID", partially_paid: "PARTIALLY PAID", void: "VOID", refunded: "REFUNDED", draft: "DRAFT" } as Record<string, string>,
    guide: "Delivery note", origin: "Origin", destination: "Destination", reason: "Reason", carrier: "Carrier", requested: "Requested", shipped: "Shipped", received: "Received",
    guideCols: ["SKU", "Product", "Quantity"], units: "Total units", receivedCol: "Received", receiptNote: "Receipt discrepancies", shippedBy: "Shipped by", receivedBy: "Received by",
    guideNote: "Internal goods movement document. The Angolan tax model for delivery notes is pending validation with local advisors.",
    guideStatus: { requested: "REQUESTED", in_transit: "IN TRANSIT", received: "RECEIVED", rejected: "REJECTED", canceled: "CANCELED" } as Record<string, string>,
    numberLocale: "en-GB",
  },
} as const;
export const docLocale = (l: unknown): Lc => (l === "en" ? "en" : "pt");

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") return JSON.stringify(v);
  // Proteção contra injeção de fórmulas
  if (typeof v === "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v as string | number | boolean;
};

export async function buildXlsx(datasets: Record<string, Rows>, meta: { company: string; exportedAt: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexora";
  wb.created = new Date(meta.exportedAt);
  const info = wb.addWorksheet("Exportação");
  info.addRows([["Empresa", meta.company], ["Exportado em", meta.exportedAt], ["Conjuntos", Object.keys(datasets).join(", ")]]);
  info.getColumn(1).width = 18;
  info.getColumn(2).width = 50;
  for (const [name, rows] of Object.entries(datasets)) {
    const ws = wb.addWorksheet(name.slice(0, 31));
    const cols = rows.length ? Object.keys(rows[0]) : ["(sem registos)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of rows) ws.addRow(Object.fromEntries(cols.map((c) => [c, cell(r[c])])));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function pdfToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: "Nexora", Producer: "Nexora" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

const fmt = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Relatório tabular em PDF (até 8 colunas por conjunto, landscape implícito por truncagem). */
export function buildReportPdf(datasets: Record<string, Rows>, meta: { company: string; exportedAt: string }, lc: Lc = "pt"): Promise<Buffer> {
  const x = TX[lc];
  return pdfToBuffer((doc) => {
    doc.fontSize(18).text(x.report).moveDown(0.3);
    doc.fontSize(10).fillColor("#555").text(`${meta.company} · ${x.exportedAt} ${meta.exportedAt.slice(0, 16).replace("T", " ")}`).fillColor("#000").moveDown();
    for (const [name, rows] of Object.entries(datasets)) {
      doc.fontSize(13).text(name).moveDown(0.3);
      if (!rows.length) {
        doc.fontSize(9).text(x.noRecords).moveDown();
        continue;
      }
      const cols = Object.keys(rows[0]).filter((c) => c !== "id").slice(0, 7);
      const width = (doc.page.width - 80) / cols.length;
      const row = (vals: string[], bold = false) => {
        const y = doc.y;
        doc.fontSize(7.5).font(bold ? "Helvetica-Bold" : "Helvetica");
        let h = 0;
        vals.forEach((v, i) => {
          const t = v.length > 60 ? v.slice(0, 57) + "…" : v;
          doc.text(t, 40 + i * width, y, { width: width - 4 });
          h = Math.max(h, doc.y - y);
        });
        doc.y = y + h + 3;
        if (doc.y > doc.page.height - 60) doc.addPage();
      };
      row(cols, true);
      for (const r of rows.slice(0, 500)) row(cols.map((c) => fmt(r[c])));
      if (rows.length > 500) doc.fontSize(8).text(x.moreRows(rows.length - 500));
      doc.font("Helvetica").moveDown();
    }
  });
}

export function buildInvoicePdf(inv: {
  number: string; status: string; currency: string; issuedAt: Date; dueAt: Date; paidAt: Date | null;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[]; subtotal: number; tax: number; taxRate: number; total: number; amountPaid: number;
}, company: { name: string; taxId: string | null }, lc: Lc = "pt"): Promise<Buffer> {
  const x = TX[lc];
  const money = (n: number) => new Intl.NumberFormat(x.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + inv.currency;
  const statusLabel = x.invoiceStatus;
  return pdfToBuffer((doc) => {
    doc.fontSize(22).fillColor("#4338ca").text("Nexora", { continued: false }).fillColor("#000");
    doc.fontSize(9).fillColor("#555").text(x.tagline).fillColor("#000").moveDown();
    doc.fontSize(16).text(`${x.invoice} ${inv.number}`);
    doc.fontSize(10).text(`${x.status}: ${statusLabel[inv.status] ?? inv.status}`).moveDown(0.5);
    doc.text(`${x.customer}: ${company.name}${company.taxId ? ` · ${x.taxId} ${company.taxId}` : ""}`);
    doc.text(`${x.issued}: ${inv.issuedAt.toISOString().slice(0, 10)}    ${x.due}: ${inv.dueAt.toISOString().slice(0, 10)}${inv.paidAt ? `    ${x.paidOn}: ${inv.paidAt.toISOString().slice(0, 10)}` : ""}`).moveDown();
    const cx = [40, 320, 380, 460];
    const head = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    x.cols.forEach((h, i) => doc.text(h, cx[i], head, { width: i === 0 ? 270 : 90 }));
    doc.font("Helvetica").moveDown(0.5);
    for (const l of inv.lines) {
      const y = doc.y;
      doc.text(l.description, cx[0], y, { width: 270 });
      const h = doc.y - y;
      doc.text(String(l.quantity), cx[1], y).text(money(l.unitPrice), cx[2], y).text(money(l.total), cx[3], y);
      doc.y = y + Math.max(h, 12) + 4;
    }
    doc.moveDown().font("Helvetica-Bold");
    const tot = (label: string, v: string) => { const y = doc.y; doc.text(label, 320, y).text(v, 460, y); doc.moveDown(0.3); };
    tot(x.subtotal, money(inv.subtotal));
    tot(`${x.tax} (${inv.taxRate}%)`, money(inv.tax));
    tot(x.total, money(inv.total));
    tot(x.paid, money(inv.amountPaid));
    tot(x.outstanding, money(Math.max(0, inv.total - inv.amountPaid)));
    doc.font("Helvetica").moveDown(2).fontSize(8).fillColor("#777")
      .text(x.invoiceNote, 40, doc.y, { width: 515 });
  });
}


/** Guia de transporte de mercadorias entre localizações da empresa. */
export function buildTransferGuidePdf(
  t: { number: string; status: string; lines: { sku: string; name: string; quantity: number; received?: number }[]; reason: string; carrier: string | null; createdAt: Date; shippedAt: Date | null; receivedAt: Date | null; receiptNote?: string | null },
  info: { company: string; taxId: string | null; from: string; to: string },
  lc: Lc = "pt",
): Promise<Buffer> {
  const x = TX[lc];
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 16).replace("T", " ") : "—");
  return pdfToBuffer((doc) => {
    doc.fontSize(22).fillColor("#4338ca").text("Nexora").fillColor("#000");
    doc.fontSize(9).fillColor("#555").text(`${info.company}${info.taxId ? ` · ${x.taxId} ${info.taxId}` : ""}`).fillColor("#000").moveDown();
    doc.fontSize(16).text(`${x.guide} ${t.number}`);
    doc.fontSize(10).text(`${x.status}: ${x.guideStatus[t.status] ?? t.status}`).moveDown(0.5);
    doc.text(`${x.origin}: ${info.from}`).text(`${x.destination}: ${info.to}`).text(`${x.reason}: ${t.reason}`).text(`${x.carrier}: ${t.carrier ?? "—"}`);
    doc.text(`${x.requested}: ${d(t.createdAt)}    ${x.shipped}: ${d(t.shippedAt)}    ${x.received}: ${d(t.receivedAt)}`).moveDown();
    const y0 = doc.y;
    const showReceived = t.lines.some((l) => l.received !== undefined);
    doc.font("Helvetica-Bold").fontSize(9).text(x.guideCols[0], 40, y0).text(x.guideCols[1], 140, y0).text(x.guideCols[2], showReceived ? 400 : 460, y0);
    if (showReceived) doc.text(x.receivedCol, 480, y0);
    doc.font("Helvetica").moveDown(0.5);
    let total = 0;
    for (const l of t.lines) {
      const y = doc.y;
      doc.text(l.sku, 40, y, { width: 95 }).text(l.name, 140, y, { width: showReceived ? 250 : 310 }).text(String(l.quantity), showReceived ? 400 : 460, y);
      if (showReceived) doc.text(String(l.received ?? l.quantity), 480, y);
      doc.y = Math.max(doc.y, y + 12) + 3;
      total += l.quantity;
    }
    doc.moveDown().font("Helvetica-Bold").text(`${x.units}: ${total}`, 40).font("Helvetica");
    if (t.receiptNote) doc.moveDown(0.5).text(`${x.receiptNote}: ${t.receiptNote}`, 40, doc.y, { width: 515 });
    doc.moveDown(3);
    const ys = doc.y;
    doc.text(`${x.shippedBy}: ____________________`, 40, ys).text(`${x.receivedBy}: ____________________`, 310, ys);
    doc.moveDown(3).fontSize(8).fillColor("#777").text(x.guideNote, 40, doc.y, { width: 515 });
  });
}
