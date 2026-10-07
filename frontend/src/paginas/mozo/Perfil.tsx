import { SignOutIcon, WarningIcon } from "@phosphor-icons/react";
import { Boton } from "../../componentes/Boton";
import { BotonConfirmar } from "../../componentes/BotonConfirmar";
import { plural } from "../../lib/formato";
import { useMozo } from "../../mozo/almacen";
import { nombreDeRoles, useSesion } from "../../sesion/contexto";

export function Perfil() {
  const { usuario, negocio, cerrarSesion } = useSesion();
  const { cola, borradores } = useMozo();
  if (!usuario || !negocio) return null;

  // Lo que quedaría en este celular sin llegar a cocina
  const guardados = cola.length + Object.keys(borradores).length;

  const datos = [
    ["Nombre", usuario.nombre],
    ["Usuario", usuario.usuario],
    ["Puesto", nombreDeRoles(usuario.roles)],
    ["Negocio", negocio.nombre],
  ];

  return (
    <section className="flex flex-1 flex-col gap-5">
      <h1 className="text-3xl font-bold text-tinta">Perfil</h1>
      <dl className="divide-y-2 divide-borde rounded-panel bg-superficie px-5">
        {datos.map(([termino, valor]) => (
          <div key={termino} className="flex items-baseline justify-between gap-4 py-4">
            <dt className="text-lg text-texto-suave">{termino}</dt>
            <dd className="text-right text-xl font-bold text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>
      {guardados > 0 ? (
        <div className="mt-auto flex flex-col gap-3">
          <p role="alert" className="flex items-start gap-2.5 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
            <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
            Tienes {plural(guardados, "pedido", "pedidos")} sin llegar a cocina. Si sales, se quedan guardados en este celular y
            solo se envían cuando vuelvas a entrar con tu usuario.
          </p>
          <BotonConfirmar
            texto="Cerrar sesión"
            pregunta="Sí, salir"
            alConfirmar={cerrarSesion}
            className="min-h-14 text-xl"
            icono={<SignOutIcon aria-hidden="true" weight="bold" className="size-6" />}
          />
        </div>
      ) : (
        <Boton
          variante="peligro"
          onClick={cerrarSesion}
          className="mt-auto"
          icono={<SignOutIcon aria-hidden="true" weight="bold" className="size-6" />}
        >
          Cerrar sesión
        </Boton>
      )}
    </section>
  );
}
