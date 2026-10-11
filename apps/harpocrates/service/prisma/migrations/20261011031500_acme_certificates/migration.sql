-- AlterTable: what finalizing an order issued. No order has one yet.
ALTER TABLE "acme_orders" ADD COLUMN "certificate_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "acme_orders_certificate_id_key" ON "acme_orders"("certificate_id");

-- AddForeignKey
ALTER TABLE "acme_orders" ADD CONSTRAINT "acme_orders_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
