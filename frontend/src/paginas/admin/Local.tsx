import { SignOutIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { BotonConfirmar } from "../../componentes/BotonConfirmar";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { useSesion } from "../../sesion/contexto";
import { useGuardar } from "../../admin/guardar";
import { Interruptor } from "../../componentes/Interruptor";
import { api } from "../../lib/api";
import { consultaCartaAdmin, consultaMesasAdmin, consultaNegocioAdmin, consultaNotasAdmin, consultaRepartidoresAdmin } from "../../lib/consultas";
import type { Area } from "../../lib/tipos";
import { DatosDelNegocio } from "./local/DatosDelNegocio";
import { Lista, type Textos } from "./local/Lista";
import { Tarjeta, Titulo } from "./piezas";

const MESAS: Textos = {
  titulo: "Mesas",
  explicacion: "En este orden las ve el mozo.",
  ruta: "/admin/mesas",
  campo: "nombre",
  nuevo: "Nueva mesa",
  editar: "Editar mesa",
  etiqueta: "Nombre de la mesa",
  ejemplo: "Mesa 9",
  maximo: 40,
  vacio: "Todavía no hay mesas. Sin mesas, el mozo solo puede tomar pedidos para llevar.",
  activo: { etiqueta: "Se usa", ayuda: "Apagada, el mozo ya no la ve" },
  desactivado: "No se usa",
  conHistorial: "Esta mesa ya tuvo pedidos: no se puede eliminar, porque aparecen en los reportes. Si ya no la usas, apágala.",
  seOrdena: true,
};

const MOTORIZADOS: Textos = {
  titulo: "Motorizados",
  explicacion: "Quienes llevan los pedidos de delivery. No tienen usuario: reciben cada pedido por WhatsApp.",
  ruta: "/admin/repartidores",
  campo: "nombre",
  nuevo: "Nuevo motorizado",
  editar: "Editar motorizado",
  etiqueta: "Nombre",
  ejemplo: "José Falcón",
  maximo: 80,
  vacio: "Todavía no hay motorizados. Sin uno, los pedidos de delivery no se pueden asignar.",
  activo: { etiqueta: "Trabaja con nosotros", ayuda: "Apagado, ya no aparece al asignar un pedido" },
  desactivado: "Ya no trabaja",
  conHistorial: "Este motorizado ya llevó pedidos: no se puede eliminar. Si ya no trabaja con ustedes, apágalo.",
  conTelefono: true,
  seOrdena: false,
};

const NOTAS: Textos = {
  titulo: "Notas rápidas",
  explicacion: "Los botones que usa el mozo para anotar un pedido sin escribir: sin cebolla, ají aparte…",
  ruta: "/admin/notas",
  campo: "texto",
  nuevo: "Nueva nota",
  editar: "Editar nota",
  etiqueta: "Texto de la nota",
  ejemplo: "Sin cebolla",
  maximo: 60,
  vacio: "Todavía no hay notas rápidas. El mozo puede escribir la nota a mano.",
  activo: { etiqueta: "Se ofrece", ayuda: "Apagada, el botón ya no aparece" },
  desactivado: "No se ofrece",
  conHistorial: "",
  seOrdena: true,
};

export function Local() {
  const { cerrarSesion } = useSesion();
  const negocio = useQuery(consultaNegocioAdmin);
  const mesas = useQuery(consultaMesasAdmin);
  const repartidores = useQuery(consultaRepartidoresAdmin);
  const notas = useQuery(consultaNotasAdmin);
  const carta = useQuery(consultaCartaAdmin);

  const caida = [negocio, mesas, repartidores, notas, carta].find((c) => c.isError && !c.data);
  if (caida) return <ErrorDeCarga error={caida.error} alReintentar={() => void caida.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <Titulo titulo="Local" texto="Las mesas, quién reparte, las notas del mozo y los datos del negocio." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Lista textos={MESAS} elementos={mesas.data} />
          <Areas areas={carta.data?.areas} />
          <Lista textos={MOTORIZADOS} elementos={repartidores.data} />
          <Lista textos={NOTAS} elementos={notas.data} />
        </div>
        {/* La clave rearma el formulario con lo último guardado (también si lo cambió otro equipo); cambiar el logo no borra lo que se está escribiendo */}
        {negocio.data ? <DatosDelNegocio key={JSON.stringify({ ...negocio.data, logoUrl: null })} negocio={negocio.data} /> : <Esqueleto className="h-96" />}
      </div>
      {/* En el celular la cabecera no tiene sitio para Salir: va aquí, como en el perfil del mozo */}
      <div className="lg:hidden">
        <BotonConfirmar texto="Cerrar sesión" pregunta="Sí, salir" alConfirmar={cerrarSesion} className="min-h-14 w-full text-xl" icono={<SignOutIcon aria-hidden="true" weight="bold" className="size-6" />} />
      </div>
    </div>
  );
}

// Qué áreas de preparación pasan por cocina. Lo que no (las bebidas de la
// refrigeradora) lo saca el mozo: no sale ni suena en el panel de cocina.
function Areas({ areas }: { areas: Area[] | undefined }) {
  const { guardar, ocupado } = useGuardar();

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold text-tinta">¿Qué pasa por cocina?</h2>
        <p className="mt-1 text-lg text-pretty text-marino">
          Lo que no pasa por cocina lo saca el mozo, como las bebidas de la refrigeradora: no aparece ni suena en la cocina, y entra directo a la cuenta. Vale
          para los pedidos que se tomen desde ahora.
        </p>
      </div>
      {!areas ? (
        <Esqueleto className="h-32" />
      ) : (
        <ul aria-label="Áreas de preparación" className="flex flex-col gap-3">
          {areas.map((area) => (
            <li key={area.id}>
              <Interruptor
                etiqueta={area.nombre}
                ayuda={area.pasaPorCocina ? "Pasa por cocina: sale en el panel" : "No pasa por cocina: lo saca el mozo"}
                activo={area.pasaPorCocina}
                disabled={ocupado}
                alCambiar={(pasaPorCocina) =>
                  void guardar(
                    () => api(`/admin/areas/${area.id}`, { metodo: "PATCH", cuerpo: { pasaPorCocina } }),
                    pasaPorCocina ? `${area.nombre}: ahora pasa por cocina` : `${area.nombre}: ya no pasa por cocina`,
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
