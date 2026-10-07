# Backend de Comandas

API REST y tiempo real del sistema de comandas. La visión general del monorepo
está en `../CLAUDE.md`. Todos los comandos de este archivo se ejecutan desde
`backend/`.

## Stack

- Node.js + Express 5 + TypeScript (ESM)
- PostgreSQL 16 en Docker (`../docker-compose.yml`): puerto 5433 en el host (el 5432
  lo usa otro proyecto), con Adminer en el puerto 8080
- Prisma 7.10 con `@prisma/adapter-pg`
- Validación con zod, auth con JWT, tiempo real con Socket.IO
- Pruebas de integración con vitest + supertest

## Comandos

- `npm run dev`: servidor con recarga (`tsx watch src/server.ts`), puerto `PORT` (3000)
- `npm test`: pruebas contra la base `comandas_test` (se crea y migra sola en el
  mismo contenedor; cada prueba vacía sus tablas)
- `npm run db:up`: levanta Postgres y Adminer (usa `../docker-compose.yml`)
- `npm run db:migrate`: `prisma migrate dev && prisma generate`
- `npm run e2e:servidor`: servidor para las pruebas E2E del frontend
  (`scripts/e2e.ts`): base `comandas_e2e` recién migrada y con el seed, puerto
  3100. Lo levanta Playwright; no toca la base de desarrollo
- `npm run db:studio`: Prisma Studio
- `npm run db:seed`: ejecuta `prisma/seed.ts`. Borra y recrea todos los datos de
  la Cevichería Valentina (incluidos pedidos, pagos y turnos de caja). Aborta si
  `NODE_ENV=production`. Login de desarrollo: código `valentina`, usuarios
  `admin/admin123`, `mozo/mozo123`, `cocina/cocina123`

## Prisma 7

- La URL de conexión va en `prisma.config.ts` (lee `DATABASE_URL` de `.env`), no en
  `schema.prisma`.
- Generator `prisma-client` con salida en `src/generated/prisma` (ignorado por git).
  El cliente se importa desde ahí, no desde `@prisma/client`.
- `package.json` tiene `overrides` de `mysql2` y `deepmerge-ts` (dependencias fijas
  del CLI de Prisma con avisos de `npm audit`). Quitarlos cuando Prisma las actualice.

## Migraciones

- Cada cambio de schema va en su propia migración con nombre claro.
- `prisma migrate dev` falla sin terminal interactiva cuando la migración necesita
  confirmación (p. ej. columna obligatoria en una tabla con filas). En ese caso:
  escribir el SQL a mano en `prisma/migrations/<fecha>_<nombre>/migration.sql`
  (con relleno de las filas existentes), aplicarlo con `npx prisma migrate deploy`,
  comprobar que no hay diferencias con
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
  y regenerar el cliente con `npx prisma generate`.

## Backend

- `src/server.ts` (HTTP + Socket.IO) y `src/app.ts` (Express, sin escuchar: es lo que
  usan las pruebas). Cada módulo vive en `src/modules/<modulo>/` con `routes`,
  `controller` (valida con zod y responde), `service` (reglas y Prisma) y `schemas`.
- **Regla de oro**: el `negocioId` SIEMPRE sale del token (`sesionDe(req).negocioId`),
  nunca del body ni de la URL, y toda consulta filtra por él. Un recurso de otro
  negocio responde 404, como si no existiera.
- Login con `{codigoNegocio, usuario, password}` (`Negocio.codigo` es único; el
  usuario solo es único dentro de su negocio). Máximo 5 intentos fallidos por
  minuto por IP.
- Marca del negocio: `Negocio.logoUrl` es una ruta bajo `/uploads` (o una URL
  absoluta). `public/uploads/` se sirve en `/uploads` sin autenticación. El login,
  `GET /api/auth/yo` y `GET /api/negocios/:codigo/publico` (público, 30 consultas
  por minuto por IP, solo `{nombre, logoUrl}`) devuelven el nombre y el logo.
- `requireAuth` consulta la base en cada request: si el usuario o su negocio están
  inactivos, o sus roles ya no son los del token, responde 401.
- Roles: MOZO, LOCAL y ADMIN operan pedidos; caja, cobros y cargos son solo de
  LOCAL y ADMIN.
- CORS: `FRONTEND_URL` y, solo con `NODE_ENV=development`, orígenes `192.168.x.x`
  (`src/config/cors.ts`, compartido con Socket.IO).
- `TRUST_PROXY` configura "trust proxy" de Express: vacío en desarrollo, `1` en
  Railway. Sin él, el límite de login vería a todos con la IP del proxy.
