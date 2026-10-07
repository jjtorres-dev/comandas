-- Producto.tapers: tapers que ocupa una unidad del producto al despacharla
ALTER TABLE "Producto" ADD COLUMN "tapers" INTEGER NOT NULL DEFAULT 1;

-- Productos existentes: se conserva la regla anterior (solo el área "Cocina"
-- llevaba taper) y los combos pasan a ocupar un taper por plato
UPDATE "Producto" p
SET "tapers" = 0
FROM "Area" a
WHERE a."id" = p."areaId" AND lower(trim(a."nombre")) <> 'cocina';

UPDATE "Producto"
SET "tapers" = "comboCantidad"
WHERE "esCombo" AND "comboCantidad" IS NOT NULL AND "tapers" <> 0;
