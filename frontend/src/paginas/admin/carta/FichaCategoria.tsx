import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useGuardar } from "../../../admin/guardar";
import { Boton } from "../../../componentes/Boton";
import { BotonConfirmar } from "../../../componentes/BotonConfirmar";
import { Campo } from "../../../componentes/Campo";
import { Interruptor } from "../../../componentes/Interruptor";
import { api } from "../../../lib/api";
import type { CategoriaAdmin } from "../../../lib/tipos";
import { Ficha } from "../Ficha";
import { NotaDeHistorial } from "../piezas";

// Crear una categoría (categoria = null) o cambiarle el nombre, apagarla o eliminarla
export function FichaCategoria({ categoria, alCerrar }: { categoria: CategoriaAdmin | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [activo, setActivo] = useState(categoria?.activo ?? true);
  const { guardar, ocupado } = useGuardar();
  const limpio = nombre.trim();

  const enviar = async () => {
    const listo = categoria
      ? await guardar(() => api(`/admin/categorias/${categoria.id}`, { metodo: "PATCH", cuerpo: { nombre: limpio, activo } }), "Categoría guardada")
      : await guardar(() => api("/admin/categorias", { metodo: "POST", cuerpo: { nombre: limpio } }), `Categoría ${limpio} creada`);
    if (listo) alCerrar();
  };

  return (
    <Ficha
      sinGuardar={nombre !== (categoria?.nombre ?? "") || activo !== (categoria?.activo ?? true)}
      alCerrar={alCerrar}
      titulo={categoria ? "Editar categoría" : "Nueva categoría"}
      pie={
        <Boton type="submit" form="ficha-categoria" disabled={!limpio} ocupado={ocupado}>
          {categoria ? "Guardar" : "Crear categoría"}
        </Boton>
      }
    >
      <form
        id="ficha-categoria"
        className="flex flex-col gap-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <Campo etiqueta="Nombre" value={nombre} onChange={(evento) => setNombre(evento.target.value)} maxLength={80} autoComplete="off" placeholder="Ej.: Ceviches" />
        {categoria && (
          <>
            <Interruptor etiqueta="Se ofrece" ayuda="Apagada, sus platos no aparecen al tomar un pedido" activo={activo} alCambiar={setActivo} />
            {categoria.eliminable ? (
              <BotonConfirmar
                texto="Eliminar categoría"
                pregunta="Sí, eliminar"
                ocupado={ocupado}
                icono={<TrashIcon aria-hidden="true" weight="bold" className="size-6" />}
                alConfirmar={() => void guardar(() => api(`/admin/categorias/${categoria.id}`, { metodo: "DELETE" }), "Categoría eliminada").then((listo) => listo && alCerrar())}
              />
            ) : (
              <NotaDeHistorial>Para eliminarla, primero mueve sus platos a otra categoría o elimínalos. Mientras tanto la puedes apagar.</NotaDeHistorial>
            )}
          </>
        )}
      </form>
    </Ficha>
  );
}
