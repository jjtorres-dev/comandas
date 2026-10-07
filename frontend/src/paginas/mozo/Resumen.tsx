import { useEspacioAvisos } from "../../lib/useEspacioAvisos";
import { CheckIcon, CloudArrowUpIcon, MinusIcon, NotePencilIcon, PaperPlaneRightIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Boton } from "../../componentes/Boton";
import { CabeceraPantalla } from "../../componentes/CabeceraPantalla";
import { Campo } from "../../componentes/Campo";
import { HojaInferior } from "../../componentes/HojaInferior";
import { consultaCarta } from "../../lib/consultas";
import { platosDeCombo, plural, soles } from "../../lib/formato";
import { useUltimo } from "../../lib/useUltimo";
import type { NotaRapida } from "../../lib/tipos";
import { editarBorrador, enviar, leerBorrador, useMozo } from "../../mozo/almacen";
import { FranjaCola } from "../../mozo/FranjaCola";
import {
  agregar,
  cambiarCantidad,
  cantidadTotal,
  type Linea,
  montoTotal,
  type NotasCombo,
  notasDeCombo,
  type NotasDePlato,
  platosDe,
  ponerNotas,
  textosDe,
  TODO_EL_COMBO,
} from "../../mozo/lineas";
import { usePedidoEnCurso } from "../../mozo/usePedidoEnCurso";
import { useConexion } from "../../tiempo-real/contexto";
import { PantallaSinDestino } from "./TomarPedido";

