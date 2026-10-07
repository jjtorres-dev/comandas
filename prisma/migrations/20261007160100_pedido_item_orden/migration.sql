-- PedidoItem.orden: posición del item en la comanda
ALTER TABLE "PedidoItem" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
