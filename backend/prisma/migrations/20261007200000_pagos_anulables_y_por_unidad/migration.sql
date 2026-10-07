-- Pagos anulables (nunca se borran), cobro por unidades y registro de correcciones
-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anuladoEn" TIMESTAMP(3),
ADD COLUMN     "anuladoPorId" TEXT,
ADD COLUMN     "grupoId" TEXT,
ADD COLUMN     "motivoAnulacion" TEXT,
ADD COLUMN     "unidades" JSONB;

-- Los pagos que ya existían: cada uno es su propio cobro
UPDATE "Pago" SET "grupoId" = "id";
ALTER TABLE "Pago" ALTER COLUMN "grupoId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "mesaLiberada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PagoCambio" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoCambio_pagoId_idx" ON "PagoCambio"("pagoId");

-- CreateIndex
CREATE INDEX "Pago_turnoCajaId_idx" ON "Pago"("turnoCajaId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCambio" ADD CONSTRAINT "PagoCambio_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCambio" ADD CONSTRAINT "PagoCambio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

