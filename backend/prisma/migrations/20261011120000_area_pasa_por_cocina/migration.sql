-- Áreas que no pasan por cocina: el mozo saca el producto él mismo (bebidas).
ALTER TABLE "Area" ADD COLUMN "pasaPorCocina" BOOLEAN NOT NULL DEFAULT true;

-- Las bebidas salen de la refrigeradora, no de la cocina
UPDATE "Area" SET "pasaPorCocina" = false WHERE lower("nombre") = 'bebidas';

-- Cada item guarda su copia (los pedidos en curso siguen como estaban) y
-- cuándo se entregó
ALTER TABLE "PedidoItem" ADD COLUMN "pasaPorCocina" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "entregadoEn" TIMESTAMP(3);
