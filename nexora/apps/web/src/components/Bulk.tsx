/** Eliminação em lote com pré-visualização (spec 11): mostra o efeito em cada registo antes de confirmar. */
import { useEffect } from "react";
import { post, useAction } from "../lib/api";
import { T, useI18n } from "../lib/i18n";
import { Alert, Badge, Button, ErrorText, Loading, Modal } from "./ui";

type Item = { id: string; label: string | null; status: "ok" | "blocked" | "not_found"; reason?: { code: string; orders?: string[] }; warnings: { code: string; qty?: number }[] };

export function BulkDeleteModal({ endpoint, ids, invalidate, onClose, onDone }: { endpoint: string; ids: string[]; invalidate: string[][]; onClose: () => void; onDone: (n: number) => void }) {
  const { tr } = useI18n();
  const preview = useAction(() => post<{ items: Item[] }>(endpoint, { ids, dryRun: true }));
  const apply = useAction(() => post<{ applied: number }>(endpoint, { ids, dryRun: false }), invalidate);
  useEffect(() => { preview.mutate(undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const items = preview.data?.items ?? [];
  const ok = items.filter((i) => i.status === "ok");
  const describe = (i: Item) => {
    if (i.status === "not_found") return tr("Já não existe ou foi eliminado.");
    if (i.reason?.code === "IN_OPEN_TRANSFER") return `${tr("Em guias de transferência por concluir")}: ${i.reason.orders?.join(", ")}`;
    return i.warnings.map((w) => (w.code === "HAS_STOCK" ? `${tr("Tem stock")}: ${w.qty}` : w.code === "RECENT_SALES" ? tr("Comprou nos últimos 90 dias") : w.code)).join(" · ");
  };
  return (
    <Modal open onClose={onClose} title={`${tr("Eliminar em lote")} · ${ids.length}`} wide>
      {preview.isPending || !preview.data ? (
        preview.error ? <ErrorText error={preview.error} /> : <Loading />
      ) : (
        <div className="space-y-3">
          <Alert tone="info"><T>Pré-visualização: nada foi alterado ainda. Os registos eliminados vão para a lixeira e podem ser restaurados durante o prazo da lixeira.</T></Alert>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-1.5">
                <span>{i.label ?? <span className="font-mono text-xs">{i.id.slice(0, 8)}</span>}<span className="block text-xs muted">{describe(i)}</span></span>
                <Badge tone={i.status === "ok" ? (i.warnings.length ? "amber" : "green") : i.status === "blocked" ? "red" : "gray"}>{i.status === "ok" ? "Será eliminado" : i.status === "blocked" ? "Bloqueado" : "Ignorado"}</Badge>
              </li>
            ))}
          </ul>
          {apply.error && <ErrorText error={apply.error} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}><T>Cancelar</T></Button>
            <Button variant="danger" disabled={!ok.length} loading={apply.isPending} onClick={async () => { const r = await apply.mutateAsync(undefined); onDone(r.applied); }}>
              {tr("Mover para a lixeira")} ({ok.length})
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
