CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"from_branch_id" uuid,
	"to_branch_id" uuid,
	"lines" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"received_by" uuid,
	"carrier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shipped_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"decision_note" text
);
--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfers_tenant_number" ON "stock_transfers" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "stock_transfers_status" ON "stock_transfers" USING btree ("tenant_id","status");