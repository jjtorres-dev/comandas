import { useState } from "react";
import { Boton } from "../../../componentes/Boton";
import { Campo } from "../../../componentes/Campo";
import { Dialogo } from "../../../componentes/Dialogo";
import { api, mensajeDe } from "../../../lib/api";
import { claves, clienteDeConsultas } from "../../../lib/consultas";
import type { Cuenta, Pedido } from "../../../lib/tipos";
import { centimos, leerMonto, paraApi, soles } from "../../../local/dinero";

type Props = { abierto: boolean; alCerrar: () => void; pedido: Pedido; cuenta: Cuenta; alGuardar: (total: string) => void };

const sinCeros = (monto: string) => String(Number(monto));

// Ajustes antes de cobrar: tapers, envío y descuento, con el total a la vista
export function Ajustar({ abierto, alCerrar, pedido, cuenta, alGuardar }: Props) {
  const conTapers = pedido.tipo !== "MESA";
  const conEnvio = pedido.tipo === "DELIVERY";
  const [tapers, setTapers] = useState(String(cuenta.cantidadTapers));
  // Automático = el servidor los calcula según los platos
  const [tapersAuto, setTapersAuto] = useState(!pedido.tapersManual);
  const [envio, setEnvio] = useState(sinCeros(cuenta.costoEnvio));
  const [descuento, setDescuento] = useState(sinCeros(cuenta.descuento));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, parte de lo que el pedido tiene ahora
  const [previo, setPrevio] = useState(abierto);
  if (abierto !== previo) {
    setPrevio(abierto);
    if (abierto) {
      setTapers(String(cuenta.cantidadTapers));
      setTapersAuto(!pedido.tapersManual);
      setEnvio(sinCeros(cuenta.costoEnvio));
      setDescuento(sinCeros(cuenta.descuento));
      setError(null);
    }
  }

  // Vista previa del total. El precio de un taper se deduce de la cuenta; si
  // no hay ninguno todavía, el total exacto llega al guardar.
  const precioTaper = cuenta.cantidadTapers > 0 ? centimos(cuenta.cargoTapers) / cuenta.cantidadTapers : null;
  const nTapers = Number(tapers);
  const cEnvio = conEnvio ? leerMonto(envio || "0") : centimos(cuenta.costoEnvio);
  const cDescuento = leerMonto(descuento || "0");
  const tapersValidos = !conTapers || tapersAuto || (/^\d{1,3}$/.test(tapers.trim()) && nTapers <= 200);
  const cTapers = !conTapers || tapersAuto ? centimos(cuenta.cargoTapers) : precioTaper !== null ? Math.round(precioTaper * nTapers) : null;
  const valido = tapersValidos && cEnvio !== null && cDescuento !== null;
  const total = valido && cTapers !== null ? centimos(cuenta.subtotal) + cEnvio + cTapers - cDescuento : null;

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      const { pedido: actualizado } = await api<{ pedido: Pedido }>(`/pedidos/${pedido.id}/cargos`, {
        metodo: "PATCH",
        cuerpo: {
          descuento: paraApi(cDescuento),
          ...(conEnvio ? { costoEnvio: paraApi(cEnvio) } : {}),
          ...(conTapers ? { cantidadTapers: tapersAuto ? null : nTapers } : {}),
        },
      });
      void clienteDeConsultas.invalidateQueries({ queryKey: claves.pedidos });
      alGuardar(actualizado.total);
      alCerrar();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`Ajustar el pedido #${pedido.numero}`}
      pie={
        <Boton ocupado={guardando} disabled={!valido} onClick={() => void guardar()}>
          Guardar ajustes
        </Boton>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {conTapers && (
          <div className="flex flex-col gap-2">
            <Campo
              etiqueta="Tapers"
              name="tapers"
              inputMode="numeric"
              autoComplete="off"
              disabled={tapersAuto}
              value={tapers}
              onChange={(e) => setTapers(e.target.value)}
              error={tapersValidos ? null : "Escribe un número entre 0 y 200"}
            />
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-bold text-marino">
              <input type="checkbox" checked={tapersAuto} onChange={(e) => setTapersAuto(e.target.checked)} className="size-6 accent-(--color-marino)" />
              Calcularlos solos, según los platos
            </label>
          </div>
        )}
        {conEnvio && (
          <Campo
            etiqueta="Costo de envío (S/)"
            name="envio"
            inputMode="decimal"
            autoComplete="off"
            value={envio}
            onChange={(e) => setEnvio(e.target.value)}
            error={cEnvio === null ? "Escribe un monto, por ejemplo 3 o 3.50" : null}
          />
        )}
        <Campo
          etiqueta="Descuento (S/)"
          name="descuento"
          inputMode="decimal"
          autoComplete="off"
          value={descuento}
          onChange={(e) => setDescuento(e.target.value)}
          error={cDescuento === null ? "Escribe un monto, por ejemplo 5" : null}
        />
        <p aria-live="polite" className="flex items-baseline justify-between gap-3 rounded-control bg-fondo px-4 py-3 text-tinta">
          <span className="text-2xl font-bold">Total</span>
          <span className="text-4xl font-bold tabular-nums">{total !== null ? soles(Math.max(0, total)) : "Se calcula al guardar"}</span>
        </p>
        {error && (
          <p role="alert" className="text-lg font-bold text-peligro">
            {error}
          </p>
        )}
        {/* Enter en un campo guarda */}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  );
}
