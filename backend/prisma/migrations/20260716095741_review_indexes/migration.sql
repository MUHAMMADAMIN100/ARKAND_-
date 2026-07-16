-- DropIndex
DROP INDEX "cash_transactions_cashier_id_created_at_idx";

-- CreateIndex
CREATE INDEX "cash_transactions_cashier_id_date_created_at_idx" ON "cash_transactions"("cashier_id", "date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_date_idx" ON "maintenance_records"("date" DESC);

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "purchase_requests_created_at_idx" ON "purchase_requests"("created_at" DESC);
