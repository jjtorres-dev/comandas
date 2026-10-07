import { z } from "zod";
import { esquemaTelefono } from "../../lib/telefono";

export const esquemaBuscarCliente = z.object({ telefono: esquemaTelefono });
