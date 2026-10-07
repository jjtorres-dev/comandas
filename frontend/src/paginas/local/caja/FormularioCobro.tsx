import { CheckIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { MetodoPago } from "../../../lib/tipos";
import { leerMonto, METODOS, paraApi, soles } from "../../../local/dinero";

export type PagoAEnviar = { metodo: MetodoPago; monto: number; recibido?: number; referencia?: string };

type Linea = { id: number; metodo: MetodoPago | null; monto: string; recibido: string; referencia: string };

type Props = {
  // Lo que se cobra ahora, en céntimos (el saldo, los platos marcados o una parte)
  objetivo: number;
  // Por qué no se puede cobrar todavía (sin conexión, nada marcado…), o null
  bloqueo: string | null;
  alCobrar: (pagos: PagoAEnviar[]) => Promise<void>;
};

const ATAJOS = [50, 100, 200];
const sinPunto = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, "");

// El cobro en sí: método (ninguno viene elegido), monto recibido con el vuelto
// enorme, y pago mixto. Teclado: E, Y, P, T eligen método y Enter cobra.
export function FormularioCobro({ objetivo, bloqueo, alCobrar }: Props) {
  const serie = useRef(1);
  const [lineas, setLineas] = useState<Linea[]>([{ id: 0, metodo: null, monto: sinPunto(objetivo), recibido: "", referencia: "" }]);
  // La línea sobre la que actúan las teclas de método
  const [activa, setActiva] = useState(0);
  const [cobrando, setCobrando] = useState(false);
  const recibidos = useRef(new Map<number, HTMLInputElement>());
  const primerMonto = useRef<HTMLInputElement>(null);
  const conPuntero = useRef(false);
  const idBase = useId();
  const mixto = lineas.length > 1;

  // Si cambia lo que se cobra (se marcan más platos), el método ya elegido se
  // conserva; un pago repartido vuelve a una sola línea, porque sus montos ya no valen
  const [previo, setPrevio] = useState(objetivo);
  if (objetivo !== previo) {
    setPrevio(objetivo);
    setLineas((ls) => [{ ...ls[0], monto: sinPunto(objetivo), recibido: "" }]);
    setActiva(lineas[0].id);
  }

  const editar = (id: number, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...cambio } : l)));

  function elegirMetodo(id: number, metodo: MetodoPago) {
    editar(id, { metodo, ...(metodo === "EFECTIVO" ? {} : { recibido: "" }) });
    setActiva(id);
    // En efectivo lo siguiente es escribir con cuánto paga
    if (metodo === "EFECTIVO") requestAnimationFrame(() => recibidos.current.get(id)?.focus());
  }

  // Al cambiar un monto, otra línea absorbe la diferencia: siempre suman lo que se cobra
  function cambiarMonto(id: number, texto: string) {
    setLineas((ls) => {
      const escrito = leerMonto(texto);
      const otra = [...ls].reverse().find((l) => l.id !== id);
      if (escrito === null || !otra) return ls.map((l) => (l.id === id ? { ...l, monto: texto } : l));
      const resto = objetivo - escrito - ls.filter((l) => l.id !== id && l.id !== otra.id).reduce((s, l) => s + (leerMonto(l.monto) ?? 0), 0);
      return ls.map((l) => (l.id === id ? { ...l, monto: texto } : l.id === otra.id ? { ...l, monto: resto > 0 ? sinPunto(resto) : "0" } : l));
    });
  }

  function agregarLinea() {
    const id = serie.current++;
    setLineas((ls) => {
      const usado = ls.reduce((s, l) => s + (leerMonto(l.monto) ?? 0), 0);
      const libre = Math.max(0, objetivo - usado);
      // La primera vez no hay nada libre: la nueva línea parte de cero y se reparte al escribir
      return [...ls, { id, metodo: null, monto: sinPunto(libre), recibido: "", referencia: "" }];
    });
    // Lo siguiente es decir cuánto va en el primer pago: el otro se ajusta solo
    if (lineas.length === 1) {
      setActiva(lineas[0].id);
      requestAnimationFrame(() => primerMonto.current?.select());
    } else {
      setActiva(id);
    }
  }

  const quitarLinea = (id: number) => {
    // Las teclas de método siguen actuando sobre un pago que existe
    setActiva(lineas.find((l) => l.id !== id)!.id);
    setLineas((ls) => {
      const quedan = ls.filter((l) => l.id !== id);
      // Si queda una sola, vuelve a cobrar todo
      return quedan.length === 1 ? [{ ...quedan[0], monto: sinPunto(objetivo) }] : quedan;
    });
  };

  const plegada = (linea: Linea) => mixto && linea.id !== activa && linea.metodo !== null;

  // ---------- Validación ----------
  const montos = lineas.map((l) => leerMonto(l.monto));
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  let falta: string | null = bloqueo;
  if (!falta && lineas.some((l) => l.metodo === null)) falta = mixto ? "Elige el método de cada parte" : "Elige cómo paga";
  if (!falta && montos.some((m) => m === null || m <= 0)) falta = "Revisa los montos";
  if (!falta && suma !== objetivo) falta = suma < objetivo ? `Faltan ${soles(objetivo - suma)} por repartir` : `Sobran ${soles(suma - objetivo)}`;

  const efectivos = lineas.filter((l) => l.metodo === "EFECTIVO");
  let vuelto = 0;
  // El vuelto solo se muestra cuando se sabe: con lo recibido escrito y suficiente
  let vueltoSabido = efectivos.length > 0;
  let faltaEfectivo = 0;
  for (const linea of efectivos) {
    const monto = leerMonto(linea.monto) ?? 0;
    if (linea.recibido.trim() === "") {
      vueltoSabido = false;
      continue;
    }
    const recibido = leerMonto(linea.recibido);
    if (recibido === null) {
      vueltoSabido = false;
      falta ??= "Revisa lo recibido";
    } else if (recibido < monto) {
      vueltoSabido = false;
      faltaEfectivo += monto - recibido;
      falta ??= `Faltan ${soles(monto - recibido)} en efectivo`;
    } else {
      vuelto += recibido - monto;
    }
  }
  if (falta) vueltoSabido = false;

  async function cobrar() {
    if (falta || cobrando) return;
    setCobrando(true);
    try {
      await alCobrar(
        lineas.map((l) => {
          const recibido = l.metodo === "EFECTIVO" && l.recibido.trim() ? leerMonto(l.recibido) : null;
          return {
            metodo: l.metodo!,
            monto: paraApi(leerMonto(l.monto)!),
            ...(recibido !== null ? { recibido: paraApi(recibido) } : {}),
            ...(l.referencia.trim() ? { referencia: l.referencia.trim() } : {}),
          };
        }),
      );
    } finally {
      setCobrando(false);
    }
  }

  // ---------- Teclado ----------
  const accion = useRef({ cobrar, elegirMetodo, activa });
  useEffect(() => {
    accion.current = { cobrar, elegirMetodo, activa };
  });
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      // Una tecla mantenida no cobra dos veces ni se salta la pantalla del vuelto
      if (evento.repeat || evento.ctrlKey || evento.metaKey || evento.altKey || document.querySelector("dialog[open]")) return;
      const destino = evento.target as HTMLElement;
      const escribiendoTexto = destino.matches("textarea, input") && !destino.hasAttribute("data-monto");
      if (evento.key === "Enter") {
        // En un botón, Enter es de ese botón
        if (destino.matches("button, a, summary")) return;
        evento.preventDefault();
        void accion.current.cobrar();
        return;
      }
      // Las letras no actúan mientras se escribe texto (n.º de operación, teléfono)
      if (escribiendoTexto) return;
      const metodo = METODOS.find((m) => m.tecla === evento.key.toUpperCase());
      if (!metodo) return;
      evento.preventDefault();
      accion.current.elegirMetodo(accion.current.activa, metodo.id);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {lineas.map((linea, indice) => {
        const monto = leerMonto(linea.monto) ?? 0;
        return (
          <fieldset
            key={linea.id}
            // Con el mouse, el pago pasa a ser el activo al terminar el clic y no al
            // recibir el foco: si el otro pago se plegara a medio clic, el botón se
            // movería bajo el puntero y el clic se perdería
            onPointerDown={() => (conPuntero.current = true)}
            onFocus={() => !conPuntero.current && setActiva(linea.id)}
            onClick={() => {
              conPuntero.current = false;
              setActiva(linea.id);
            }}
            className={mixto ? `flex flex-col gap-3 rounded-control border-2 p-3 ${linea.id === activa ? "border-marino" : "border-borde"}` : "flex flex-col gap-3"}
          >
            <legend className="sr-only">{mixto ? `Pago ${indice + 1}` : "Cómo paga"}</legend>
            {mixto && (
              <div className="flex items-center gap-3">
                <label htmlFor={`${idBase}-monto-${linea.id}`} className="text-xl font-bold text-tinta">
                  Pago {indice + 1}
                </label>
                <input
                  id={`${idBase}-monto-${linea.id}`}
                  ref={indice === 0 ? primerMonto : undefined}
                  data-monto
                  inputMode="decimal"
                  autoComplete="off"
                  value={linea.monto}
                  onChange={(e) => cambiarMonto(linea.id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="h-14 w-36 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-right text-2xl font-bold text-tinta tabular-nums focus:border-marino"
                />
                <button
                  type="button"
                  onClick={() => quitarLinea(linea.id)}
                  aria-label={`Quitar el pago ${indice + 1}`}
                  className="presionable ml-auto grid size-12 cursor-pointer place-items-center rounded-control text-marino hover:bg-primario-suave"
                >
                  <TrashIcon aria-hidden="true" weight="bold" className="size-6" />
                </button>
              </div>
            )}

            {/* En un pago repartido solo se despliega el pago en el que se está: los
                demás quedan en una línea, y el vuelto y Cobrar siguen a la vista */}
            {plegada(linea) && (
              <button
                type="button"
                onClick={() => setActiva(linea.id)}
                className="presionable flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 border-borde-fuerte px-3 text-left text-xl font-bold text-tinta hover:bg-primario-suave"
              >
                <CheckIcon aria-hidden="true" weight="bold" className="size-6 shrink-0 text-listo-fuerte" />
                <span className="min-w-0 flex-1">
                  {METODOS.find((m) => m.id === linea.metodo)!.nombre}
                  {linea.metodo === "EFECTIVO" && linea.recibido.trim() ? `, recibe ${linea.recibido.trim()}` : ""}
                </span>
                <span className="text-lg font-bold text-marino underline decoration-2 underline-offset-4">Cambiar</span>
              </button>
            )}

            <div className={plegada(linea) ? "hidden" : "grid grid-cols-2 gap-2.5"}>
              {METODOS.map((metodo) => {
                const elegido = linea.metodo === metodo.id;
                return (
                  <button
                    key={metodo.id}
                    type="button"
                    aria-pressed={elegido}
                    aria-keyshortcuts={metodo.tecla}
                    onClick={() => elegirMetodo(linea.id, metodo.id)}
                    className={`presionable flex min-h-16 cursor-pointer items-center gap-3 rounded-control border-2 px-3 text-2xl font-bold ${
                      elegido ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"
                    }`}
                  >
                    {/* La tecla que lo elige, a la vista */}
                    <kbd aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-interior border-2 border-current font-sans text-lg">
                      {metodo.tecla}
                    </kbd>
                    <span className="min-w-0 flex-1 truncate text-left">{metodo.nombre}</span>
                    {elegido && <CheckIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {linea.metodo === "EFECTIVO" && !plegada(linea) && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <label htmlFor={`${idBase}-recibido-${linea.id}`} className="flex-1 text-xl font-bold text-tinta">
                    Recibido
                  </label>
                  <input
                    id={`${idBase}-recibido-${linea.id}`}
                    ref={(nodo) => {
                      if (nodo) recibidos.current.set(linea.id, nodo);
                      else recibidos.current.delete(linea.id);
                    }}
                    data-monto
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={sinPunto(monto)}
                    value={linea.recibido}
                    onChange={(e) => editar(linea.id, { recibido: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="h-16 w-44 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-right text-3xl font-bold text-tinta tabular-nums placeholder:text-texto-suave focus:border-marino"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => editar(linea.id, { recibido: sinPunto(monto) })} className={ATAJO}>
                    Exacto
                  </button>
                  {ATAJOS.map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      disabled={billete * 100 < monto}
                      onClick={() => editar(linea.id, { recibido: String(billete) })}
                      className={ATAJO}
                    >
                      S/ {billete}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(linea.metodo === "YAPE" || linea.metodo === "PLIN") && !plegada(linea) && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${idBase}-ref-${linea.id}`} className="text-lg font-bold text-marino">
                  N.º de operación (opcional)
                </label>
                <input
                  id={`${idBase}-ref-${linea.id}`}
                  autoComplete="off"
                  maxLength={100}
                  value={linea.referencia}
                  onChange={(e) => editar(linea.id, { referencia: e.target.value })}
                  className="h-14 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-xl text-tinta focus:border-marino"
                />
              </div>
            )}
          </fieldset>
        );
      })}

      {lineas.length < 3 && (
        <button
          type="button"
          onClick={agregarLinea}
          className="presionable inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-control px-2 text-lg font-bold text-marino underline decoration-2 underline-offset-4 hover:bg-primario-suave"
        >
          <PlusIcon aria-hidden="true" weight="bold" className="size-5" />
          Agregar otro método
        </button>
      )}

      {/* El vuelto y Cobrar quedan pegados al borde de abajo de la pantalla (sobre la
          franja de caja): con un pago repartido el panel crece, y no se cobra a ciegas */}
      <div className="sticky bottom-20 z-10 -mx-4 -mb-4 flex flex-col gap-3 rounded-b-panel bg-superficie px-4 pt-3 pb-4">
      {/* El vuelto es el número que no puede salir mal: solo aparece cuando se
            sabe. Mientras falte plata, la misma caja lo dice en rojo. */}
        {efectivos.length > 0 && (
          <p
            aria-live="polite"
            className={`flex items-baseline justify-between gap-3 rounded-control px-4 py-3 whitespace-nowrap ${
              faltaEfectivo > 0 ? "bg-peligro-suave text-peligro" : vueltoSabido ? "bg-listo-suave text-tinta" : "bg-fondo text-tinta"
            }`}
          >
            <span className="text-2xl font-bold">{faltaEfectivo > 0 ? "Faltan" : "Vuelto"}</span>
            <span className="text-5xl leading-none font-bold tabular-nums xl:text-6xl">
              {faltaEfectivo > 0 ? soles(faltaEfectivo) : vueltoSabido ? soles(vuelto) : "—"}
            </span>
          </p>
        )}

        <button
          type="button"
          disabled={falta !== null || cobrando}
          aria-busy={cobrando || undefined}
          onClick={() => void cobrar()}
          className="presionable inline-flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-control bg-primario px-6 text-3xl font-bold text-tinta hover:bg-primario-presionado disabled:cursor-not-allowed disabled:border-2 disabled:border-borde-fuerte disabled:bg-fondo disabled:text-marino"
        >
          Cobrar {soles(objetivo)}
        </button>
        <p aria-live="polite" className="min-h-7 text-center text-lg font-bold text-marino">
          {falta ?? "Enter para cobrar"}
        </p>
      </div>
    </div>
  );
}

const ATAJO =
  "presionable min-h-12 cursor-pointer rounded-control border-2 border-marino bg-superficie px-1 text-lg font-bold text-marino tabular-nums hover:bg-primario-suave disabled:cursor-not-allowed disabled:border-borde disabled:text-texto-suave";
