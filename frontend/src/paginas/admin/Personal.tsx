import { CheckIcon, EyeIcon, EyeSlashIcon, KeyIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useGuardar } from "../../admin/guardar";
import { Boton } from "../../componentes/Boton";
import { Campo } from "../../componentes/Campo";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { Interruptor } from "../../componentes/Interruptor";
import { api } from "../../lib/api";
import { consultaUsuarios } from "../../lib/consultas";
import type { Rol, UsuarioAdmin } from "../../lib/tipos";
import { nombreDeRoles, useSesion } from "../../sesion/contexto";
import { Ficha as Dialogo } from "./Ficha";
import { Desactivado, Titulo } from "./piezas";

const PUESTOS: { rol: Rol; nombre: string; texto: string }[] = [
  { rol: "MOZO", nombre: "Mozo", texto: "Toma pedidos desde su celular" },
  { rol: "LOCAL", nombre: "Cocina y caja", texto: "Prepara, cobra, lleva la caja y el delivery" },
  { rol: "ADMIN", nombre: "Dueño", texto: "Ve las ventas y cambia la carta, los precios y el personal" },
];

export function Personal() {
  const usuarios = useQuery(consultaUsuarios);
  const { usuario: yo, negocio } = useSesion();
  // "nuevo", o el id de la persona abierta
  const [ficha, setFicha] = useState<string | null>(null);

  if (usuarios.isError && !usuarios.data) return <ErrorDeCarga error={usuarios.error} alReintentar={() => void usuarios.refetch()} />;

  const abierta = usuarios.data?.find((u) => u.id === ficha);

  return (
    <div className="flex flex-col gap-6">
      <Titulo
        titulo="Personal"
        texto={`Cada persona entra con el código del negocio (${negocio?.codigo ?? ""}), su usuario y su contraseña.`}
        accion={
          <Boton className="sm:w-auto" icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={() => setFicha("nuevo")}>
            Nueva persona
          </Boton>
        }
      />

      {!usuarios.data ? (
        <Esqueleto className="h-64" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {usuarios.data.map((persona) => (
            <li key={persona.id}>
              <button
                type="button"
                onClick={() => setFicha(persona.id)}
                aria-label={`Editar a ${persona.nombre}`}
                className="presionable flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-panel border-2 border-borde bg-superficie px-4 py-3 text-left hover:border-marino lg:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`text-xl leading-tight font-bold ${persona.activo ? "text-tinta" : "text-texto-suave"}`}>{persona.nombre}</span>
                    {persona.id === yo?.id && <span className="inline-flex h-8 items-center rounded-full bg-primario-suave px-3 text-base font-bold text-tinta">Tú</span>}
                    {!persona.activo && <Desactivado texto="No puede entrar" />}
                  </span>
                  <span className="mt-0.5 block text-lg text-marino">
                    {nombreDeRoles(persona.roles)} · usuario <span className="font-bold">{persona.usuario}</span>
                  </span>
                </span>
                <PencilSimpleIcon aria-hidden="true" weight="bold" className="size-6 shrink-0 text-texto-suave" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ficha === "nuevo" && <FichaPersona key="nuevo" persona={null} esYo={false} alCerrar={() => setFicha(null)} />}
      {abierta && <FichaPersona key={abierta.id} persona={abierta} esYo={abierta.id === yo?.id} alCerrar={() => setFicha(null)} />}
    </div>
  );
}

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

function FichaPersona({ persona, esYo, alCerrar }: { persona: UsuarioAdmin | null; esYo: boolean; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [usuario, setUsuario] = useState(persona?.usuario ?? "");
  const [roles, setRoles] = useState<Rol[]>(persona?.roles ?? ["MOZO"]);
  const [activo, setActivo] = useState(persona?.activo ?? true);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  // Al editar, la contraseña solo se toca si el dueño lo pide
  const [cambiandoClave, setCambiandoClave] = useState(persona === null);
  const { guardar, ocupado } = useGuardar();
  const id = useId();

  const usuarioLimpio = usuario.trim().toLowerCase();
  const falta = !nombre.trim()
    ? "Escribe su nombre"
    : !USUARIO_VALIDO.test(usuarioLimpio)
      ? "El usuario lleva de 3 a 30 letras o números, sin espacios"
      : roles.length === 0
        ? "Marca al menos un puesto"
        : cambiandoClave && password.length < 6
          ? "La contraseña necesita al menos 6 caracteres"
          : null;

  const enviar = async () => {
    if (falta) return;
    const datos = { nombre: nombre.trim(), usuario: usuarioLimpio, roles };
    const listo = persona
      ? await guardar(async () => {
          await api(`/admin/usuarios/${persona.id}`, { metodo: "PATCH", cuerpo: { ...datos, activo } });
          if (cambiandoClave) await api(`/admin/usuarios/${persona.id}/password`, { metodo: "PUT", cuerpo: { password } });
        }, `${datos.nombre}: cambios guardados`)
      : await guardar(() => api("/admin/usuarios", { metodo: "POST", cuerpo: { ...datos, password } }), `${datos.nombre} ya puede entrar con el usuario ${usuarioLimpio}`);
    if (listo) alCerrar();
  };

  return (
    <Dialogo
      sinGuardar={
        nombre !== (persona?.nombre ?? "") ||
        usuario !== (persona?.usuario ?? "") ||
        roles.join() !== (persona?.roles ?? ["MOZO"]).join() ||
        activo !== (persona?.activo ?? true) ||
        password !== ""
      }
      alCerrar={alCerrar}
      titulo={persona ? `Editar a ${persona.nombre}` : "Nueva persona"}
      pie={
        <div className="flex flex-col gap-2">
          {falta && <p className="text-base font-bold text-marino">{falta}</p>}
          <Boton type="submit" form={id} disabled={falta !== null} ocupado={ocupado}>
            {persona ? "Guardar" : "Crear usuario"}
          </Boton>
        </div>
      }
    >
      <form
        id={id}
        className="flex flex-col gap-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <Campo etiqueta="Nombre" value={nombre} onChange={(evento) => setNombre(evento.target.value)} maxLength={80} autoComplete="off" placeholder="Ej.: Diana Valdiviezo" />
        <Campo
          etiqueta="Usuario"
          ayuda="Con esto entra. En minúsculas y sin espacios."
          value={usuario}
          onChange={(evento) => setUsuario(evento.target.value.toLowerCase().replace(/\s/g, ""))}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Ej.: diana"
        />

        <fieldset>
          <legend className="mb-2 text-lg font-bold text-marino">Puestos</legend>
          <ul className="flex flex-col gap-2">
            {PUESTOS.map(({ rol, nombre: puesto, texto }) => {
              const marcado = roles.includes(rol);
              // El dueño no puede quitarse su propio puesto: se quedaría fuera
              const fijo = esYo && rol === "ADMIN";
              return (
                <li key={rol}>
                  <label className={`flex min-h-14 items-center gap-3 rounded-control border-2 px-3 py-2 ${fijo ? "cursor-not-allowed" : "cursor-pointer"} ${marcado ? "border-marino bg-primario-suave" : "border-borde-fuerte bg-superficie"}`}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={fijo}
                      onChange={() => setRoles(marcado ? roles.filter((r) => r !== rol) : [...roles, rol])}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-interior border-2 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marino ${marcado ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-superficie"}`}>
                      {marcado && <CheckIcon weight="bold" className="size-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xl font-bold text-tinta">{puesto}</span>
                      <span className="block text-base text-pretty text-marino">{fijo ? "Es tu puesto: no te lo puedes quitar" : texto}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {cambiandoClave ? (
          <Campo
            etiqueta={persona ? "Contraseña nueva" : "Contraseña"}
            ayuda="Al menos 6 caracteres. Díctasela: la podrás cambiar cuando quieras."
            type={visible ? "text" : "password"}
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            maxLength={72}
            autoComplete="new-password"
            accion={
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={visible}
                className="presionable grid size-12 cursor-pointer place-items-center rounded-interior text-marino hover:bg-primario-suave"
              >
                {visible ? <EyeSlashIcon aria-hidden="true" weight="bold" className="size-6" /> : <EyeIcon aria-hidden="true" weight="bold" className="size-6" />}
              </button>
            }
          />
        ) : (
          <Boton variante="secundario" icono={<KeyIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={() => setCambiandoClave(true)}>
            Cambiar su contraseña
          </Boton>
        )}

        {persona && !esYo && (
          <Interruptor etiqueta="Puede entrar" ayuda="Apagado, su usuario deja de funcionar al instante. No se borra nada de lo que hizo." activo={activo} alCambiar={setActivo} />
        )}
      </form>
    </Dialogo>
  );
}
