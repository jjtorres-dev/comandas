-- Pago.itemIds: items que cubre el pago cuando la cuenta se divide por platos
ALTER TABLE "Pago" ADD COLUMN "itemIds" TEXT[];
