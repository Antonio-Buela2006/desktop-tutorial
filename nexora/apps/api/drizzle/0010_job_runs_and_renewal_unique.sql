CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"result" jsonb,
	"error" text,
	"host" text
);
--> statement-breakpoint
CREATE INDEX "job_runs_started" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
-- Duplicados criados antes desta restrição (duas execuções em simultâneo): mantém a primeira fatura de cada
-- período e marca as restantes para revisão manual, sem as apagar (registos financeiros).
UPDATE "invoices" i SET "meta" = (i."meta" - 'renewalKey') || jsonb_build_object('duplicateRenewalKey', i."meta"->>'renewalKey', 'needsReview', true)
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "tenant_id", "meta"->>'renewalKey' ORDER BY "issued_at", "id") AS rn
  FROM "invoices" WHERE ("meta"->>'renewalKey') IS NOT NULL
) d
WHERE i."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_renewal_key" ON "invoices" USING btree ("tenant_id",("meta"->>'renewalKey')) WHERE ("invoices"."meta"->>'renewalKey') is not null;