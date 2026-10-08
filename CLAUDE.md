# Comandas

Sistema de comandas (POS) para restaurantes y cevicherías, multi-negocio desde el
inicio. Primer cliente: "Cevichería Valentina" (Tarapoto, Perú).

## Estructura

- `backend/`: API REST + Socket.IO (Node.js, Express 5, Prisma 7, PostgreSQL).
  Sus reglas están en `backend/CLAUDE.md`; el contrato para el frontend, en
  `backend/docs/API.md`.
- `frontend/`: aplicación web (Vite, React, TypeScript, Tailwind CSS v4).
- `docker-compose.yml`: PostgreSQL 16 (puerto 5433 en el host) y Adminer (8080).
  Solo para desarrollo.
- `Dockerfile`, `.dockerignore` y `railway.json`: la imagen de producción, un
  solo servicio en el que el backend sirve también el frontend. Los pasos para
  Railway, los respaldos y cómo volver atrás están en `docs/DESPLIEGUE.md`.
- `PRODUCT.md`: quién usa el producto, en qué condiciones y con qué principios.
- `DESIGN.md`: sistema de diseño (colores, tipografía, componentes y reglas). Su
  complemento para herramientas está en `.impeccable/design.json`.
- `design-ref/`: logo y fotos de la carta de la Cevichería Valentina.
- `.agents/` y `.claude/skills/`: skills de diseño, versionadas.

Cada paquete tiene su propio `package.json` y su propio `node_modules`; no hay
workspace de npm en la raíz. El `package.json` de la raíz solo trae atajos
(`concurrently`).

## Cómo levantar todo

1. Base de datos, desde la raíz: `docker compose up -d`
2. Backend, desde `backend/`: copiar `.env.example` a `.env` la primera vez,
   `npm install`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`
   (puerto 3000).
3. Frontend, desde `frontend/`: copiar `.env.example` a `.env` la primera vez,
   `npm install` y `npm run dev` (puerto 5173, accesible desde la red local).

Con todo instalado y migrado, `npm run dev` desde la raíz (tras un `npm install`
ahí) levanta la base de datos, el backend y el frontend en una sola terminal.

Login de desarrollo: código `valentina`, usuarios `admin/admin123`,
`mozo/mozo123` y `cocina/cocina123`.

## Trabajo de UI

**Antes de cualquier trabajo de UI, leer `PRODUCT.md`.** Define los usuarios, sus
dispositivos y las condiciones reales de uso (hora punta, poca costumbre con
apps, pantallas con sol o grasa), y manda sobre cualquier preferencia estética.

Después, seguir `DESIGN.md`: los tokens están en `frontend/src/estilos.css`
(bloque `@theme` de Tailwind v4) y se usan por su rol (`bg-primario`,
`text-tinta`, `bg-listo-suave`), nunca con colores sueltos.

## Frontend

- Stack: Vite, React, TypeScript, Tailwind CSS v4, React Router, TanStack Query,
  socket.io-client, motion, sonner y vite-plugin-pwa. Íconos de Phosphor.
- Comandos, desde `frontend/`: `npm run dev`, `npm run build` (incluye
  `tsc -b`), `npm run lint` (oxlint) y `npm run e2e` (Playwright).
- `VITE_API_URL` vacío significa mismo origen: en desarrollo Vite reenvía
  `/api` y `/socket.io` al backend (`PROXY_BACKEND`), así que desde
  el celular basta con abrir `http://<ip-de-la-pc>:5173`.
- `src/lib/api.ts` es el único punto que habla con el backend: agrega el token,
  lanza `ErrorApi` con el `codigo` de `backend/docs/API.md` y, ante un 401 con
  sesión, la cierra y vuelve al login.
- `src/tiempo-real/useTiempoReal.ts` mantiene el Socket.IO y, con cada evento,
  invalida las consultas de `src/lib/consultas.ts` (`claves`). Las consultas
  nuevas de pedidos, mesas o caja deben colgar de esas claves.
- El nombre y el logo del negocio salen siempre de la API (`LogoNegocio`); en el
  dispositivo solo se guardan el token y el código del negocio.
- Rutas: `/login`, `/mozo/*` (MOZO y ADMIN), `/local/*` (LOCAL y ADMIN) y
  `/admin/*` (solo ADMIN). Al entrar (`inicioDe`): quien tiene LOCAL va a
  `/local`; el dueño que no cocina, a `/admin`; el mozo, a `/mozo`.
- App del mozo: pestañas `/mozo/mesas`, `/mozo/pedidos` y `/mozo/perfil`, y
  pantallas de una tarea `/mozo/tomar/:clave` (`mesa-<id>`, `llevar` o
  `pedido-<id>`), su `/resumen` y `/mozo/pedido/:id`. La clave de para llevar es
  `llevar-<id propio>`.
- `src/mozo/almacen.ts` guarda en el dispositivo, por usuario, los borradores
  (sin enviar) y la cola (enviados sin confirmar). "Enviar a cocina" nunca
  espera al servidor: encola con su `idCliente` o `idRonda` definitivo y
  `procesarCola` reintenta sola. Toda creación de pedidos o rondas del mozo
  pasa por ahí; las líneas se editan con las funciones puras de
  `src/mozo/lineas.ts` (las iguales se unen solas). Cada para llevar tiene su
  propio borrador (`llevar-<id>`). Las notas de un combo se envían como texto
  con el plato delante (`"Ceviche Simple: sin cebolla"`).
