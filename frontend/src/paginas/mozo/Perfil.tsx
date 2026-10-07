import { SignOutIcon } from "@phosphor-icons/react";
import { Boton } from "../../componentes/Boton";
import { nombreDeRoles, useSesion } from "../../sesion/contexto";

export function Perfil() {
  const { usuario, negocio, cerrarSesion } = useSesion();
  if (!usuario || !negocio) return null;

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
      <Boton
        variante="peligro"
        onClick={cerrarSesion}
        className="mt-auto"
        icono={<SignOutIcon aria-hidden="true" weight="bold" className="size-6" />}
      >
        Cerrar sesión
      </Boton>
    </section>
  );
}
