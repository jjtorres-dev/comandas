# Comandas

Sistema de comandas (POS) para restaurantes y cevicherías, multi-negocio desde el
inicio. Primer cliente: "Cevichería Valentina" (Tarapoto, Perú).

## Estructura

- `backend/`: API REST + Socket.IO (Node.js, Express 5, Prisma 7, PostgreSQL).
  Sus reglas están en `backend/CLAUDE.md`; el contrato para el frontend, en
  `backend/docs/API.md`.
- `frontend/`: aplicación web (Vite, React, TypeScript, Tailwind CSS v4).
- `docker-compose.yml`: PostgreSQL 16 (puerto 5433 en el host) y Adminer (8080).
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
  `/api`, `/uploads` y `/socket.io` al backend (`PROXY_BACKEND`), así que desde
  el celular basta con abrir `http://<ip-de-la-pc>:5173`.
- `src/lib/api.ts` es el único punto que habla con el backend: agrega el token,
  lanza `ErrorApi` con el `codigo` de `backend/docs/API.md` y, ante un 401 con
  sesión, la cierra y vuelve al login.
- `src/tiempo-real/useTiempoReal.ts` mantiene el Socket.IO y, con cada evento,
  invalida las consultas de `src/lib/consultas.ts` (`claves`). Las consultas
  nuevas de pedidos, mesas o caja deben colgar de esas claves.
- El nombre y el logo del negocio salen siempre de la API (`LogoNegocio`); en el
  dispositivo solo se guardan el token y el código del negocio.
- Rutas: `/login`, `/mozo/*` (MOZO y ADMIN) y `/local/*` (LOCAL y ADMIN).
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
  Los umbrales de tardanza están en `UMBRALES` de `comandas.ts`.
- Caja (`/local/caja`): `paginas/local/Caja.tsx` y `paginas/local/caja/`
  (`CobrarPedido` con la cuenta y las formas de dividir, `FormularioCobro` con
  métodos, vuelto, pago mixto y atajos de teclado, `Cobrados` con las
  correcciones, `Turno` con abrir, la franja y cerrar). Las cuentas de la
  pantalla se hacen en céntimos enteros (`local/dinero.ts`); lo que vale es lo
  que responde el servidor. Las consultas de caja cuelgan de `claves.caja` y la
  cuenta y la nota de venta de `claves.pedidos`.
- Hojas inferiores: `HojaInferior` se ajusta al teclado (meta viewport con
  `interactive-widget=resizes-content` más `visualViewport`). Los avisos de
  sonner salen abajo, sobre la barra fija de cada pantalla, que publica su alto
  con `useEspacioAvisos`.
- Pruebas de punta a punta: `npm run e2e` desde `frontend/` (Playwright;
  `e2e/mozo.spec.ts` a 412×915, `e2e/cocina.spec.ts`, que abre al mozo y a la
  cocina a la vez, y `e2e/caja.spec.ts` con el turno de caja completo). **No tocan la base de desarrollo**: Playwright levanta su
  propio backend (`npm run e2e:servidor` en `backend/`, puerto 3100, base
  `comandas_e2e` con migraciones y seed en cada corrida) y su propio Vite
  (puerto 5183). Solo hace falta el contenedor de Postgres.
- La PWA se llama "Comandas" y sus íconos son genéricos (`frontend/public/`).

## Convenciones

- El código y los comentarios van en español.
- Si cambia una ruta, un body, una respuesta o un código de error del backend,
  se actualiza `backend/docs/API.md` en el mismo cambio.
