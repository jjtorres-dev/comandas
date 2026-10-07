import { CheckIcon, CopyIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Campo } from "../../../componentes/Campo";
import { api, mensajeDe } from "../../../lib/api";
import { claves } from "../../../lib/consultas";

type Nota = { texto: string; whatsappUrl: string | null };

const BOTON =
  "presionable inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-control border-2 border-marino bg-superficie px-4 text-xl font-bold whitespace-nowrap text-marino hover:bg-primario-suave disabled:cursor-not-allowed disabled:opacity-60";

// Celular peruano: 9 dígitos que empiezan con 9, con o sin el 51 delante
const celular = (telefono: string): string | null => {
  const digitos = telefono.replace(/\D/g, "").replace(/^51(?=\d{9}$)/, "");
  return /^9\d{8}$/.test(digitos) ? digitos : null;
};

// wa.me necesita el número con prefijo de país
const paraWhatsapp = (numero: string, texto: string) => `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`;

// Nota de venta de un pedido: enviarla por WhatsApp o copiar su texto. Si el
// pedido no tiene teléfono, lo pide aquí; ese número solo abre el chat, no se guarda.
export function NotaDeVenta({ pedidoId }: { pedidoId: string }) {
  // Cuelga de claves.pedidos: si el pedido cambia (se corrige un pago), la nota se vuelve a pedir
  const nota = useQuery({
    queryKey: [...claves.pedidos, "nota-venta", pedidoId],
    queryFn: ({ signal }) => api<Nota>(`/pedidos/${pedidoId}/nota-venta`, { signal }),
  });
  const [pidiendoTelefono, setPidiendoTelefono] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [error] = useState<string | null>(null);

  const numero = celular(telefono);
  const telefonoValido = numero !== null;
  // Si el navegador no deja copiar (pasa fuera de https), el texto se muestra para copiarlo a mano
  const [aMano, setAMano] = useState(false);

  async function copiar() {
    if (!nota.data) return;
    try {
      await navigator.clipboard.writeText(nota.data.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setAMano(true);
    }
  }

  function enviar() {
    if (!nota.data) return;
    if (nota.data.whatsappUrl) return void window.open(nota.data.whatsappUrl, "_blank", "noopener");
    if (!pidiendoTelefono) return setPidiendoTelefono(true);
    if (numero) window.open(paraWhatsapp(numero, nota.data.texto), "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-3">
      {pidiendoTelefono && !nota.data?.whatsappUrl && (
        <Campo
          etiqueta="WhatsApp del cliente"
          ayuda="Solo se usa para abrir el chat; no se guarda en el pedido."
          name="telefono"
          inputMode="tel"
          autoComplete="off"
          autoFocus
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter aquí envía la nota, no pasa al siguiente pedido
            e.stopPropagation();
            enviar();
          }}
          placeholder="987 654 321"
          error={telefono.trim().length >= 9 && !telefonoValido ? "Un celular tiene 9 dígitos y empieza con 9" : null}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={enviar} disabled={!nota.data || (pidiendoTelefono && !nota.data.whatsappUrl && !telefonoValido)} className={BOTON}>
          <WhatsappLogoIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />
          Enviar por WhatsApp
        </button>
        <button type="button" onClick={() => void copiar()} disabled={!nota.data} className={BOTON}>
          {copiado ? <CheckIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" /> : <CopyIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />}
          <span aria-live="polite">{copiado ? "Copiado" : "Copiar texto"}</span>
        </button>
      </div>
      {aMano && nota.data && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`nota-${pedidoId}`} className="text-lg font-bold text-marino">
            Este navegador no dejó copiar. Selecciona el texto y cópialo:
          </label>
          <textarea
            id={`nota-${pedidoId}`}
            readOnly
            rows={8}
            value={nota.data.texto}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-control border-2 border-borde-fuerte bg-superficie px-3 py-2 text-lg text-tinta focus:border-marino"
          />
        </div>
      )}
      {(error || nota.isError) && (
        <p role="alert" className="text-lg font-bold text-peligro">
          {error ?? mensajeDe(nota.error)}
        </p>
      )}
    </div>
  );
}
