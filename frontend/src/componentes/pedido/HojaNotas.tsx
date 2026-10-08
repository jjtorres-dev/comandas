// Hoja de notas de un plato. La usan la app del mozo y el pedido por teléfono de /local.
import { CheckIcon, NotePencilIcon } from "@phosphor-icons/react";
import { type ReactNode, useId, useState } from "react";
import type { NotaRapida } from "../../lib/tipos";
import { useUltimo } from "../../lib/useUltimo";
import { type Linea, type NotasCombo, notasDeCombo, type NotasDePlato, platosDe, textosDe, TODO_EL_COMBO } from "../../mozo/lineas";
import { Boton } from "../Boton";
import { HojaInferior } from "../HojaInferior";

type PropsNotas = {
  linea: Linea | null;
  notasRapidas: NotaRapida[];
  alCerrar: () => void;
  alGuardar: (notas: string[], alcance: "todas" | "una", notasCombo?: NotasCombo) => void;
};

const SIN_NOTAS: NotasDePlato = { marcadas: [], libre: "", soloUno: false };

// Notas de un plato. El orden es el de la decisión: primero a cuántas unidades
// aplica (con 2 o más), en un combo a qué plato, y recién después qué nota.
// "Solo para 1" separa la línea y cocina las ve como líneas distintas.
export function HojaNotas({ linea, notasRapidas, alCerrar, alGuardar }: PropsNotas) {
  const [alcance, setAlcance] = useState<"todas" | "una">("todas");
  // Notas por plato del combo; un plato suelto usa solo la entrada TODO_EL_COMBO
  const [entradas, setEntradas] = useState<NotasCombo>({});
  // Combo: el plato que se está anotando. null = todavía no se eligió
  const [plato, setPlato] = useState<string | null>(null);
  const idLibre = useId();
  const rapidas = notasRapidas.map((n) => n.texto);

  // Al abrir, la hoja parte de las notas que la línea ya tiene
  const [previa, setPrevia] = useState(linea);
  if (linea !== previa) {
    setPrevia(linea);
    if (linea) {
      const esCombo = linea.componentes.length > 0;
      setAlcance("todas");
      setPlato(esCombo ? null : TODO_EL_COMBO);
      setEntradas(
        linea.notasCombo ?? {
          [TODO_EL_COMBO]: {
            marcadas: linea.notas.filter((n) => rapidas.includes(n)),
            libre: linea.notas.filter((n) => !rapidas.includes(n)).join(", "),
            soloUno: false,
          },
        },
      );
    }
  }

  const visible = useUltimo(linea);
  const cantidad = visible?.cantidad ?? 1;
  const platos = platosDe(visible?.componentes ?? []);
  const esCombo = platos.length > 0;
  const entrada = (plato && entradas[plato]) || SIN_NOTAS;
  const repetido = platos.find((p) => p.productoId === plato && p.veces > 1);
  const editar = (cambio: Partial<NotasDePlato>) => plato && setEntradas((e) => ({ ...e, [plato]: { ...(e[plato] ?? SIN_NOTAS), ...cambio } }));
  const alternar = (texto: string) =>
    editar({ marcadas: entrada.marcadas.includes(texto) ? entrada.marcadas.filter((t) => t !== texto) : [...entrada.marcadas, texto] });
  const conNotas = (clave: string) => textosDe(entradas[clave], rapidas).length > 0;

  function guardar() {
    if (esCombo) alGuardar(notasDeCombo(visible!.componentes, entradas, rapidas), alcance, entradas);
    else alGuardar(textosDe(entradas[TODO_EL_COMBO], rapidas), alcance);
  }

  return (
    <HojaInferior
      abierta={linea !== null}
      alCerrar={alCerrar}
      titulo={visible?.nombre ?? ""}
      detalle={cantidad > 1 ? `${cantidad} unidades` : undefined}
      pie={<Boton onClick={guardar}>Guardar nota</Boton>}
    >
      <div className="flex flex-col gap-5">
        {cantidad > 1 && (
          <DosOpciones
            pregunta={`¿Para los ${cantidad} o solo para 1?`}
            opciones={[`Para los ${cantidad}`, "Solo para 1"]}
            segunda={alcance === "una"}
            alElegir={(segunda) => setAlcance(segunda ? "una" : "todas")}
          />
        )}

        {esCombo && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-xl font-bold text-tinta">¿Para qué plato es la nota?</legend>
            <div className="flex flex-wrap gap-2.5">
              {[...platos.map((p) => ({ clave: p.productoId, texto: p.veces > 1 ? `${p.veces} ${p.nombre}` : p.nombre })), { clave: TODO_EL_COMBO, texto: "Todo el combo" }].map(
                ({ clave, texto }) => (
                  <Chip key={clave} marcado={plato === clave} alTocar={() => setPlato(clave)}>
                    {texto}
                    {conNotas(clave) && <NotePencilIcon aria-label="con nota" weight="fill" className="size-5 shrink-0" />}
                  </Chip>
                ),
              )}
            </div>
          </fieldset>
        )}

        {repetido && (
          <DosOpciones
            pregunta={`¿A los ${repetido.veces} ${repetido.nombre} o solo a 1?`}
            opciones={[`A los ${repetido.veces}`, "Solo a 1"]}
            segunda={entrada.soloUno}
            alElegir={(soloUno) => editar({ soloUno })}
          />
        )}

        {plato === null ? (
          <p className="rounded-control border-2 border-dashed border-borde-fuerte px-4 py-5 text-center text-lg text-texto-suave">
            Elige primero el plato del combo
          </p>
        ) : (
          <>
            {notasRapidas.length > 0 && (
              <ul aria-label="Notas rápidas" className="flex flex-wrap gap-2.5">
                {notasRapidas.map(({ id, texto }) => (
                  <li key={id}>
                    <Chip marcado={entrada.marcadas.includes(texto)} conCheck alTocar={() => alternar(texto)}>
                      {texto}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor={idLibre} className="text-lg font-bold text-marino">
                Otra indicación
              </label>
              <input
                id={idLibre}
                value={entrada.libre}
                onChange={(e) => editar({ libre: e.target.value })}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="done"
                placeholder="Ej.: poco arroz"
                className="h-14 w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 text-xl text-tinta placeholder:text-texto-suave focus:border-marino"
              />
            </div>
          </>
        )}
      </div>
    </HojaInferior>
  );
}

function Chip({ marcado, conCheck = false, alTocar, children }: { marcado: boolean; conCheck?: boolean; alTocar: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={marcado}
      onClick={alTocar}
      className={`presionable inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 text-left text-lg leading-tight font-bold ${
        marcado ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-superficie text-marino"
      }`}
    >
      {conCheck && marcado && <CheckIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />}
      {children}
    </button>
  );
}

// Una pregunta con dos respuestas, una siempre elegida: se ve de un vistazo cuál
function DosOpciones({
  pregunta,
  opciones,
  segunda,
  alElegir,
}: {
  pregunta: string;
  opciones: [string, string];
  segunda: boolean;
  alElegir: (segunda: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-xl font-bold text-tinta">{pregunta}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-control border-2 border-marino p-1">
        {opciones.map((texto, indice) => {
          const elegida = segunda === (indice === 1);
          return (
            <button
              key={texto}
              type="button"
              aria-pressed={elegida}
              onClick={() => alElegir(indice === 1)}
              className={`presionable inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-interior px-2 text-center text-lg leading-tight font-bold ${
                elegida ? "bg-marino text-white" : "text-marino"
              }`}
            >
              {elegida && <CheckIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />}
              {texto}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
