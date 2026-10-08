import { z } from "zod";
import { esquemaTelefono } from "../../lib/telefono.js";

export const esquemaBuscarCliente = z.object({ telefono: esquemaTelefono });
