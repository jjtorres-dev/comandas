import { WifiSlashIcon } from "@phosphor-icons/react";
import { mensajeDe } from "../lib/api";
import { Boton } from "./Boton";

// Una consulta falló y no hay nada guardado que mostrar: qué pasó y cómo seguir
export function ErrorDeCarga({ error, alReintentar }: { error: unknown; alReintentar: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-panel border-2 border-borde-fuerte bg-superficie px-6 py-8 text-center">
      <WifiSlashIcon aria-hidden="true" weight="bold" className="size-12 text-alerta-fuerte" />
      <p className="max-w-[32ch] text-xl font-bold text-pretty text-tinta">{mensajeDe(error)}</p>
      <Boton onClick={alReintentar}>Reintentar</Boton>
    </div>
  );
}

// Bloques grises con la forma de lo que va a llegar
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-borde/60 ${className}`} />;
}
