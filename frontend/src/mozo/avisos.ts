// Aviso de "pedido listo": vibración y un sonido corto generado en el
// propio celular (sin archivos de audio).

let contexto: AudioContext | null = null;

// El navegador solo deja sonar después de un toque del usuario: con el
// primero se crea (o se reanuda) el contexto de audio.
export function prepararSonido(): () => void {
  const activar = () => {
    try {
      contexto ??= new AudioContext();
      if (contexto.state === "suspended") void contexto.resume();
    } catch {
      // sin audio: quedan la vibración y el aviso en pantalla
    }
  };
  window.addEventListener("pointerdown", activar, { passive: true });
  return () => window.removeEventListener("pointerdown", activar);
}

function tono(audio: AudioContext, frecuencia: number, inicio: number, duracion: number) {
  const oscilador = audio.createOscillator();
  const volumen = audio.createGain();
  oscilador.type = "sine";
  oscilador.frequency.value = frecuencia;
  volumen.gain.setValueAtTime(0.0001, inicio);
  volumen.gain.exponentialRampToValueAtTime(0.4, inicio + 0.02);
  volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  oscilador.connect(volumen).connect(audio.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion);
}

export function avisarListo() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // algunos navegadores bloquean la vibración sin interacción previa
  }
  if (!contexto) return;
  // Tras pasar por segundo plano el audio queda en pausa: se intenta reanudar
  if (contexto.state !== "running") void contexto.resume().catch(() => {});
  const ahora = contexto.currentTime;
  tono(contexto, 880, ahora, 0.16);
  tono(contexto, 1320, ahora + 0.18, 0.22);
}
