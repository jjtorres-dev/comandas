-- Quién canceló un item (o parte de sus unidades) y cuándo
ALTER TABLE "PedidoItem" ADD COLUMN "canceladoEn" TIMESTAMP(3),
ADD COLUMN "canceladoPorId" TEXT;

ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
