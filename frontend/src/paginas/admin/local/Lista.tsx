import { PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useGuardar } from "../../../admin/guardar";
import { Boton } from "../../../componentes/Boton";
import { BotonConfirmar } from "../../../componentes/BotonConfirmar";
import { Campo } from "../../../componentes/Campo";
import { Esqueleto } from "../../../componentes/EstadoDeCarga";
import { Interruptor } from "../../../componentes/Interruptor";
import { api } from "../../../lib/api";
import type { ElementoAdmin } from "../../../lib/tipos";
import { Ficha as Dialogo } from "../Ficha";
import { BotonIcono, Desactivado, NotaDeHistorial, Orden, Tarjeta } from "../piezas";

// Mesas, motorizados y notas rápidas son la misma lista con distintas palabras
export type Textos = {
  titulo: string;
  explicacion: string;
  // "/admin/mesas"
  ruta: string;
  // Campo del nombre en la API: "nombre" o "texto"
  campo: "nombre" | "texto";
  nuevo: string; // "Nueva mesa"
  editar: string; // "Editar mesa"
  etiqueta: string; // "Nombre de la mesa"
  ejemplo: string;
  maximo: number;
  vacio: string;
  activo: { etiqueta: string; ayuda: string };
  desactivado: string;
  // Por qué no se puede eliminar lo que ya se usó
  conHistorial: string;
  conTelefono?: boolean;
  seOrdena: boolean;
};

type Elemento = ElementoAdmin & { nombre?: string; texto?: string; telefono?: string | null };

export function Lista({ textos, elementos }: { textos: Textos; elementos: Elemento[] | undefined }) {
  // "nuevo", o el id del elemento abierto
  const [ficha, setFicha] = useState<string | null>(null);
  const { guardar, ocupado } = useGuardar();
  const nombreDe = (e: Elemento) => e[textos.campo] ?? "";
  const abierto = elementos?.find((e) => e.id === ficha);

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold text-tinta">{textos.titulo}</h2>
        <p className="mt-1 text-lg text-pretty text-marino">{textos.explicacion}</p>
      </div>

      {!elementos ? (
        <Esqueleto className="h-40" />
      ) : elementos.length === 0 ? (
        <p className="rounded-control bg-fondo px-4 py-3 text-lg text-pretty text-marino">{textos.vacio}</p>
      ) : (
        <ul aria-label={textos.titulo} className="divide-y-2 divide-borde border-y-2 border-borde">
          {elementos.map((elemento, i) => (
            <li key={elemento.id} className="flex items-center gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`text-xl leading-tight font-bold ${elemento.activo ? "text-tinta" : "text-texto-suave"}`}>{nombreDe(elemento)}</span>
                {elemento.telefono && <span className="text-lg text-marino tabular-nums">{elemento.telefono}</span>}
                {!elemento.activo && <Desactivado texto={textos.desactivado} />}
              </div>
              {textos.seOrdena && (
                <Orden
                  de={nombreDe(elemento)}
                  primero={i === 0}
                  ultimo={i === elementos.length - 1}
                  ocupado={ocupado}
                  alMover={(direccion) => void guardar(() => api(`${textos.ruta}/${elemento.id}/mover`, { metodo: "POST", cuerpo: { direccion } }))}
                />
              )}
              <BotonIcono nombre={`Editar ${nombreDe(elemento)}`} icono={PencilSimpleIcon} onClick={() => setFicha(elemento.id)} />
            </li>
          ))}
        </ul>
      )}

      <Boton variante="secundario" className="sm:w-auto sm:self-start" icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={() => setFicha("nuevo")}>
        {textos.nuevo}
      </Boton>

      {ficha === "nuevo" && <FichaElemento key="nuevo" textos={textos} elemento={null} alCerrar={() => setFicha(null)} />}
      {abierto && <FichaElemento key={abierto.id} textos={textos} elemento={abierto} alCerrar={() => setFicha(null)} />}
    </Tarjeta>
  );
}

function FichaElemento({ textos, elemento, alCerrar }: { textos: Textos; elemento: Elemento | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(elemento?.[textos.campo] ?? "");
  const [telefono, setTelefono] = useState(elemento?.telefono ?? "");
  const [activo, setActivo] = useState(elemento?.activo ?? true);
  const { guardar, ocupado } = useGuardar();
  const limpio = nombre.trim();
  const digitos = telefono.replace(/\D/g, "");
  const telefonoMalo = textos.conTelefono && digitos.length > 0 && digitos.length < 9;

  const enviar = async () => {
    const datos = { [textos.campo]: limpio, ...(textos.conTelefono ? { telefono: digitos } : {}) };
    const listo = elemento
      ? await guardar(() => api(`${textos.ruta}/${elemento.id}`, { metodo: "PATCH", cuerpo: { ...datos, activo } }), "Cambios guardados")
      : await guardar(() => api(textos.ruta, { metodo: "POST", cuerpo: datos }), `${limpio}: listo`);
    if (listo) alCerrar();
  };

  return (
    <Dialogo
      sinGuardar={nombre !== (elemento?.[textos.campo] ?? "") || telefono !== (elemento?.telefono ?? "") || activo !== (elemento?.activo ?? true)}
      alCerrar={alCerrar}
      titulo={elemento ? textos.editar : textos.nuevo}
      pie={
        <Boton type="submit" form={`ficha-${textos.campo}-${textos.ruta}`} disabled={!limpio || telefonoMalo} ocupado={ocupado}>
          {elemento ? "Guardar" : "Agregar"}
        </Boton>
      }
    >
      <form
        id={`ficha-${textos.campo}-${textos.ruta}`}
        className="flex flex-col gap-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <Campo etiqueta={textos.etiqueta} value={nombre} onChange={(evento) => setNombre(evento.target.value)} maxLength={textos.maximo} autoComplete="off" placeholder={`Ej.: ${textos.ejemplo}`} />
        {textos.conTelefono && (
          <Campo
            etiqueta="Celular (WhatsApp)"
            ayuda="A este número se le envían los pedidos. Puede quedar vacío."
            error={telefonoMalo ? "El celular tiene 9 dígitos" : null}
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            inputMode="tel"
            autoComplete="off"
            placeholder="Ej.: 987 654 321"
          />
        )}
        {elemento && (
          <>
            <Interruptor etiqueta={textos.activo.etiqueta} ayuda={textos.activo.ayuda} activo={activo} alCambiar={setActivo} />
            {elemento.eliminable ? (
              <BotonConfirmar
                texto="Eliminar"
                pregunta="Sí, eliminar"
                ocupado={ocupado}
                icono={<TrashIcon aria-hidden="true" weight="bold" className="size-6" />}
                alConfirmar={() => void guardar(() => api(`${textos.ruta}/${elemento.id}`, { metodo: "DELETE" }), "Eliminado").then((listo) => listo && alCerrar())}
              />
            ) : (
              <NotaDeHistorial>{textos.conHistorial}</NotaDeHistorial>
            )}
          </>
        )}
      </form>
    </Dialogo>
  );
}
