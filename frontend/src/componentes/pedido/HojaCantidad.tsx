// Teclado numérico para poner una cantidad de un toque ("6 cervezas"). Lo usan
// la carta y el resumen del mozo y el pedido por teléfono de /local.
import { BackspaceIcon, CheckIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { useCambio } from "../../lib/useCambio";
import { useUltimo } from "../../lib/useUltimo";
import { MAXIMO } from "../../mozo/lineas";
import { Boton } from "../Boton";
import { HojaInferior } from "../HojaInferior";

// Las cantidades que más se piden de golpe: la mesa de 2, 3 o 4, la media docena y la docena
const ATAJOS = [2, 3, 4, 6, 12];
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type De = { nombre: string; cantidad: number };

type Props = {
  // De qué se está poniendo la cantidad; null cierra la hoja
  de: De | null;
  alCerrar: () => void;
  // 0 quita el plato del pedido
  alGuardar: (cantidad: number) => void;
};

const TECLA =
  "presionable grid min-h-16 cursor-pointer place-items-center rounded-control border-2 border-borde-fuerte bg-superficie text-3xl font-bold text-tinta tabular-nums hover:bg-primario-suave";

export function HojaCantidad({ de, alCerrar, alGuardar }: Props) {
  const visible = useUltimo(de);
  const idAtajos = useId();
  // Lo que se va escribiendo. Vacío = todavía vale la cantidad que ya tenía
  const [texto, setTexto] = useState("");
  const [previo, setPrevio] = useState(de);
  if (de !== previo) {
    setPrevio(de);
    if (de) setTexto("");
  }

  const actual = visible?.cantidad ?? 1;
  const cantidad = texto === "" ? actual : Number(texto);
  const cambio = useCambio(texto);

  // Dos cifras como máximo: el tope es 99
  const escribir = (cifra: string) => setTexto((t) => (t === "0" ? cifra : t.length >= String(MAXIMO).length ? t : t + cifra));
  const borrar = () => setTexto((t) => t.slice(0, -1));

  // En la PC del local se escribe con el teclado de verdad
  const abierta = de !== null;
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (/^\d$/.test(evento.key)) escribir(evento.key);
      else if (evento.key === "Backspace") borrar();
      else if (evento.key === "Enter") alGuardar(cantidad);
      else return;
      // Enter no debe además activar el botón que tenga el foco
      evento.preventDefault();
    };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [abierta, cantidad, alGuardar]);

  return (
    <HojaInferior
      abierta={abierta}
      alCerrar={alCerrar}
      titulo={visible?.nombre ?? ""}
      detalle="¿Cuántos?"
      pie={
        cantidad === 0 ? (
          <Boton variante="peligro" className="min-h-16" onClick={() => alGuardar(0)} icono={<TrashIcon aria-hidden="true" weight="bold" className="size-6" />}>
            Quitar del pedido
          </Boton>
        ) : (
          <Boton className="min-h-16" onClick={() => alGuardar(cantidad)} icono={<CheckIcon aria-hidden="true" weight="bold" className="size-6" />}>
            Poner {cantidad}
          </Boton>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="flex items-baseline justify-center gap-3 text-tinta">
          <span className="sr-only">Cantidad: </span>
          {/* La clave reinicia el pulso con cada cifra */}
          <span key={texto} className={`text-6xl leading-none font-bold tabular-nums ${cambio ? "animate-pulso" : ""} ${texto === "" ? "text-texto-suave" : ""}`}>
            {cantidad}
          </span>
        </p>

        <p id={idAtajos} className="-mb-2 text-lg font-bold text-marino">
          De un toque
        </p>
        <ul aria-labelledby={idAtajos} className="grid grid-cols-5 gap-2">
          {ATAJOS.map((atajo) => (
            <li key={atajo}>
              <button
                type="button"
                onClick={() => alGuardar(atajo)}
                aria-label={`Poner ${atajo}`}
                className="presionable grid min-h-14 w-full cursor-pointer place-items-center rounded-control bg-marino text-2xl font-bold text-white tabular-nums"
              >
                {atajo}
              </button>
            </li>
          ))}
        </ul>

        <p aria-hidden="true" className="-mb-2 text-lg font-bold text-marino">
          U otra cantidad
        </p>
        <div role="group" aria-label="Teclado numérico" className="grid grid-cols-3 gap-2">
          {TECLAS.map((cifra) => (
            <button key={cifra} type="button" onClick={() => escribir(cifra)} className={TECLA}>
              {cifra}
            </button>
          ))}
          <span aria-hidden="true" />
          <button type="button" onClick={() => escribir("0")} className={TECLA}>
            0
          </button>
          <button type="button" onClick={borrar} disabled={texto === ""} aria-label="Borrar" className={`${TECLA} disabled:cursor-not-allowed disabled:opacity-40`}>
            <BackspaceIcon aria-hidden="true" weight="bold" className="size-8" />
          </button>
        </div>
      </div>
    </HojaInferior>
  );
}

// La cantidad de una línea: el número sobre marino es el que se toca para
// escribirla con el teclado
export function BotonCantidad({ cantidad, de, className = "", ...resto }: { cantidad: number; de: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cambio = useCambio(cantidad);
  return (
    <button
      type="button"
      aria-label={`Cantidad de ${de}: ${cantidad}. Cambiar`}
      {...resto}
      className={`presionable grid h-12 cursor-pointer place-items-center rounded-interior bg-marino px-2 text-2xl leading-none font-bold text-white tabular-nums ${className || "min-w-12"}`}
    >
      {/* La clave reinicia el pulso: confirma que el toque entró */}
      <span key={cantidad} className={cambio ? "animate-pulso" : ""}>
        {cantidad}
      </span>
    </button>
  );
}
