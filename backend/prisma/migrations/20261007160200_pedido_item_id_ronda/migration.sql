-- PedidoItem.idRonda: idempotencia al agregar rondas.
-- Los items que ya existían se agrupan por pedido y momento de creación.
ALTER TABLE "PedidoItem" ADD COLUMN "idRonda" TEXT;

UPDATE "PedidoItem"
SET "idRonda" = "pedidoId" || ':' || extract(epoch FROM "creadoEn")::text;

ALTER TABLE "PedidoItem" ALTER COLUMN "idRonda" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idRonda_idx" ON "PedidoItem"("pedidoId", "idRonda");