- `docs/API.md` documenta todos los endpoints y eventos; es la referencia para el
  frontend. **Actualizarlo en el mismo cambio** cuando se toque una ruta, un body,
  una respuesta o un código de error.
- Todo lo que modifica un pedido usa `src/modules/pedidos/pedidos.core.ts`:
  bloquear la fila (`bloquearPedido`), llamar a `recalcular` al final (totales,
  estado y si quedó pagado) y `publicar` después del commit.
- Idempotencia: `Pedido.idCliente` al crear y `PedidoItem.idRonda` al agregar una
  ronda; ambos son UUID que genera el cliente. La primera ronda usa el `idCliente`.
- `PedidoItem.listoEn` guarda cuándo se marcó LISTO (`fijarEstado` en
  `pedidos.service.ts`): null al volver a PENDIENTE o PREPARANDO, se conserva
  al entregar.
- Una ronda puede traer `nota`: se agrega a `Pedido.nota` con `" · "`, nunca la
  reemplaza (un pedido nuevo que entra como ronda no pierde su nota general).
- Errores: lanzar `ErrorApp` (`src/lib/errores.ts`); el middleware responde
  `{ error: { codigo, mensaje, ... } }` con el mensaje en español.
- Los montos viajan en el JSON como texto con 2 decimales (`"25.00"`).
- Precios y nombres de un pedido salen siempre de la base, nunca del cliente.
- Los eventos de Socket.IO (`pedido:creado`, `pedido:actualizado`, `caja:actualizada`)
  se emiten a la sala `negocio:<id>` después de confirmar la transacción.
- Delivery y para llevar: el teléfono se guarda normalizado (solo dígitos, sin el
  51). Con teléfono se hace upsert de `Cliente`; nombre, teléfono, dirección y
  referencia se copian al pedido.
- Tapers: `Producto.tapers` dice cuántos ocupa una unidad (bebidas 0, combos 2 o 3,
  el resto 1). La cantidad del pedido es la suma de `cantidad × tapers` de los
  items no cancelados y se recalcula (`recalcularTapers`) al crear, agregar una
  ronda o cancelar un item, salvo que `Pedido.tapersManual` sea true (cantidad
  fijada al crear o con `/cargos`; `cantidadTapers: null` en `/cargos` la libera).
- Caja: un solo turno abierto por negocio. `Pago.monto` es neto de vuelto
  (`recibido - monto` = vuelto), así que efectivo esperado = monto inicial +
  efectivo cobrado. Un pedido queda pagado cuando lo cobrado iguala el total; eso
  libera la mesa. `Pago.itemIds` marca qué items cubre un pago al dividir la
  cuenta y `Pago.unidades` cuántas unidades de cada uno; los pagos de un mismo
  cobro comparten `grupoId` (`unidadesPagadas` en `pagos.service.ts`).
- Un pago nunca se borra: se anula (`anuladoEn`, `anuladoPorId`,
  `motivoAnulacion`) o se le cambia el método, solo mientras su turno siga
  abierto, y cada corrección deja una fila en `PagoCambio`. **Toda consulta que
  sume pagos filtra `anuladoEn: null`.** Anular reabre el pedido; si su mesa ya
  tiene otro pedido abierto queda con `Pedido.mesaLiberada` y no la ocupa.

## Reglas del modelo de datos

- **Multi-negocio**: todo modelo cuelga de `negocioId`, directamente o a través de
  su padre (p. ej. `VarianteProducto` y `ComboOpcion` vía `Producto`, `PedidoItem`
  y `Pago` vía `Pedido`). Toda consulta debe filtrar por negocio.
- **Copias históricas**: precios y nombres se copian al `PedidoItem`
  (`nombreProducto`, `precioUnitario`, `componentes`) al crear el pedido. Cambiar
  la carta después no altera pedidos pasados. Lo mismo con los datos de entrega,
  `costoEnvio` y `cargoTapers` en `Pedido`.
- **Total del pedido**: `total = subtotal + costoEnvio + cargoTapers - descuento`.
  Los tapers aplican a `DELIVERY` y `PARA_LLEVAR`; el envío solo a `DELIVERY`. En
  `MESA` ambos son siempre 0.
- **Combos**: un `Producto` con `esCombo = true` y `comboCantidad` (2 = doble,
  3 = triple). Sus platos elegibles están en `ComboOpcion`; lo elegido se guarda
  como texto en `PedidoItem.componentes`.
- Los montos son `Decimal(10,2)`.

## Convenciones

- El código y los comentarios van en español.