- Panel de cocina (`/local/cocina`): `src/local/comandas.ts` arma las comandas
  a partir de los pedidos activos (funciones puras), `acciones.ts` cambia
  estados siempre con "Deshacer", y `panel.ts` guarda lo que solo vale tras
  "Abrir cocina" (sonido, pantalla encendida, filtro de área). Los avisos de
  pedido nuevo (`useAvisosNuevos`) viven en `LayoutLocal`: suenan en cualquier
  pestaña del local y se repiten hasta que alguien toca la tarjeta o Empezar.
  Los umbrales de tardanza los fija el dueño y llegan con la carta
  (`carta.cocina`); `UMBRALES` de `comandas.ts` solo vale mientras carga.
- Caja (`/local/caja`): `paginas/local/Caja.tsx` y `paginas/local/caja/`
  (`CobrarPedido` con la cuenta y las formas de dividir, `FormularioCobro` con
  métodos, vuelto, pago mixto y atajos de teclado, `Cobrados` con las
  correcciones, `Turno` con abrir, la franja y cerrar). Las cuentas de la
  pantalla se hacen en céntimos enteros (`local/dinero.ts`); lo que vale es lo
  que responde el servidor. Las consultas de caja cuelgan de `claves.caja` y la
  cuenta y la nota de venta de `claves.pedidos`.
- Delivery (`/local/delivery`): `paginas/local/Delivery.tsx` y
  `paginas/local/delivery/` (`NuevoPedido`, `BuscadorDeCarta`, `Lineas`,
  `PagoPrevisto`, `Tablero`, `Modificar`, `Cobrar`, `Rendicion`). Reutiliza las
  líneas del mozo (`mozo/lineas.ts`), sus hojas de variantes, combos y notas
  (`componentes/pedido/`) y el cobro de Caja (`FormularioCobro`). Aquí no hay
  cola offline: "Enviar a cocina" espera la respuesta, con su `idCliente`. Los
  textos de WhatsApp, el link de Maps y el pago previsto en palabras están en
  `local/delivery.ts`.
- Administración (`/admin`): `layouts/LayoutAdmin.tsx` (secciones abajo en el
  celular, pestañas arriba en PC) y `paginas/admin/` (`Ventas`, `Carta` con
  `carta/PrecioEditable`, `FichaProducto` y `FichaCategoria`, `Personal`, y
  `Local` con `local/Lista` para mesas, motorizados y notas y
  `local/DatosDelNegocio`). Todo cambio pasa por `useGuardar`
  (`src/admin/guardar.ts`), que vuelve a pedir `claves.admin`, la carta, las
  mesas y la sesión. La lógica pura está en `src/admin/` (`producto.ts`,
  `ventas.ts`, `periodos.ts`: los días son los de America/Lima). Los gráficos
  (`paginas/admin/graficos.tsx`) siguen la guía `dataviz`: una serie, un color
  (`bg-dato`), valores siempre legibles sin hover. El evento
  `carta:actualizada` refresca la carta, las mesas, los motorizados y la sesión
  en todos los equipos; los umbrales de tardanza de cocina llegan en
  `GET /carta` (`cocina`).
- Fichas de `/admin`: todas usan `paginas/admin/Ficha.tsx`, que recibe
  `sinGuardar` y, al cerrar con cambios a medias, pregunta "Seguir aquí" o
  "Salir sin guardar" (igual que `Modificar` en Delivery).
- Versión nueva (PWA): el service worker está en modo `prompt`.
  `componentes/AvisoVersion.tsx` lo registra, pregunta por una versión nueva
  cada 15 minutos y al volver a la app, y muestra el aviso "Hay una versión
  nueva · Actualizar". **Nunca recarga solo**; los borradores y la cola del
  mozo están en el equipo y sobreviven a la recarga.
- Hojas inferiores: `HojaInferior` se ajusta al teclado (meta viewport con
  `interactive-widget=resizes-content` más `visualViewport`). Los avisos de
  sonner salen abajo, sobre la barra fija de cada pantalla, que publica su alto
  con `useEspacioAvisos`.
- Pruebas de punta a punta: `npm run e2e` desde `frontend/` (Playwright;
  `e2e/mozo.spec.ts` a 412×915, `e2e/cocina.spec.ts`, que abre al mozo y a la
  cocina a la vez, `e2e/caja.spec.ts` con el turno de caja completo, `e2e/delivery.spec.ts` con
  los pedidos por teléfono y `e2e/admin.spec.ts` con la administración). **No tocan la base de desarrollo**: Playwright levanta su
  propio backend (`npm run e2e:servidor` en `backend/`, puerto 3100, base
  `comandas_e2e` con migraciones y seed en cada corrida) y su propio Vite
  (puerto 5183). Solo hace falta el contenedor de Postgres.
- La PWA se llama "Comandas" y sus íconos son genéricos (`frontend/public/`).

## Producción

- `podman build -t comandas .` desde la raíz construye la imagen. Para probarla
  se usa una base de prueba, nunca la de desarrollo: al arrancar aplica las
  migraciones (ver el final de `docs/DESPLIEGUE.md`).
- En producción todo sale del mismo origen: `VITE_API_URL` va vacío.

## Convenciones

- El código y los comentarios van en español.
- Si cambia una ruta, un body, una respuesta o un código de error del backend,
  se actualiza `backend/docs/API.md` en el mismo cambio.
