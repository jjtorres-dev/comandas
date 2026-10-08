import { SignOutIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { BotonConfirmar } from "../../componentes/BotonConfirmar";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { useSesion } from "../../sesion/contexto";
import { consultaMesasAdmin, consultaNegocioAdmin, consultaNotasAdmin, consultaRepartidoresAdmin } from "../../lib/consultas";
import { DatosDelNegocio } from "./local/DatosDelNegocio";
import { Lista, type Textos } from "./local/Lista";
import { Titulo } from "./piezas";

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

  const caida = [negocio, mesas, repartidores, notas].find((c) => c.isError && !c.data);
  if (caida) return <ErrorDeCarga error={caida.error} alReintentar={() => void caida.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <Titulo titulo="Local" texto="Las mesas, quién reparte, las notas del mozo y los datos del negocio." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Lista textos={MESAS} elementos={mesas.data} />
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
