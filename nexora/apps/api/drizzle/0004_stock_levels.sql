CREATE TABLE "stock_levels" (
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_levels_product_id_branch_id_pk" PRIMARY KEY("product_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_levels_tenant" ON "stock_levels" USING btree ("tenant_id");