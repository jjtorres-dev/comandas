import { CheckIcon, CloudArrowUpIcon, MinusIcon, NotePencilIcon, PaperPlaneRightIcon, PlusIcon, ReceiptIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Boton } from "../../componentes/Boton";
import { CabeceraPantalla } from "../../componentes/CabeceraPantalla";
import { Campo } from "../../componentes/Campo";
import { BotonCantidad, HojaCantidad } from "../../componentes/pedido/HojaCantidad";
import { HojaNotas } from "../../componentes/pedido/HojaNotas";
import { consultaCarta } from "../../lib/consultas";
import { conteoDeProductos } from "../../lib/conteo";
import { platosDeCombo, soles } from "../../lib/formato";
import { useEspacioAvisos } from "../../lib/useEspacioAvisos";
import { editarBorrador, enviar, leerBorrador, useMozo } from "../../mozo/almacen";
import { FranjaCola } from "../../mozo/FranjaCola";
import { agregar, cambiarCantidad, type Linea, montoTotal, ponerNotas, vaACocina } from "../../mozo/lineas";
import { usePedidoEnCurso } from "../../mozo/usePedidoEnCurso";
import { useConexion } from "../../tiempo-real/contexto";
import { PantallaSinDestino } from "./TomarPedido";

export function Resumen() {
  const { clave = "" } = useParams();
  const navegar = useNavigate();
  const enCurso = usePedidoEnCurso(clave);
  const { data: carta } = useQuery(consultaCarta);
  const [conNotas, setConNotas] = useState<Linea | null>(null);
  const [conCantidad, setConCantidad] = useState<Linea | null>(null);
  // null: nada enviado todavía. Lo enviado recuerda si iba a cocina o solo a la cuenta
  const [enviado, setEnviado] = useState<{ aCocina: boolean } | null>(null);
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

  if (enviado) return <PantallaEnviado enLinea={enLinea} aCocina={enviado.aCocina} />;
  if (!destino) return <PantallaSinDestino cargando={enCurso.cargando} />;
  // Al recargar aquí, los borradores del dispositivo tardan un instante en abrirse
  if (!abierto) return <PantallaSinDestino cargando />;
  if (!borrador) return <Navigate to={`/mozo/tomar/${clave}`} replace />;

  const lineas = borrador.lineas;
  // Solo bebidas (o lo que no pase por cocina): no hay nada que enviarle a la cocina
  const aCocina = vaACocina(lineas, carta);
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
                <BotonCantidad cantidad={linea.cantidad} de={linea.nombre} onClick={() => setConCantidad(linea)} />
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
            <span>Total · {conteoDeProductos(lineas, carta)}</span>
            <span className="text-2xl tabular-nums">{soles(montoTotal(lineas))}</span>
          </p>
          <Boton
            className="min-h-16"
            onClick={() => {
              // Lo enviado ya no se deshace desde un aviso viejo
              toast.dismiss();
              enviar(clave, pedidoId);
              setEnviado({ aCocina });
            }}
            icono={
              aCocina ? (
                <PaperPlaneRightIcon aria-hidden="true" weight="fill" className="size-6" />
              ) : (
                <ReceiptIcon aria-hidden="true" weight="fill" className="size-6" />
              )
            }
          >
            {!aCocina ? "Anotar en la cuenta" : esRonda ? "Enviar ronda" : "Enviar a cocina"}
          </Boton>
        </div>
      </div>

      <HojaCantidad
        de={conCantidad && { nombre: conCantidad.nombre, cantidad: conCantidad.cantidad }}
        alCerrar={() => setConCantidad(null)}
        alGuardar={(cantidad) => {
          // La línea pudo cambiar con la hoja abierta: la diferencia se aplica a lo que haya ahora
          const vigente = conCantidad && lineas.find((l) => l.id === conCantidad.id);
          if (vigente) cambiar(vigente, cantidad - vigente.cantidad);
          setConCantidad(null);
        }}
      />
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
function PantallaEnviado({ enLinea, aCocina }: { enLinea: boolean; aCocina: boolean }) {
  const Icono = enLinea ? CheckIcon : CloudArrowUpIcon;
  return (
    <div role="status" className={`grid min-h-dvh place-items-center px-6 text-tinta ${enLinea ? "bg-primario" : "bg-alerta"}`}>
      <div className="flex animate-llegada flex-col items-center gap-4 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-superficie shadow-plato">
          <Icono aria-hidden="true" weight="bold" className={`size-14 ${enLinea ? "text-primario-profundo" : "text-alerta-fuerte"}`} />
        </span>
        <p className="text-3xl font-bold text-balance">{!enLinea ? "Guardado en este celular" : aCocina ? "Enviando a cocina" : "Anotando en la cuenta"}</p>
        {!enLinea && <p className="max-w-[24ch] text-xl font-bold text-pretty">Se envía solo cuando vuelva la conexión.</p>}
      </div>
    </div>
  );
}
