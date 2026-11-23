import { useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { ApiError, del, fmtDateTime, useAction, useApi } from "../lib/api";
import { Button, ErrorText, Loading, Modal, Select } from "./ui";

/** Documentos privados de um funcionário ou cliente (upload, lista, download, eliminação). */
export function DocumentsModal({ entityType, entity, canEdit, onClose }: { entityType: "employee" | "customer"; entity: { id: string; name: string }; canEdit: boolean; onClose: () => void }) {
  const key = ["files", entityType, entity.id];
  const list = useApi<any[]>(key, `/api/files/${entityType}/${entity.id}`);
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("Contrato");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const remove = useAction((id: string) => del(`/api/files/${id}`), [key]);
  const send = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("file", file);
      const res = await fetch(`/api/files/${entityType}/${entity.id}`, { method: "POST", body: fd, credentials: "include", headers: { "x-nexora-csrf": "1" } });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error?.code, data.error?.message);
      await list.refetch();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Modal open onClose={onClose} title={`Documentos · ${entity.name}`} wide>
      <div className="space-y-3 text-sm">
        {(err || remove.error) && <ErrorText error={err || remove.error} />}
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <label className="block"><span className="label">Categoria</span>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">{["Contrato", "Identificação", "Certificado", "Fatura", "Outro"].map((c) => <option key={c}>{c}</option>)}</Select>
            </label>
            <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} aria-label="Escolher ficheiro" />
            <Button loading={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" /> Carregar ficheiro</Button>
            <p className="w-full text-xs muted">PDF, PNG, JPEG, DOCX, XLSX ou TXT até 10 MB. Armazenamento privado; cada acesso fica auditado.</p>
          </div>
        )}
        {list.isLoading ? <Loading /> : list.error ? <ErrorText error={list.error} /> : !list.data?.length ? <p className="muted">Sem documentos.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2">
                <FileText className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{f.fileName}</p><p className="text-xs muted">{f.category ?? "—"} · {Math.max(1, Math.round(f.size / 1024))} KB · {fmtDateTime(f.createdAt)}</p></div>
                <a href={`/api/files/download/${f.id}`} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Descarregar ${f.fileName}`}><Download className="h-4 w-4" /></a>
                {canEdit && <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)} aria-label={`Eliminar ${f.fileName}`}><Trash2 className="h-4 w-4" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
