# User manual

> Generated from the app's contextual help ("?" button or the ? key on each page). Do not edit by hand: change `apps/web/src/lib/help.ts` and run `pnpm --filter @nexora/web manual`.

## General

- **Sign in**: email and password; with 2FA, enter the code from your authenticator app.
- **Menu**: shows only contracted modules and the areas you can access.
- **Global search** (top): customers, products and people you can see.
- **Tables**: search, sort by column and pagination; actions appear according to your permissions.
- **Language and theme**: PT/EN and light/dark mode at the top; the language is saved to your account.
- **Help**: the "?" button at the top or the ? key for help on the current page.

## Dashboard

`/app` — Business summary: sales this month, low stock, financial result and customers. Only indicators for contracted modules you can access are shown.

**How to**

1. Pick a branch in the selector to see that branch only.
2. See the "Sales by month" chart and the "Products to restock" list (current stock / reorder level).
3. Follow the "Getting started" guide until it is complete.

**Good to know**

- Sales figures exclude canceled sales.
- Users restricted to branches only see their own branches.

## Customers

`/app/customers` — Customer records and business contacts.

**How to**

1. "New customer" to create; the pencil edits and the bin moves to the trash.
2. "Import CSV" loads many customers at once, with a line-by-line preview before saving.
3. Select several rows and use "Delete selected" to bulk delete, with a preview.
4. The paperclip attaches documents to the customer.

**Good to know**

- Click the "Name" and "Created" headers to sort.
- Deleted customers can be restored from the Trash during the configured period.

## Inventory

`/app/products` — Products, stock per location (central warehouse and branches), adjustments and transfer orders.

**How to**

1. "New product" to create; the box icon adjusts stock with a mandatory reason.
2. "Movements" shows the history of stock in and out.
3. "Transfer orders" tab: "New order" requests a transfer; someone else approves and ships it; the destination confirms receipt, stating what arrived.
4. If less arrives than was shipped, give the reason: the difference is recorded as a loss in transit.

**Good to know**

- "runs out in ~N days" is an estimate based on the last 90 days of sales.
- Products in unfinished transfer orders cannot be deleted.
- Each order has a delivery note PDF.

## Sales

`/app/sales` — Sales recording with automatic stock deduction from the sale's branch.

**How to**

1. "New sale": choose the customer (optional), products and quantities.
2. A sale can be canceled; stock is returned to the same location.
3. Use the branch selector to filter.

**Good to know**

- You cannot sell more than the stock available at the location.
- Sales do not replace certified tax invoicing (pending local validation).

## Finance

`/app/finance` — Income and expenses, with approval by someone else above the configured limit, and a cash-flow forecast.

**How to**

1. "New transaction" records income or an expense.
2. Expenses above the limit are "Pending approval": someone else with permission approves or rejects them.
3. Open "Cash-flow forecast" to see estimated income, expenses and balance for the coming months.

**Good to know**

- Whoever recorded an expense cannot approve it (segregation of duties).
- The forecast is an estimate with an interval, not a certainty.
- Financial transactions are never permanently deleted (legal obligation).

## Employees

`/app/employees` — Records of the company's people, separate from login accounts.

**How to**

1. "New employee" to register; salary is only visible and sortable for those with that permission.
2. Record an employee's departure: the linked access is revoked and the seat freed, keeping history.
3. Attach documents with the paperclip.

**Good to know**

- The plan's employee and user limits are counted separately.

## Users

`/app/users` — Accounts with access to Nexora, their roles, permissions and branches.

**How to**

1. "Invite" sends an email invitation (valid for 7 days).
2. The key opens access: roles (also temporary, with an end date), permission overrides and branch restriction.
3. Disabling revokes access immediately and frees the seat.

**Good to know**

- When the user limit is reached you cannot invite, but existing accounts keep working.

## Roles & permissions

`/app/roles` — Built-in and custom roles, with granular permissions enforced on the server.

**How to**

1. "New role" creates a role with the chosen permissions.
2. The pencil edits; built-in roles can be adjusted too.

**Good to know**

- Permissions for modules that are not contracted have no effect.
- Administrative permissions only apply to administrators.

## Subscription & billing

`/app/billing` — Plan, modules, capacity, invoices and payments.

**How to**

1. Change plan or modules: the preview shows the prorated amount before you confirm.
2. Pay an open invoice with the available method.
3. You can schedule cancellation for the end of the paid period and revert it before then.

**Good to know**

- Late payment: days 1–3 normal access, 4–8 read-only, from day 9 suspended; data is preserved.
- Real payments (e.g. Multicaixa Express) are not integrated yet.

## Company settings

`/app/settings` — Company details, security, alerts, branches, ownership and support access.

**How to**

1. Security: require 2FA, idle session timeout, devices per user, trash period and default language.
2. Smart alerts: types, thresholds, email for critical alerts, escalation to administrators and recipients by role.
3. Branches: create and deactivate branches.
4. Nexora support: grant temporary access with a reason, scope and duration.

**Good to know**

- Transferring primary administration requires confirmation by the recipient.

## AI assistant

`/app/ai` — Assistant with your permissions and the company's policies. Sensitive actions need human approval.

**How to**

1. Type or dictate a question, or use a suggestion (overview, low stock, forecasts, price simulation).
2. Approvals: actions proposed by the AI wait for someone else's approval.
3. Credits & usage: balance, history and depletion forecast.
4. AI policies (administrators): data access, autonomy, modules, alerts and contextual learning.

**Good to know**

- With contextual learning on, ask for "recommendations" based on the company's history.
- Without credits only the AI is blocked; the rest of Nexora keeps working.

## Audit log

`/app/audit` — Record of relevant actions by users, the system, AI and Nexora support, hash-chained.

**How to**

1. Filter by source or search.
2. "Chain intact" confirms no record was altered or deleted.

**Good to know**

- Records cannot be edited or deleted.

## Export data

`/app/exports` — Export in open formats (CSV, JSON, XLSX, PDF), respecting your permissions.

**How to**

1. Choose the datasets and the format.
2. Download the file from the link (valid for a limited time).

**Good to know**

- Every export is recorded in the audit log.
- After cancellation, export remains available during the retention period.

## Trash

`/app/trash` — Deleted records, recoverable during the configured period.

**How to**

1. "Restore" puts the record back.

**Good to know**

- After the period, deletion is permanent, except financial records under legal obligation or legal hold.

## Notifications

`/app/notifications` — System and AI alerts, in your chosen language.

**How to**

1. Mark as read; open the link to go to the right place.
2. "My preferences": mute types, email and quiet hours.

**Good to know**

- Security, billing, incidents and escalations cannot be muted.

## Account security

`/app/security` — Password, two-factor authentication and active sessions.

**How to**

1. Turn on 2FA with an authenticator app (Google or Microsoft Authenticator) and keep the recovery codes.
2. End sessions on devices you do not recognise.
3. Change your password: other sessions are ended.

**Good to know**

- You are notified (in the app and by email) of a sign-in from a new device, a sign-in after several failed attempts, and when the account is locked after wrong attempts.
