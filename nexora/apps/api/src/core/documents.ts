/** Geração de documentos: XLSX (folhas de cálculo) e PDF (relatórios e faturas). */
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

type Rows = Record<string, unknown>[];

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
export function buildReportPdf(datasets: Record<string, Rows>, meta: { company: string; exportedAt: string }): Promise<Buffer> {
  return pdfToBuffer((doc) => {
    doc.fontSize(18).text("Relatório Nexora").moveDown(0.3);
    doc.fontSize(10).fillColor("#555").text(`${meta.company} · exportado em ${meta.exportedAt.slice(0, 16).replace("T", " ")}`).fillColor("#000").moveDown();
    for (const [name, rows] of Object.entries(datasets)) {
      doc.fontSize(13).text(name).moveDown(0.3);
      if (!rows.length) {
        doc.fontSize(9).text("Sem registos.").moveDown();
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
      if (rows.length > 500) doc.fontSize(8).text(`… ${rows.length - 500} registos adicionais disponíveis na exportação CSV/XLSX.`);
      doc.font("Helvetica").moveDown();
    }
  });
}

export function buildInvoicePdf(inv: {
  number: string; status: string; currency: string; issuedAt: Date; dueAt: Date; paidAt: Date | null;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[]; subtotal: number; tax: number; taxRate: number; total: number; amountPaid: number;
}, company: { name: string; taxId: string | null }): Promise<Buffer> {
  const money = (n: number) => new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + inv.currency;
  const statusLabel: Record<string, string> = { issued: "EMITIDA", paid: "PAGA", partially_paid: "PARCIALMENTE PAGA", void: "ANULADA", refunded: "REEMBOLSADA", draft: "RASCUNHO" };
  return pdfToBuffer((doc) => {
    doc.fontSize(22).fillColor("#4338ca").text("Nexora", { continued: false }).fillColor("#000");
    doc.fontSize(9).fillColor("#555").text("Plataforma SaaS de gestão empresarial").fillColor("#000").moveDown();
    doc.fontSize(16).text(`Fatura ${inv.number}`);
    doc.fontSize(10).text(`Estado: ${statusLabel[inv.status] ?? inv.status}`).moveDown(0.5);
    doc.text(`Cliente: ${company.name}${company.taxId ? ` · NIF ${company.taxId}` : ""}`);
    doc.text(`Emissão: ${inv.issuedAt.toISOString().slice(0, 10)}    Vencimento: ${inv.dueAt.toISOString().slice(0, 10)}${inv.paidAt ? `    Pagamento: ${inv.paidAt.toISOString().slice(0, 10)}` : ""}`).moveDown();
    const x = [40, 320, 380, 460];
    const head = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    ["Descrição", "Qtd", "Preço unit.", "Total"].forEach((h, i) => doc.text(h, x[i], head, { width: i === 0 ? 270 : 90 }));
    doc.font("Helvetica").moveDown(0.5);
    for (const l of inv.lines) {
      const y = doc.y;
      doc.text(l.description, x[0], y, { width: 270 });
      const h = doc.y - y;
      doc.text(String(l.quantity), x[1], y).text(money(l.unitPrice), x[2], y).text(money(l.total), x[3], y);
      doc.y = y + Math.max(h, 12) + 4;
    }
    doc.moveDown().font("Helvetica-Bold");
    const tot = (label: string, v: string) => { const y = doc.y; doc.text(label, 320, y).text(v, 460, y); doc.moveDown(0.3); };
    tot("Subtotal", money(inv.subtotal));
    tot(`Imposto (${inv.taxRate}%)`, money(inv.tax));
    tot("Total", money(inv.total));
    tot("Pago", money(inv.amountPaid));
    tot("Em dívida", money(Math.max(0, inv.total - inv.amountPaid)));
    doc.font("Helvetica").moveDown(2).fontSize(8).fillColor("#777")
      .text("Documento informativo. Não constitui fatura fiscal certificada — formato fiscal e impostos pendentes de validação com consultoria local (Angola).", 40, doc.y, { width: 515 });
  });
}

const STATUS_PT: Record<string, string> = { requested: "PEDIDA", in_transit: "EM TRÂNSITO", received: "RECEBIDA", rejected: "REJEITADA", canceled: "CANCELADA" };

/** Guia de transporte de mercadorias entre localizações da empresa. */
export function buildTransferGuidePdf(
  t: { number: string; status: string; lines: { sku: string; name: string; quantity: number }[]; reason: string; carrier: string | null; createdAt: Date; shippedAt: Date | null; receivedAt: Date | null },
  info: { company: string; taxId: string | null; from: string; to: string },
): Promise<Buffer> {
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 16).replace("T", " ") : "—");
  return pdfToBuffer((doc) => {
    doc.fontSize(22).fillColor("#4338ca").text("Nexora").fillColor("#000");
    doc.fontSize(9).fillColor("#555").text(`${info.company}${info.taxId ? ` · NIF ${info.taxId}` : ""}`).fillColor("#000").moveDown();
    doc.fontSize(16).text(`Guia de transporte ${t.number}`);
    doc.fontSize(10).text(`Estado: ${STATUS_PT[t.status] ?? t.status}`).moveDown(0.5);
    doc.text(`Origem: ${info.from}`).text(`Destino: ${info.to}`).text(`Motivo: ${t.reason}`).text(`Transportador: ${t.carrier ?? "—"}`);
    doc.text(`Pedida: ${d(t.createdAt)}    Expedida: ${d(t.shippedAt)}    Recebida: ${d(t.receivedAt)}`).moveDown();
    const y0 = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).text("SKU", 40, y0).text("Produto", 140, y0).text("Quantidade", 460, y0);
    doc.font("Helvetica").moveDown(0.5);
    let total = 0;
    for (const l of t.lines) {
      const y = doc.y;
      doc.text(l.sku, 40, y, { width: 95 }).text(l.name, 140, y, { width: 310 }).text(String(l.quantity), 460, y);
      doc.y = Math.max(doc.y, y + 12) + 3;
      total += l.quantity;
    }
    doc.moveDown().font("Helvetica-Bold").text(`Total de unidades: ${total}`, 40).font("Helvetica").moveDown(3);
    const ys = doc.y;
    doc.text("Expedido por: ____________________", 40, ys).text("Recebido por: ____________________", 310, ys);
    doc.moveDown(3).fontSize(8).fillColor("#777").text("Documento interno de movimentação de mercadorias. O modelo fiscal de guia de transporte (Angola) está pendente de validação com consultoria local.", 40, doc.y, { width: 515 });
  });
}
