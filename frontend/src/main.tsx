import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import { App } from "./App";
import "./estilos.css";
import { clienteDeConsultas } from "./lib/consultas";
import { ProveedorSesion } from "./sesion/ProveedorSesion";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      {/* Quien pide menos movimiento en su sistema no ve desplazamientos */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ProveedorSesion>
            <App />
          </ProveedorSesion>
        </BrowserRouter>
        <Toaster
          position="top-center"
          mobileOffset={{ top: 76 }}
          toastOptions={{
            classNames: {
              toast: "!rounded-control !border-2 !border-borde !font-sans !text-lg !font-bold !text-tinta",
              error: "!border-peligro !text-peligro",
              // El botón del aviso ("Ver", "Deshacer") se acierta con el pulgar
              actionButton: "!h-12 !rounded-interior !bg-marino !px-4 !text-lg !font-bold !text-white",
            },
          }}
        />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
