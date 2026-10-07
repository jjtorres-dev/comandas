-- Pedido: copia del nombre y teléfono del cliente (delivery y para llevar)
ALTER TABLE "Pedido" ADD COLUMN "nombreCliente" TEXT,
ADD COLUMN "telefonoCliente" TEXT;
