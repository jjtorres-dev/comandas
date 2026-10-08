import { ArrowUpIcon, ImageIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useGuardar } from "../../../admin/guardar";
import { Boton } from "../../../componentes/Boton";
import { BotonConfirmar } from "../../../componentes/BotonConfirmar";
import { Campo } from "../../../componentes/Campo";
import { LogoNegocio } from "../../../componentes/LogoNegocio";
import { api } from "../../../lib/api";
import type { NegocioAdmin } from "../../../lib/tipos";
import { leerMonto, paraApi } from "../../../local/dinero";
import { BotonIcono, Tarjeta } from "../piezas";

const LOGO_MAXIMO = 1024 * 1024;
const TIPOS_DE_LOGO = ["image/png", "image/jpeg", "image/webp"];

const monto = (texto: string) => Number(texto).toFixed(2);

export function DatosDelNegocio({ negocio }: { negocio: NegocioAdmin }) {
  const [nombre, setNombre] = useState(negocio.nombre);
  const [envio, setEnvio] = useState(monto(negocio.costoEnvioDefault));
  const [taper, setTaper] = useState(monto(negocio.precioTaper));
  const [region, setRegion] = useState(negocio.region ?? "");
  const [distritos, setDistritos] = useState(negocio.distritos);
  const [distritoNuevo, setDistritoNuevo] = useState("");
  const [tarda, setTarda] = useState(String(negocio.umbralTardaMin));
  const [muyTarde, setMuyTarde] = useState(String(negocio.umbralMuyTardeMin));
  const { guardar, ocupado } = useGuardar();
  const archivo = useRef<HTMLInputElement>(null);

  const [envioC, taperC] = [leerMonto(envio), leerMonto(taper)];
  const [tardaN, muyTardeN] = [Number(tarda), Number(muyTarde)];
  const minutosValidos = (n: number) => Number.isInteger(n) && n >= 1 && n <= 240;
  const errores = {
    nombre: nombre.trim() ? null : "Escribe el nombre del negocio",
    envio: envioC === null || envioC > 2000 ? "Un monto entre S/ 0 y S/ 20" : null,
    taper: taperC === null || taperC > 2000 ? "Un monto entre S/ 0 y S/ 20" : null,
    tarda: minutosValidos(tardaN) ? null : "Entre 1 y 240 minutos",
    muyTarde: !minutosValidos(muyTardeN) ? "Entre 1 y 240 minutos" : muyTardeN <= tardaN ? "Tiene que ser más que el aviso ámbar" : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);
  // Los distritos se agregan y quitan en pantalla: nada vale hasta guardar
  const sinGuardar =
    nombre !== negocio.nombre ||
    envio !== monto(negocio.costoEnvioDefault) ||
    taper !== monto(negocio.precioTaper) ||
    region !== (negocio.region ?? "") ||
    distritos.join("|") !== negocio.distritos.join("|") ||
    tarda !== String(negocio.umbralTardaMin) ||
    muyTarde !== String(negocio.umbralMuyTardeMin);

  const agregarDistrito = () => {
    const limpio = distritoNuevo.trim();
    if (!limpio) return;
    if (distritos.some((d) => d.toLowerCase() === limpio.toLowerCase())) return void toast.error(`${limpio} ya está en la lista`);
    setDistritos([...distritos, limpio]);
    setDistritoNuevo("");
  };

  const subirLogo = (imagen: File | undefined) => {
    if (!imagen) return;
    if (!TIPOS_DE_LOGO.includes(imagen.type)) return void toast.error("El logo tiene que ser una imagen PNG, JPG o WebP");
    if (imagen.size > LOGO_MAXIMO) return void toast.error("La imagen pesa más de 1 MB. Usa una más liviana");
    void guardar(() => api("/admin/negocio/logo", { metodo: "PUT", archivo: imagen }), "Logo cambiado");
  };

  const enviar = () =>
    void guardar(
      () =>
        api("/admin/negocio", {
          metodo: "PATCH",
          cuerpo: {
            nombre: nombre.trim(),
            costoEnvioDefault: paraApi(envioC ?? 0),
            precioTaper: paraApi(taperC ?? 0),
            region: region.trim() || null,
            distritos,
            umbralTardaMin: tardaN,
            umbralMuyTardeMin: muyTardeN,
          },
        }),
      "Datos del negocio guardados",
    );

  return (
    <Tarjeta>
      <form
        aria-label="Datos del negocio"
        className="flex flex-col gap-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!hayErrores) enviar();
        }}
      >
        <h2 className="text-2xl font-bold text-tinta">El negocio</h2>

        <div className="flex flex-wrap items-center gap-4">
          <LogoNegocio nombre={negocio.nombre} logoUrl={negocio.logoUrl} className="size-24 border-2 border-borde" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-lg font-bold text-marino">Logo</p>
            <p className="text-base text-pretty text-texto-suave">PNG, JPG o WebP de hasta 1 MB. Se ve en el login, arriba en cada pantalla y en la nota de venta.</p>
            <div className="flex flex-wrap gap-2">
              <input ref={archivo} type="file" accept={TIPOS_DE_LOGO.join(",")} className="sr-only" tabIndex={-1} aria-label="Imagen del logo" onChange={(evento) => { subirLogo(evento.target.files?.[0]); evento.target.value = ""; }} />
              <Boton variante="secundario" className="min-h-12 !w-auto px-4 text-lg" ocupado={ocupado} icono={<ImageIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={() => archivo.current?.click()}>
                {negocio.logoUrl ? "Cambiar logo" : "Subir logo"}
              </Boton>
              {negocio.logoUrl && (
                <BotonConfirmar texto="Quitar" pregunta="Sí, quitar" ocupado={ocupado} alConfirmar={() => void guardar(() => api("/admin/negocio/logo", { metodo: "DELETE" }), "Logo quitado")} />
              )}
            </div>
          </div>
        </div>

        <Campo etiqueta="Nombre del negocio" value={nombre} onChange={(evento) => setNombre(evento.target.value)} maxLength={100} autoComplete="off" error={errores.nombre} />

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-bold text-tinta">Delivery y para llevar</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Envío normal (S/)" ayuda="Se puede cambiar en cada pedido" value={envio} onChange={(evento) => setEnvio(evento.target.value)} inputMode="decimal" autoComplete="off" error={errores.envio} />
            <Campo etiqueta="Cada taper (S/)" value={taper} onChange={(evento) => setTaper(evento.target.value)} inputMode="decimal" autoComplete="off" error={errores.taper} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold text-marino">Distritos a los que se reparte</p>
            {distritos.length === 0 ? (
              <p className="rounded-control bg-fondo px-4 py-3 text-base text-marino">Sin distritos, al tomar un delivery no se pregunta el distrito.</p>
            ) : (
              <ul aria-label="Distritos" className="divide-y-2 divide-borde border-y-2 border-borde">
                {distritos.map((distrito, i) => (
                  <li key={distrito} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 text-xl font-bold text-tinta">
                      {distrito}
                      {i === 0 && <span className="ml-2 text-base font-normal text-marino">· el que sale marcado</span>}
                    </span>
                    <BotonIcono
                      nombre={`Subir ${distrito}`}
                      icono={ArrowUpIcon}
                      disabled={i === 0}
                      onClick={() => setDistritos(distritos.map((d, j) => (j === i - 1 ? distrito : j === i ? distritos[i - 1] : d)))}
                    />
                    <BotonIcono nombre={`Quitar ${distrito}`} icono={TrashIcon} onClick={() => setDistritos(distritos.filter((d) => d !== distrito))} />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Campo
                  etiqueta="Otro distrito"
                  value={distritoNuevo}
                  onChange={(evento) => setDistritoNuevo(evento.target.value)}
                  // Enter agrega el distrito; no guarda todo el formulario
                  onKeyDown={(evento) => {
                    if (evento.key !== "Enter") return;
                    evento.preventDefault();
                    agregarDistrito();
                  }}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="Ej.: Morales"
                />
              </div>
              <Boton variante="secundario" className="!w-auto px-4" disabled={!distritoNuevo.trim()} icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={agregarDistrito}>
                Agregar
              </Boton>
            </div>
          </div>

          <Campo etiqueta="Región" ayuda="Completa la dirección al abrirla en el mapa" value={region} onChange={(evento) => setRegion(evento.target.value)} maxLength={100} autoComplete="off" placeholder="Ej.: San Martín, Perú" />
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-xl font-bold text-tinta">Avisos de tardanza en cocina</legend>
          <p className="mb-3 text-base text-pretty text-marino">Minutos desde que entra un pedido hasta que su tarjeta cambia de color.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Ámbar: tarda (min)" value={tarda} onChange={(evento) => setTarda(evento.target.value)} inputMode="numeric" autoComplete="off" error={errores.tarda} />
            <Campo etiqueta="Rojo: muy tarde (min)" value={muyTarde} onChange={(evento) => setMuyTarde(evento.target.value)} inputMode="numeric" autoComplete="off" error={errores.muyTarde} />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          {sinGuardar && (
            <p role="status" className="flex items-center gap-2 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
              <WarningIcon aria-hidden="true" weight="fill" className="size-6 shrink-0" />
              Hay cambios sin guardar
            </p>
          )}
          <Boton type="submit" disabled={hayErrores || !sinGuardar} ocupado={ocupado}>
            Guardar datos del negocio
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
