import { useState } from "react";
import { Upload } from "lucide-react";
import { post, useAction } from "../lib/api";
import { T, useI18n } from "../lib/i18n";
import { Alert, Badge, Button, ErrorText, Modal } from "./ui";

const TEMPLATES: Record<string, string> = {
  customers: "nome,email,telefone,nif,notas\nKianda Comércio,geral@exemplo.invalid,+244 900 000 000,5000000000,Cliente importado\n",
  products: "sku,nome,preco,custo,reposicao,stock\nSKU-100,Produto exemplo,1500,1000,10,50\n",
};

const FIELD_LABEL: Record<string, string> = { name: "Nome", email: "E-mail", phone: "Telefone", taxId: "NIF", notes: "Notas", sku: "SKU", unitPrice: "Preço", unitCost: "Custo unitário", reorderLevel: "Nível de reposição", initialStock: "Stock inicial" };

/** Importação CSV em dois passos: pré-visualização (nada é gravado) → confirmação. */
export function ImportModal({ dataset, onClose, onDone }: { dataset: "customers" | "products"; onClose: () => void; onDone: (n: number) => void }) {
  const { lang, tr } = useI18n();
  const fl = (k: string) => tr(FIELD_LABEL[k] ?? k);
  const errText = (e: string) => e.replace(/^(\w+):/, (_m, k) => `${fl(k)}:`);
  const en = lang === "en";
  const [csv, setCsv] = useState("");
  const preview = useAction((v: string) => post(`/api/import/${dataset}/preview`, { csv: v }));
  const commit = useAction((v: string) => post(`/api/import/${dataset}/commit`, { csv: v }), [[dataset], ["products"], ["customers"]]);
  const p = preview.data;
  const readFile = async (f: File) => {
    const text = await f.text();
    setCsv(text);
    preview.mutate(text);
  };
  const tone = { ok: "green", error: "red", duplicate: "amber" } as const;
  const label = { ok: en ? "Valid" : "Válida", error: en ? "Error" : "Erro", duplicate: en ? "Duplicate" : "Duplicado" };
  return (
    <Modal open onClose={onClose} title={dataset === "customers" ? "Importar clientes" : "Importar produtos"} wide>
      <div className="space-y-3 text-sm">
        <p className="muted"><T>Carregue um ficheiro CSV (separado por vírgulas ou ponto e vírgula, com cabeçalho). Primeiro vê o resultado linha a linha; nada é gravado até confirmar.</T></p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" /><T>Escolher ficheiro CSV</T>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          <a className="text-xs underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATES[dataset])}`} download={`modelo-${dataset}.csv`}><T>Descarregar modelo</T></a>
        </div>
        <details><summary className="cursor-pointer text-xs muted"><T>Ou colar o conteúdo</T></summary>
          <textarea className="input mt-2 font-mono text-xs" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="CSV" />
          <Button size="sm" variant="secondary" className="mt-2" disabled={!csv.trim()} loading={preview.isPending} onClick={() => preview.mutate(csv)}>Pré-visualizar</Button>
        </details>
        {preview.error && <ErrorText error={preview.error} />}
        {commit.error && <ErrorText error={commit.error} />}
        {p && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{p.valid} {en ? "valid" : "válidas"}</Badge>
              {p.errors > 0 && <Badge tone="red">{p.errors} {en ? "with errors" : "com erros"}</Badge>}
              {p.duplicates > 0 && <Badge tone="amber">{p.duplicates} {en ? "duplicates" : "duplicados"}</Badge>}
              {p.ignoredColumns.length > 0 && <span className="text-xs muted">{en ? "Ignored columns" : "Colunas ignoradas"}: {p.ignoredColumns.join(", ")}</span>}
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900"><tr><th className="th">#</th><th className="th"><T>Estado</T></th>{p.columns.map((c: string) => <th key={c} className="th">{fl(c)}</th>)}<th className="th"><T>Problemas</T></th></tr></thead>
                <tbody>
                  {p.rows.map((r: any) => (
                    <tr key={r.line} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="td">{r.line}</td>
                      <td className="td"><Badge tone={tone[r.status as keyof typeof tone]}>{label[r.status as keyof typeof label]}</Badge></td>
                      {p.columns.map((c: string) => <td key={c} className="td">{r.data[c] === undefined ? "" : String(r.data[c])}</td>)}
                      <td className="td text-rose-600">{r.errors.map(errText).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.valid === 0 ? <Alert tone="warning"><T>Não há linhas válidas para importar.</T></Alert> : (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button loading={commit.isPending} onClick={async () => { const r = await commit.mutateAsync(csv); onDone(r.created); }}>{en ? `Import ${p.valid} record(s)` : `Importar ${p.valid} registo(s)`}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
