// Gráficos de Ventas. Un solo color para los datos (`dato`): son siempre una
// sola serie, así que el título dice qué se mide y no hace falta leyenda.
// Todo valor se puede leer sin pasar el dedo: en la barra, o en la tabla.
import type { ReactNode } from "react";

export type Dato = {
  clave: string;
  // Texto corto bajo la columna ("7", "13 h"); vacío para no rotularla
  eje: string;
  // Nombre completo, para el detalle y la tabla ("miércoles, 7 de octubre")
  nombre: string;
  valor: number;
  // El valor ya escrito ("S/ 430.00", "9 pedidos")
  texto: string;
};

// Columnas sobre una línea base: ventas por día, pedidos por hora
export function Columnas({ datos, medida, categoria }: { datos: Dato[]; medida: string; categoria: string }) {
  const maximo = Math.max(...datos.map((d) => d.valor), 0);
  const elMayor = datos.findIndex((d) => d.valor === maximo);
  // Hacia qué lado se abre el detalle, para que no se salga del gráfico
  // (con pocas columnas cada una es ancha y el detalle cabe centrado)
  const lado = (i: number) =>
    datos.length <= 8 ? "left-1/2 -translate-x-1/2" : i < datos.length / 3 ? "left-0" : i >= (datos.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <figure className="flex flex-col gap-3">
      <div>
        {/* El alto incluye el aire para rotular la columna más alta */}
        <div className="flex h-52 items-stretch gap-0.5 border-b border-borde-fuerte pt-8">
          {datos.map((dato, i) => {
            const alto = maximo > 0 ? (dato.valor / maximo) * 100 : 0;
            return (
              <div
                key={dato.clave}
                tabIndex={0}
                role="img"
                aria-label={`${dato.nombre}: ${dato.texto}`}
                className="group relative flex min-w-0 flex-1 cursor-default items-end justify-center rounded-t-sm outline-offset-0 hover:bg-fondo focus:bg-fondo"
              >
                {dato.valor > 0 && <div className="w-full max-w-6 rounded-t-sm bg-dato group-hover:bg-primario-profundo group-focus:bg-primario-profundo" style={{ height: `${alto}%` }} />}
                {/* Solo se rotula la columna más alta: el resto se lee en el detalle o en la tabla */}
                {i === elMayor && maximo > 0 && (
                  <span aria-hidden="true" className={`absolute mb-1 text-base font-bold whitespace-nowrap text-tinta group-hover:invisible group-focus:invisible ${lado(i)}`} style={{ bottom: `${alto}%` }}>
                    {dato.texto}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute z-10 mb-2 hidden rounded-interior bg-marino px-3 py-2 text-base whitespace-nowrap text-white group-hover:block group-focus:block ${lado(i)}`}
                  style={{ bottom: `${alto}%` }}
                >
                  <strong className="block text-lg">{dato.texto}</strong>
                  {dato.nombre}
                </span>
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="flex gap-0.5 pt-1">
          {datos.map((dato) => (
            <span key={dato.clave} className="flex min-w-0 flex-1 justify-center text-base whitespace-nowrap text-marino tabular-nums">
              {dato.eje}
            </span>
          ))}
        </div>
      </div>
      <details className="text-base text-marino">
        <summary className="inline-flex min-h-12 cursor-pointer items-center rounded-control px-2 font-bold underline decoration-2 underline-offset-4 hover:bg-primario-suave">Ver en tabla</summary>
        <table className="mt-2 w-full max-w-md text-lg">
          <thead>
            <tr className="border-b-2 border-borde text-left text-base">
              <th scope="col" className="py-2 pr-4 font-bold">{categoria}</th>
              <th scope="col" className="py-2 text-right font-bold">{medida}</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((dato) => (
              <tr key={dato.clave} className="border-b border-borde">
                <th scope="row" className="py-2 pr-4 text-left font-normal">{dato.nombre}</th>
                <td className="py-2 text-right font-bold text-tinta tabular-nums">{dato.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export type Fila = { clave: string; nombre: string; valor: number; texto: string; detalle?: string };

// Barras horizontales con el nombre y el valor escritos: formas de pago, platos
export function Barras({ filas, titulo }: { filas: Fila[]; titulo: string }) {
  const maximo = Math.max(...filas.map((f) => f.valor), 0);

  return (
    <ul aria-label={titulo} className="flex flex-col gap-3">
      {filas.map((fila) => (
        <li key={fila.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
          <span className="text-lg leading-tight text-tinta">{fila.nombre}</span>
          <span className="text-right text-lg font-bold text-tinta tabular-nums">
            {fila.texto}
            {fila.detalle && <span className="ml-2 text-base font-normal text-marino">{fila.detalle}</span>}
          </span>
          <span aria-hidden="true" className="col-span-2 flex h-4 border-l border-borde-fuerte">
            {fila.valor > 0 && <span className="rounded-r-sm bg-dato" style={{ width: `${(fila.valor / maximo) * 100}%` }} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Una cifra con su nombre
export function Cifra({ nombre, valor, detalle }: { nombre: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-panel border-2 border-borde bg-superficie px-4 py-3 lg:px-5 lg:py-4">
      <dt className="text-lg text-marino">{nombre}</dt>
      <dd className="text-3xl leading-none font-bold text-tinta">{valor}</dd>
      {detalle && <dd className="text-base text-pretty text-marino">{detalle}</dd>}
    </div>
  );
}
