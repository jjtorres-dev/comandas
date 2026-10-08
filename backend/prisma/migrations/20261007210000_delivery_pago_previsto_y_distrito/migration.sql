-- Delivery: pago previsto, distrito de entrega, distritos y región del negocio, motivo de cancelación
-- CreateEnum
CREATE TYPE "MomentoPago" AS ENUM ('ANTICIPADO', 'AL_RECIBIR');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "distrito" TEXT;

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "distritos" TEXT[],
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "distritoEntrega" TEXT,
ADD COLUMN     "motivoCancelacion" TEXT,
ADD COLUMN     "pagaCon" DECIMAL(10,2),
ADD COLUMN     "pagoMetodo" "MetodoPago",
ADD COLUMN     "pagoMomento" "MomentoPago";

