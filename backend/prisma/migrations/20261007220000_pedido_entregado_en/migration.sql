-- Cuándo quedó entregado cada pedido, para poder deshacer una entrega
ALTER TABLE "Pedido" ADD COLUMN "entregadoEn" TIMESTAMP(3);

-- Los ya entregados no tienen la hora real: se usa la de su último plato listo
-- (o la de creación), para que no queden sin dato
UPDATE "Pedido" p
SET "entregadoEn" = COALESCE((SELECT MAX(i."listoEn") FROM "PedidoItem" i WHERE i."pedidoId" = p."id"), p."creadoEn")
WHERE p."estado" = 'ENTREGADO';

-- Un pedido cancelado no debe nada: ni envío, ni tapers, ni descuento
UPDATE "Pedido"
SET "costoEnvio" = 0, "cantidadTapers" = 0, "cargoTapers" = 0, "descuento" = 0, "total" = 0
WHERE "estado" = 'CANCELADO';
