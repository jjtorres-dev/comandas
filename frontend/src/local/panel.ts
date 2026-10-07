// El panel de cocina: el sonido de los pedidos nuevos y la pantalla
// encendida. Los dos necesitan un toque del usuario para activarse
// ("Abrir cocina"), y se pierden al recargar la página.
import { useSyncExternalStore } from "react";

type Estado = {
  abierta: boolean;
  // Si el navegador dejó mantener la pantalla encendida
  pantalla: "pendiente" | "encendida" | "no-disponible";
  // false si el equipo no pudo activar el sonido de los avisos
  sonido: boolean;
  // Área que filtra el panel de cocina (null = todas). Los avisos la respetan.
  areaId: string | null;
  // Rondas ("pedido:ronda") cuyo aviso ya se atendió con un toque: no vuelven a
  // sonar. Una ronda posterior del mismo pedido sí avisa.
  silenciados: ReadonlySet<string>;
  // Pedidos que llegaron con el panel abierto: su tarjeta entra con un destello
  recienLlegados: ReadonlySet<string>;
};

const CLAVE_AREA = "comandas.cocina.area";

const leerArea = (): string | null => {
  try {
    return localStorage.getItem(CLAVE_AREA);
  } catch {
    return null;
  }
};

let estado: Estado = { abierta: false, pantalla: "pendiente", sonido: true, areaId: leerArea(), silenciados: new Set(), recienLlegados: new Set() };
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  for (const oyente of oyentes) oyente();
}

export const usePanel = (): Estado =>
  useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    () => estado,
  );

let audio: AudioContext | null = null;
let bloqueo: WakeLockSentinel | null = null;

async function mantenerPantalla() {
  if (!("wakeLock" in navigator)) return cambiar({ pantalla: "no-disponible" });
  try {
    bloqueo = await navigator.wakeLock.request("screen");
    cambiar({ pantalla: "encendida" });
    // El sistema lo suelta al cambiar de pestaña o minimizar
    bloqueo.addEventListener("release", () => {
      bloqueo = null;
    });
  } catch {
    // Ahorro de batería, permiso negado…
    cambiar({ pantalla: "no-disponible" });
  }
}

// Al volver a la pestaña, la pantalla encendida y el audio hay que pedirlos otra vez
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !estado.abierta) return;
  if (!bloqueo) void mantenerPantalla();
  if (audio?.state === "suspended") void audio.resume().catch(() => {});
});

// Se llama desde el botón "Abrir cocina": ese toque es el permiso del navegador
export function abrirCocina() {
  let sonido = true;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => cambiar({ sonido: false }));
  } catch {
    // sin audio quedan el destello y la etiqueta NUEVO, y se avisa en pantalla
    sonido = false;
  }
  cambiar({ abierta: true, sonido });
  void mantenerPantalla();
  // Un aviso de muestra: confirma que el sonido funciona y cómo suena
  sonarNuevo();
}

function tono(contexto: AudioContext, frecuencia: number, inicio: number, duracion: number) {
  const oscilador = contexto.createOscillator();
  const volumen = contexto.createGain();
  // Onda triangular: más presente que la del aviso de "listo" del mozo, para una cocina con ruido
  oscilador.type = "triangle";
  oscilador.frequency.value = frecuencia;
  volumen.gain.setValueAtTime(0.0001, inicio);
  volumen.gain.exponentialRampToValueAtTime(0.9, inicio + 0.02);
  volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  oscilador.connect(volumen).connect(contexto.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion);
}

// Pedido nuevo: tres tonos que suben. Distinto del de "listo" (dos tonos cortos).
export function sonarNuevo() {
  if (!audio) return;
  if (audio.state !== "running") void audio.resume().catch(() => {});
  const ahora = audio.currentTime;
  tono(audio, 660, ahora, 0.28);
  tono(audio, 880, ahora + 0.3, 0.28);
  tono(audio, 1175, ahora + 0.6, 0.5);
}

export function fijarArea(areaId: string | null) {
  try {
    if (areaId === null) localStorage.removeItem(CLAVE_AREA);
    else localStorage.setItem(CLAVE_AREA, areaId);
  } catch {
    // sin almacenamiento el filtro dura lo que dure la pestaña
  }
  cambiar({ areaId });
}

// Un toque en la tarjeta: "ya lo vi", esas rondas dejan de sonar
export function silenciar(claves: string[]) {
  const nuevas = claves.filter((c) => !estado.silenciados.has(c));
  if (nuevas.length === 0) return;
  cambiar({ silenciados: new Set([...estado.silenciados, ...nuevas]) });
}

// El destello es de una sola vez: pasado un momento, la tarjeta ya no lo repite
// (por ejemplo, al volver de la pestaña Caja)
export function marcarLlegada(pedidoId: string) {
  cambiar({ recienLlegados: new Set(estado.recienLlegados).add(pedidoId) });
  setTimeout(() => {
    const quedan = new Set(estado.recienLlegados);
    quedan.delete(pedidoId);
    cambiar({ recienLlegados: quedan });
  }, 2000);
}
