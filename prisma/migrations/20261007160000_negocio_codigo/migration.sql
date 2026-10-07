-- Negocio.codigo: identifica al negocio en el login.
-- Se agrega en tres pasos porque la tabla ya tiene filas.
ALTER TABLE "Negocio" ADD COLUMN "codigo" TEXT;

UPDATE "Negocio"
SET "codigo" = CASE WHEN "nombre" = 'Cevichería Valentina' THEN 'valentina' ELSE "id" END;

ALTER TABLE "Negocio" ALTER COLUMN "codigo" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_codigo_key" ON "Negocio"("codigo");
