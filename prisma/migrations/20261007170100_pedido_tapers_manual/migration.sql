-- Pedido.tapersManual: la cantidad de tapers se fijó a mano y ya no se recalcula
ALTER TABLE "Pedido" ADD COLUMN "tapersManual" BOOLEAN NOT NULL DEFAULT false;
