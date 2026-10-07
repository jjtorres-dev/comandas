import cors from "cors";
import express from "express";
import { z } from "zod";
import { opcionesCors } from "./config/cors";
import { env } from "./config/env";
import { manejarErrores, rutaNoEncontrada } from "./middlewares/errores";
import { rutasAuth } from "./modules/auth/auth.routes";
import { rutasCaja } from "./modules/caja/caja.routes";
import { rutasCarta } from "./modules/carta/carta.routes";
import { rutasClientes } from "./modules/clientes/clientes.routes";
import { rutasMesas } from "./modules/mesas/mesas.routes";
import { rutasPagos } from "./modules/pagos/pagos.routes";
import { rutasPedidos } from "./modules/pedidos/pedidos.routes";
import { rutasRepartidores } from "./modules/repartidores/repartidores.routes";

// Mensajes de validación en español
z.config(z.locales.es());

export const app = express();

app.disable("x-powered-by");
// Detrás de un proxy (Railway), req.ip debe ser la del cliente y no la del proxy
if (env.TRUST_PROXY !== undefined) app.set("trust proxy", env.TRUST_PROXY);
app.use(cors(opcionesCors));
app.use(express.json({ limit: "100kb" }));

app.get("/api/salud", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", rutasAuth);
app.use("/api/carta", rutasCarta);
app.use("/api/mesas", rutasMesas);
app.use("/api/clientes", rutasClientes);
app.use("/api/repartidores", rutasRepartidores);
app.use("/api/caja", rutasCaja);
// Cuenta, pagos y nota de venta cuelgan de /api/pedidos/:id
app.use("/api/pedidos", rutasPedidos, rutasPagos);

app.use(rutaNoEncontrada);
app.use(manejarErrores);