export function Resumen() {
  const { clave = "" } = useParams();
  const navegar = useNavigate();
  const enCurso = usePedidoEnCurso(clave);
  const { data: carta } = useQuery(consultaCarta);
  const [conNotas, setConNotas] = useState<Linea | null>(null);
  const [enviado, setEnviado] = useState(false);
  const idNota = useId();
  const barraAvisos = useEspacioAvisos();
  const enLinea = useConexion() === "en-linea";
  const abierto = useMozo().usuarioId !== null;

  const { destino, borrador, pedidoId } = enCurso;
  const esRonda = pedidoId !== null;

  // La confirmación se ve un instante y la pantalla vuelve a Mesas: el envío
  // sigue solo. Sin conexión se queda un poco más, para que se alcance a leer.
  useEffect(() => {
    if (!enviado) return;
    const reloj = setTimeout(() => void navegar("/mozo/mesas", { replace: true }), enLinea ? 450 : 1600);
    return () => clearTimeout(reloj);
  }, [enviado, enLinea, navegar]);

  if (enviado) return <PantallaEnviado enLinea={enLinea} />;
  if (!destino) return <PantallaSinDestino cargando={enCurso.cargando} />;
  // Al recargar aquí, los borradores del dispositivo tardan un instante en abrirse
  if (!abierto) return <PantallaSinDestino cargando />;
  if (!borrador) return <Navigate to={`/mozo/tomar/${clave}`} replace />;

  const lineas = borrador.lineas;
  const guardar = (nuevas: Linea[]) => editarBorrador(clave, destino, { lineas: nuevas });

  function cambiar(linea: Linea, delta: number) {
    guardar(cambiarCantidad(lineas, linea.id, delta));
    // Quitar una línea entera se puede deshacer: un toque de más no borra un plato.
    // Devuelve solo esa línea a lo que haya en ese momento, no una copia vieja del pedido.
    if (linea.cantidad + delta <= 0) {
      toast(`Quitaste ${linea.nombre}`, {
        id: `quitado-${linea.id}`,
        action: {
          label: "Deshacer",
          onClick: () => editarBorrador(clave, destino!, { lineas: agregar(leerBorrador(clave)?.lineas ?? [], linea) }),
        },
      });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <CabeceraPantalla
          titulo={destino.nombre}
          detalle={esRonda ? "Revisa la ronda" : "Revisa el pedido"}
          volverA={`/mozo/tomar/${clave}`}
          volverTexto="Volver a la carta"
        />
        <FranjaCola />
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+9.5rem)]">
        <ul className="flex flex-col gap-3">
          {lineas.map((linea) => (
            <li key={linea.id} className="flex flex-col gap-3 rounded-control border-2 border-borde-fuerte bg-superficie p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xl leading-tight font-bold text-tinta">{linea.nombre}</p>
                  {linea.componentes.length > 0 && (
                    <p className="mt-1 text-lg leading-snug text-marino">{platosDeCombo(linea.componentes.map((c) => c.nombre))}</p>
                  )}
                </div>
                <p className="shrink-0 text-xl font-bold text-tinta tabular-nums">{soles(linea.precio * linea.cantidad)}</p>
              </div>

              {linea.notas.length > 0 && (
                <ul aria-label="Notas" className="flex flex-wrap gap-2">
                  {linea.notas.map((nota) => (
                    <li key={nota} className="rounded-interior border-2 border-borde-fuerte bg-fondo px-2.5 py-0.5 text-lg leading-tight font-bold text-tinta">
                      {nota}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConNotas(linea)}
                  className="presionable mr-auto inline-flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-control border-2 border-marino px-3 text-left text-lg leading-tight font-bold text-marino hover:bg-primario-suave"
                >
                  <NotePencilIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                  {linea.notas.length > 0 ? "Cambiar nota" : "Nota"}
                </button>
                <button
                  type="button"
                  onClick={() => cambiar(linea, -1)}
                  aria-label={linea.cantidad === 1 ? `Quitar ${linea.nombre}` : `Uno menos de ${linea.nombre}`}
                  className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control border-2 border-marino text-marino"
                >
                  {linea.cantidad === 1 ? (
                    <TrashIcon aria-hidden="true" weight="bold" className="size-6" />
                  ) : (
                    <MinusIcon aria-hidden="true" weight="bold" className="size-6" />
                  )}
                </button>
                <span aria-label={`Cantidad: ${linea.cantidad}`} className="w-9 text-center text-2xl font-bold text-tinta tabular-nums">
                  {linea.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => cambiar(linea, 1)}
                  aria-label={`Uno más de ${linea.nombre}`}
                  className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control bg-primario text-tinta"
                >
                  <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {destino.tipo === "PARA_LLEVAR" && !esRonda && (
          <Campo
            etiqueta="¿A nombre de quién?"
            ayuda="Opcional. Sirve para llamar al cliente cuando el pedido esté listo."
            name="cliente"
            value={borrador.cliente}
            onChange={(e) => editarBorrador(clave, destino, { cliente: e.target.value })}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
          />
        )}

        {/* La API no guarda nota general en una ronda: ahí las notas van por plato */}
        {!esRonda && (
          <div className="flex flex-col gap-2">
            <label htmlFor={idNota} className="text-lg font-bold text-marino">
              Nota para todo el pedido
            </label>
            <textarea
              id={idNota}
              value={borrador.nota}
              onChange={(e) => editarBorrador(clave, destino, { nota: e.target.value })}
              maxLength={500}
              rows={2}
              placeholder="Opcional. Ej.: todo junto, es un cumpleaños"
              className="w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-3 text-xl text-tinta placeholder:text-texto-suave focus:border-marino"
            />
          </div>
        )}
      </main>

      <div ref={barraAvisos} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-barra">
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
          <p className="flex items-baseline justify-between gap-3 text-xl font-bold text-tinta">
            <span>Total · {plural(cantidadTotal(lineas), "plato", "platos")}</span>
            <span className="text-2xl tabular-nums">{soles(montoTotal(lineas))}</span>
          </p>
          <Boton
            className="min-h-16"
            onClick={() => {
              // Lo enviado ya no se deshace desde un aviso viejo
              toast.dismiss();
              enviar(clave, pedidoId);
              setEnviado(true);
            }}
            icono={<PaperPlaneRightIcon aria-hidden="true" weight="fill" className="size-6" />}
          >
            {esRonda ? "Enviar ronda" : "Enviar a cocina"}
          </Boton>
        </div>
      </div>

      <HojaNotas
        linea={conNotas}
        notasRapidas={carta?.notasRapidas ?? []}
        alCerrar={() => setConNotas(null)}
        alGuardar={(notas, alcance, notasCombo) => {
          if (conNotas) guardar(ponerNotas(lineas, conNotas.id, notas, alcance, notasCombo));
          setConNotas(null);
        }}
      />
    </div>
  );
}

// Confirmación de un instante. No dice "enviado": eso lo confirma el servidor
// (aviso "pedido enviado a cocina"). Sin conexión avisa que quedó guardado.
function PantallaEnviado({ enLinea }: { enLinea: boolean }) {
  const Icono = enLinea ? CheckIcon : CloudArrowUpIcon;
  return (
    <div role="status" className={`grid min-h-dvh place-items-center px-6 text-tinta ${enLinea ? "bg-primario" : "bg-alerta"}`}>
      <div className="flex animate-llegada flex-col items-center gap-4 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-superficie shadow-plato">
          <Icono aria-hidden="true" weight="bold" className={`size-14 ${enLinea ? "text-primario-profundo" : "text-alerta-fuerte"}`} />
        </span>
        <p className="text-3xl font-bold text-balance">{enLinea ? "Enviando a cocina" : "Guardado en este celular"}</p>
        {!enLinea && <p className="max-w-[24ch] text-xl font-bold text-pretty">Se envía solo cuando vuelva la conexión.</p>}
      </div>
    </div>
  );
}

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
function HojaNotas({ linea, notasRapidas, alCerrar, alGuardar }: PropsNotas) {
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
