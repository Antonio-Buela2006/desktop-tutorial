ALTER TABLE "finance_transactions" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "branch_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "branch_id" uuid;