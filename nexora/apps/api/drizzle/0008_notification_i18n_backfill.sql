-- Notificações anteriores ao catálogo de mensagens: associa a chave quando o título é reconhecível,
-- para passarem a aparecer no idioma de quem as lê. Os corpos mantêm o texto guardado.
UPDATE "notifications" n SET "i18n" = jsonb_build_object('title', jsonb_build_object('key', k.key))
FROM (VALUES
  ('Novo dispositivo com acesso à sua conta', 'security.new_device.title'),
  ('Pedido de transferência de administração principal', 'ownership.transfer.title'),
  ('Despesa aguarda aprovação', 'finance.approval.title'),
  ('Ação da IA aguarda aprovação', 'ai.approval.title'),
  ('Despesa invulgarmente elevada', 'ai.alert.expense.title'),
  ('Fatura de renovação emitida', 'billing.renewal.title'),
  ('A demonstração terminou', 'trial.expired.title'),
  ('A demonstração termina em breve', 'trial.ending.title'),
  ('Pagamento em atraso: acesso normal até ao 3.º dia.', 'billing.grace.title'),
  ('Pagamento em atraso: modo somente leitura (dias 4–8).', 'billing.read_only.title'),
  ('Subscrição suspensa por falta de pagamento. Os dados estão preservados.', 'billing.suspended.title')
) AS k(title, key)
WHERE n."i18n" IS NULL AND n."title" = k.title;
--> statement-breakpoint
UPDATE "notifications" SET "i18n" = jsonb_build_object('title', jsonb_build_object('key', 'inventory.transfer_request.title', 'params', jsonb_build_object('number', substring("title" from '^Guia de transferência (GT-[0-9]+) aguarda aprovação$'))))
WHERE "i18n" IS NULL AND "title" ~ '^Guia de transferência GT-[0-9]+ aguarda aprovação$';
--> statement-breakpoint
UPDATE "notifications" SET "i18n" = jsonb_build_object('title', jsonb_build_object('key', CASE WHEN "title" LIKE '%(há ruturas)' THEN 'ai.alert.out_of_stock.title' ELSE 'ai.alert.low_stock.title' END, 'params', jsonb_build_object('count', (substring("title" from '^([0-9]+) produto'))::int)))
WHERE "i18n" IS NULL AND "title" ~ '^[0-9]+ produto\(s\) com stock baixo( \(há ruturas\))?$';
--> statement-breakpoint
UPDATE "notifications" n SET "i18n" = jsonb_build_object('title', jsonb_build_object('key', 'incident.update.title', 'params', jsonb_build_object(
  'title', substring(n."title" from '^Incidente: (.*) — [^—]+$'),
  'status', jsonb_build_object('key', s.key))))
FROM (VALUES ('Em investigação', 'incident.status.investigating'), ('Causa identificada', 'incident.status.identified'),
             ('Em monitorização', 'incident.status.monitoring'), ('Resolvido', 'incident.status.resolved')) AS s(label, key)
WHERE n."i18n" IS NULL AND n."title" LIKE 'Incidente: % — ' || s.label;
