-- Cuándo se marcó LISTO cada item (null si todavía no lo está)
ALTER TABLE "PedidoItem" ADD COLUMN "listoEn" TIMESTAMP(3);

-- Los que ya estaban listos o entregados no tienen la hora real: se usa la de
-- su creación como aproximación, para que no queden sin dato
UPDATE "PedidoItem" SET "listoEn" = "creadoEn" WHERE "estado" IN ('LISTO', 'ENTREGADO');
