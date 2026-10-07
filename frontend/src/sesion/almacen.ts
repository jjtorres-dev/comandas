// Lo único que se guarda en el dispositivo: el token y el código del negocio.
// El nombre y el logo del negocio se piden siempre a la API.

const CLAVE_TOKEN = "comandas.token";
const CLAVE_NEGOCIO = "comandas.negocio";

type Estado = { token: string | null; codigoNegocio: string | null };

const leer = (clave: string): string | null => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
};

const guardar = (clave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // sin almacenamiento la sesión dura lo que dure la pestaña
  }
};

let estado: Estado = { token: leer(CLAVE_TOKEN), codigoNegocio: leer(CLAVE_NEGOCIO) };
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  for (const oyente of oyentes) oyente();
}

export const almacen = {
  leer: () => estado,
  suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
  },
  fijarToken(token: string | null) {
    guardar(CLAVE_TOKEN, token);
    cambiar({ token });
  },
  fijarNegocio(codigoNegocio: string | null) {
    guardar(CLAVE_NEGOCIO, codigoNegocio);
    cambiar({ codigoNegocio });
  },
};
