import { ArrowRightIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { Boton } from "../componentes/Boton";
import { Campo } from "../componentes/Campo";
import { LogoNegocio } from "../componentes/LogoNegocio";
import { Ola } from "../componentes/Ola";
import { PantallaCarga } from "../componentes/PantallaCarga";
import { api, esErrorApi, mensajeDe } from "../lib/api";
import { claves } from "../lib/consultas";
import type { NegocioPublico } from "../lib/tipos";
import { inicioDe, useSesion } from "../sesion/contexto";

const pedirNegocio = (codigo: string, signal?: AbortSignal) =>
  api<NegocioPublico>(`/negocios/${encodeURIComponent(codigo)}/publico`, { signal });

const entrada = {
  initial: { opacity: 0, transform: "translateY(8px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
} as const;

export function Login() {
  const { estado, usuario, codigoNegocio, recordarNegocio } = useSesion();
  // Aviso para el paso 1 cuando el negocio guardado ya no existe
  const [aviso, setAviso] = useState<string | null>(null);

  const negocio = useQuery({
    queryKey: claves.negocioPublico(codigoNegocio ?? ""),
    queryFn: async ({ signal }) => {
      try {
        return await pedirNegocio(codigoNegocio!, signal);
      } catch (causa) {
        // El código guardado dejó de existir: se vuelve a pedir
        if (esErrorApi(causa, "NO_ENCONTRADO")) {
          setAviso("Ese negocio ya no está disponible. Escribe el código otra vez");
          recordarNegocio(null);
        }
        throw causa;
      }
    },
    enabled: codigoNegocio !== null,
    staleTime: 5 * 60_000,
  });

  if (estado === "cargando" || estado === "sin-servidor") return <PantallaCarga />;
  if (estado === "con-sesion" && usuario) return <Navigate to={inicioDe(usuario.roles)} replace />;

  const nombre = negocio.data?.nombre ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="relative flex min-h-[38dvh] flex-col items-center justify-center gap-4 bg-primario px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-20 text-center text-tinta">
        {codigoNegocio ? (
          <>
            {nombre ? (
              <LogoNegocio nombre={nombre} logoUrl={negocio.data?.logoUrl ?? null} className="size-40 sm:size-48" amplio />
            ) : (
              <span className="size-40 animate-pulse rounded-full bg-superficie/60 sm:size-48" />
            )}
            <h1 className="min-h-9 max-w-[20ch] text-3xl font-bold text-balance sm:text-4xl">
              {nombre ?? (negocio.isError ? codigoNegocio : "")}
            </h1>
          </>
        ) : (
          <>
            <span className="grid size-40 place-items-center rounded-full bg-superficie shadow-plato sm:size-48">
              <img src="/favicon.svg" alt="" className="size-[58%] rounded-[22%]" />
            </span>
            <h1 className="text-4xl font-bold sm:text-5xl">Comandas</h1>
          </>
        )}
        <Ola />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
        <AnimatePresence mode="wait" initial={false}>
          {codigoNegocio ? (
            <motion.div key="usuario" {...entrada}>
              <PasoUsuario
                codigoNegocio={codigoNegocio}
                errorDeNegocio={negocio.isError ? mensajeDe(negocio.error) : null}
                alCambiarNegocio={() => {
                  setAviso(null);
                  recordarNegocio(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="negocio" {...entrada}>
              <PasoNegocio aviso={aviso} alEncontrar={recordarNegocio} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Paso 1: solo la primera vez en cada dispositivo
function PasoNegocio({ aviso, alEncontrar }: { aviso: string | null; alEncontrar: (codigo: string) => void }) {
  const consultas = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(aviso);
  const [buscando, setBuscando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = codigo.trim().toLowerCase();
    if (!limpio) return setError("Escribe el código de tu negocio");

    setBuscando(true);
    setError(null);
    try {
      // Queda en caché: el paso siguiente pinta el logo sin volver a pedirlo
      await consultas.fetchQuery({ queryKey: claves.negocioPublico(limpio), queryFn: () => pedirNegocio(limpio) });
      alEncontrar(limpio);
    } catch (causa) {
      setError(
        esErrorApi(causa, "NO_ENCONTRADO")
          ? "No encontramos un negocio con ese código. Revísalo con el dueño del local"
          : mensajeDe(causa),
      );
    } finally {
      setBuscando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-tinta">¿En qué negocio trabajas?</h2>
      <Campo
        etiqueta="Código del negocio"
        ayuda="Te lo da el dueño del local. Se pide solo una vez en este equipo."
        name="codigoNegocio"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toLowerCase())}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="organization"
        spellCheck={false}
        enterKeyHint="next"
      />
      <Boton type="submit" ocupado={buscando} icono={<ArrowRightIcon aria-hidden="true" weight="bold" className="order-last size-6" />}>
        Continuar
      </Boton>
    </form>
  );
}

// Paso 2: usuario y contraseña dentro del negocio ya elegido
function PasoUsuario({
  codigoNegocio,
  errorDeNegocio,
  alCambiarNegocio,
}: {
  codigoNegocio: string;
  errorDeNegocio: string | null;
  alCambiarNegocio: () => void;
}) {
  const { iniciarSesion } = useSesion();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario.trim() || !password) return setError("Escribe tu usuario y tu contraseña");

    setEntrando(true);
    setError(null);
    try {
      await iniciarSesion({ codigoNegocio, usuario: usuario.trim(), password });
      // La redirección según el rol la hace <Login> al ver la sesión
    } catch (causa) {
      setError(
        esErrorApi(causa, "NO_AUTENTICADO") ? "Usuario o contraseña incorrectos. Vuelve a intentarlo" : mensajeDe(causa),
      );
      setEntrando(false);
    }
  }

  const IconoVer = verPassword ? EyeSlashIcon : EyeIcon;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-tinta">Inicia sesión</h2>
      {errorDeNegocio && (
        <p role="alert" className="rounded-control bg-alerta-suave px-4 py-3 text-base font-bold text-alerta-fuerte">
          {errorDeNegocio}
        </p>
      )}
      <Campo
        etiqueta="Usuario"
        name="usuario"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck={false}
        enterKeyHint="next"
      />
      <Campo
        etiqueta="Contraseña"
        name="password"
        type={verPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
        autoComplete="current-password"
        enterKeyHint="go"
        accion={
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verPassword}
            className="presionable grid size-12 cursor-pointer place-items-center rounded-interior text-marino hover:bg-primario-suave"
          >
            <IconoVer aria-hidden="true" weight="bold" className="size-6" />
          </button>
        }
      />
      <Boton type="submit" ocupado={entrando} className="mt-1">
        {entrando ? "Entrando" : "Entrar"}
      </Boton>
      <Boton variante="texto" onClick={alCambiarNegocio} disabled={entrando}>
        Cambiar de negocio
      </Boton>
    </form>
  );
}
