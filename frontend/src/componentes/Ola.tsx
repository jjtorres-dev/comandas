// El borde ondulado con el que termina el campo turquesa en la carta impresa
export function Ola({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full translate-y-px text-fondo sm:h-14 ${className}`}
    >
      <path fill="currentColor" d="M0 34c210 52 420 44 660 12s520-52 780-4v38H0z" />
    </svg>
  );
}
