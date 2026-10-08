import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Autenticado, IrAlInicio, SoloRoles } from "./layouts/Autenticado";
import { LayoutLocal } from "./layouts/LayoutLocal";
import { LayoutMozo } from "./layouts/LayoutMozo";
import { ProveedorMozo } from "./layouts/ProveedorMozo";
import { PantallaCarga } from "./componentes/PantallaCarga";
import { Login } from "./paginas/Login";
import { Caja } from "./paginas/local/Caja";
import { Cocina } from "./paginas/local/Cocina";
import { Delivery } from "./paginas/local/Delivery";
import { Mesas } from "./paginas/mozo/Mesas";
import { Pedidos } from "./paginas/mozo/Pedidos";
import { DetallePedido } from "./paginas/mozo/DetallePedido";
import { Perfil } from "./paginas/mozo/Perfil";
import { Resumen } from "./paginas/mozo/Resumen";
import { TomarPedido } from "./paginas/mozo/TomarPedido";

// La administración se descarga aparte: el celular del mozo no la necesita
const LayoutAdmin = lazy(() => import("./layouts/LayoutAdmin").then((m) => ({ default: m.LayoutAdmin })));
const Ventas = lazy(() => import("./paginas/admin/Ventas").then((m) => ({ default: m.Ventas })));
const Carta = lazy(() => import("./paginas/admin/Carta").then((m) => ({ default: m.Carta })));
const Personal = lazy(() => import("./paginas/admin/Personal").then((m) => ({ default: m.Personal })));
const Local = lazy(() => import("./paginas/admin/Local").then((m) => ({ default: m.Local })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Autenticado />}>
        <Route element={<SoloRoles roles={["MOZO", "ADMIN"]} />}>
          <Route element={<ProveedorMozo />}>
            <Route path="/mozo" element={<LayoutMozo />}>
              <Route index element={<Navigate to="mesas" replace />} />
              <Route path="mesas" element={<Mesas />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="perfil" element={<Perfil />} />
            </Route>
            {/* Pantallas de una sola tarea: sin navegación inferior */}
            <Route path="/mozo/tomar/:clave" element={<TomarPedido />} />
            <Route path="/mozo/tomar/:clave/resumen" element={<Resumen />} />
            <Route path="/mozo/pedido/:id" element={<DetallePedido />} />
          </Route>
        </Route>

        <Route element={<SoloRoles roles={["LOCAL", "ADMIN"]} />}>
          <Route path="/local" element={<LayoutLocal />}>
            <Route index element={<Navigate to="cocina" replace />} />
            <Route path="cocina" element={<Cocina />} />
            <Route path="caja" element={<Caja />} />
            <Route path="delivery" element={<Delivery />} />
          </Route>
        </Route>

        {/* Administración: solo el dueño */}
        <Route element={<SoloRoles roles={["ADMIN"]} />}>
          <Route path="/admin" element={<Suspense fallback={<PantallaCarga />}><LayoutAdmin /></Suspense>}>
            <Route index element={<Navigate to="ventas" replace />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="carta" element={<Carta />} />
            <Route path="personal" element={<Personal />} />
            <Route path="local" element={<Local />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<IrAlInicio />} />
    </Routes>
  );
}
