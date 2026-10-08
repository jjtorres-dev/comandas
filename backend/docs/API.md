# API de Comandas

Referencia de todos los endpoints HTTP y eventos de Socket.IO del backend.

- [Convenciones](#convenciones)
- [Objetos](#objetos): [Pedido](#pedido) · [Turno de caja](#turno-de-caja)
- [Auth](#auth) · [Negocios](#negocios) · [Carta](#carta) · [Mesas](#mesas) · [Clientes](#clientes) · [Repartidores](#repartidores)
- [Pedidos](#pedidos) · [Cuenta y pagos](#cuenta-y-pagos) · [Caja](#caja)
- [Tiempo real (Socket.IO)](#tiempo-real-socketio)
- [Resumen de endpoints](#resumen-de-endpoints)

## Convenciones

| Tema | Regla |
|---|---|
| URL base | `http://localhost:3000/api` en desarrollo |
| Formato | JSON en peticiones y respuestas (`Content-Type: application/json`). Cuerpo máximo: 100 kB |
| Autenticación | `Authorization: Bearer <token>` en todo excepto `POST /auth/login`, `GET /negocios/:codigo/publico`, `GET /negocios/:codigo/logo` y `GET /salud` |
| Negocio | Sale siempre del token. Ningún endpoint recibe `negocioId` |
| Montos (respuesta) | Texto con 2 decimales: `"25.00"` |
| Montos (petición) | Número con 2 decimales como máximo: `25` o `25.5` |
| Fechas | ISO 8601 en UTC: `"2026-10-07T15:39:12.123Z"` |
| Ids | UUID. Un id mal formado responde 400 |
| Campos desconocidos | Se ignoran (por ejemplo, un `precio` enviado por el cliente) |
| Archivos | El logo de cada negocio se guarda en la base y se sirve sin autenticación en `GET /api/negocios/:codigo/logo` (ver [Negocios](#negocios)). El servidor no sirve archivos de disco |

**Producción.** El mismo servidor entrega la aplicación web, así que la API y
Socket.IO están en su mismo origen (`/api` y `/socket.io`) y no hay CORS. En
desarrollo se acepta el origen de `FRONTEND_URL` y las IPs `192.168.x.x`.

**Cabeceras.** Toda respuesta trae `X-Request-Id` (el id con el que esa petición
aparece en los registros del servidor; si la petición ya trae uno, se respeta) y
las cabeceras de seguridad de helmet, con una Content-Security-Policy que solo
permite recursos del propio origen. Las respuestas de `/api` llevan
`Cache-Control: no-store`, salvo el logo.

**Roles**: `ADMIN` (dueño), `MOZO` (toma pedidos), `LOCAL` (cocina y caja). Donde
dice "cualquiera" basta con estar autenticado.

**La sesión se valida en cada petición.** El token dura 12 horas, pero deja de
valer antes (401) si el usuario o su negocio se desactivan, o si le cambian los
roles. Ante cualquier 401 el frontend debe llevar al login.

**CORS**: se acepta el origen `FRONTEND_URL` y, solo en desarrollo, cualquier
`http(s)://192.168.x.x[:puerto]`.

### Errores

Todos los errores tienen la misma forma, con el mensaje en español listo para
mostrar:

```json
{ "error": { "codigo": "MESA_OCUPADA", "mensaje": "Mesa 3 ya tiene un pedido abierto. Agrega los items a ese pedido", "pedidoId": "…" } }
```

Algunos códigos traen campos extra (como `pedidoId` arriba); se indican en cada
endpoint. Estos pueden salir en cualquiera:

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | El cuerpo, la query o un id no pasan la validación. Trae `detalles: [{ campo, mensaje }]` (`campo` como `"items.0.cantidad"`) |
| 400 | `SOLICITUD_INVALIDA` | Los datos están bien formados pero rompen una regla (combo mal armado, producto no disponible…) |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON |
| 401 | `NO_AUTENTICADO` | Falta el token, es inválido, venció, o la sesión ya no es válida |
| 403 | `SIN_PERMISO` | El rol no alcanza para esa acción |
| 404 | `NO_ENCONTRADO` | El recurso no existe **o es de otro negocio**, o la ruta no existe |
| 409 | varios | Conflicto con el estado actual; ver cada endpoint |
| 413 | `CUERPO_MUY_GRANDE` | Cuerpo de más de 100 kB (1 MB al subir el logo) |
| 429 | `DEMASIADOS_INTENTOS` | Límite de intentos de login o de consultas públicas de negocio |
| 500 | `ERROR_INTERNO` | Error inesperado. Trae `idPeticion` (el mismo `X-Request-Id`) para encontrar el detalle en los registros del servidor; la respuesta nunca incluye la traza |
| 503 | `BASE_NO_DISPONIBLE` | Solo en `GET /salud`: el servidor no llega a la base de datos |

## Objetos

### Pedido

Lo devuelven todos los endpoints que crean o modifican un pedido, `GET
/pedidos/activos` y los eventos `pedido:creado` / `pedido:actualizado`.

```json
{
  "id": "295c648d-b469-4e41-b945-c7c48c8b9e74",
  "numero": 1,
  "tipo": "DELIVERY",
  "estado": "PENDIENTE",
  "mesa": null,
  "mesaLiberada": false,
  "mozo": { "id": "…", "nombre": "Mozo" },
  "cliente": { "nombre": "Rosa Pérez", "telefono": "987654321" },
  "direccionEntrega": "Jr. San Martín 245",
  "distritoEntrega": "Morales",
  "referenciaEntrega": "Frente al parque",
  "pagoPrevisto": { "momento": "AL_RECIBIR", "metodo": "EFECTIVO", "pagaCon": "150.00", "vuelto": "32.00" },
  "motivoCancelacion": null,
  "repartidor": null,
  "nota": null,
  "subtotal": "110.00",
  "costoEnvio": "3.00",
  "cantidadTapers": 5,
  "tapersManual": false,
  "cargoTapers": "5.00",
  "descuento": "0.00",
  "total": "118.00",
  "totalPagado": "0.00",
  "saldoPendiente": "118.00",
  "pagado": false,
  "pagadoEn": null,
  "creadoEn": "2026-10-07T15:39:12.123Z",
  "items": [
    {
      "id": "…",
      "varianteId": "…",
      "areaId": "…",
      "cantidad": 1,
      "estado": "PENDIENTE",
      "nombreProducto": "Combo Triple",
      "precioUnitario": "38.00",
      "notas": ["Ají aparte"],
      "componentes": ["Ceviche Simple", "Arroz con Mariscos", "Chicharrón de Pescado"],
      "orden": 2,
      "idRonda": "…",
      "creadoEn": "2026-10-07T15:39:12.123Z",
      "listoEn": null
    }
  ]
}
```

| Campo | Notas |
|---|---|
| `numero` | Correlativo diario por negocio; reinicia a medianoche de `America/Lima` |
| `tipo` | `MESA`, `DELIVERY` o `PARA_LLEVAR` |
| `estado` | `PENDIENTE`, `PREPARANDO`, `LISTO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO` (ver abajo) |
| `mesa` | `{ id, nombre }` en `MESA`; `null` en los demás |
| `mesaLiberada` | `true` si el pedido de mesa ya estuvo pagado y su cuenta se reabrió al anular un pago ("cuenta reabierta"): sigue debiendo y figura entre los activos, pero no ocupa la mesa |
| `mozo` | `{ id, nombre }` de quien creó el pedido (sea cual sea su rol) |
| `cliente` | `{ nombre, telefono }` (cualquiera puede ser `null`), o `null` si no hay datos. Siempre `null` en `MESA` |
| `direccionEntrega`, `distritoEntrega`, `referenciaEntrega` | Solo `DELIVERY`. Copia del momento del pedido. `distritoEntrega` es uno de los distritos de reparto del negocio |
| `pagoPrevisto` | Pedidos por teléfono: cómo va a pagar el cliente, o `null`. **No es un pago**: el cobro entra a la caja con `POST /pedidos/:id/pagos`. `momento` es `ANTICIPADO` (dice que ya pagó por Yape o Plin: queda por confirmar) o `AL_RECIBIR`; `metodo` es el previsto; `pagaCon` (solo efectivo al recibir) es con cuánto paga, y `vuelto` lo que debe llevar el motorizado (`pagaCon − saldoPendiente`, o `null` si no alcanza). `vuelto` se recalcula con el pedido |
| `motivoCancelacion` | Por qué se canceló el pedido entero con `PATCH /pedidos/:id/cancelar`; `null` en los demás |
| `repartidor` | `{ id, nombre, telefono }` o `null` |
| `total` | `subtotal + costoEnvio + cargoTapers - descuento` |
| `totalPagado`, `saldoPendiente` | Solo cuentan los pagos vigentes: uno anulado no suma |
| `tapersManual` | `true` si la cantidad de tapers se fijó a mano y ya no se recalcula |
| `pagado` | `true` cuando lo cobrado iguala el total. Un pedido de mesa pagado libera la mesa |
| `items` | En el orden en que se pidieron (`orden`: 1, 2, 3… a lo largo de todas las rondas). **Incluye los cancelados** |
| `items[].estado` | `PENDIENTE`, `PREPARANDO`, `LISTO`, `ENTREGADO`, `CANCELADO` |
| `items[].nombreProducto` | `"Producto"`, o `"Producto — Variante"` si la variante no es "Única". Copia del momento del pedido, igual que `precioUnitario` |
| `items[].componentes` | Solo combos: nombres de los platos elegidos. `[]` en el resto |
| `items[].listoEn` | Cuándo se marcó `LISTO`, o `null` si todavía no. Vuelve a `null` si el item regresa a `PENDIENTE` o `PREPARANDO`, y se conserva al pasar a `ENTREGADO` (o al deshacer esa entrega). El panel de cocina ordena "recién listos" con este dato |
| `items[].idRonda` | Los items con el mismo `idRonda` se pidieron juntos. La primera ronda lleva el `idCliente` del pedido |

**Estado del pedido.** Se recalcula solo a partir de sus items, sin contar los
cancelados:

| Items (no cancelados) | Estado del pedido |
|---|---|
| Ninguno (todos cancelados) | `CANCELADO` |
| Todos `ENTREGADO` | `ENTREGADO` |
| Alguno `PREPARANDO` | `PREPARANDO` |
| Todos `PENDIENTE` | `PENDIENTE` |
| Todos `LISTO` o `ENTREGADO` | `LISTO` (o se mantiene `EN_CAMINO` si ya salió) |
| Pendientes mezclados con listos o entregados (ronda nueva) | `PREPARANDO` |

`EN_CAMINO` solo se alcanza con `PATCH /pedidos/:id/estado`.

**Tapers** (solo `DELIVERY` y `PARA_LLEVAR`). Por defecto `cantidadTapers` es la
suma de `cantidad × tapers del producto` de los items no cancelados, y se
recalcula al agregar una ronda o cancelar un item. Si alguien fija la cantidad
(al crear el pedido o con `/cargos`), `tapersManual` pasa a `true` y deja de
recalcularse. `cargoTapers = cantidadTapers × precio del taper del negocio`.

### Turno de caja

Lo devuelven los endpoints de caja y el evento `caja:actualizada`.

```json
{
  "id": "…",
  "abierto": true,
  "abiertoEn": "2026-10-07T13:00:00.000Z",
  "abiertoPor": { "id": "…", "nombre": "Cocina" },
  "cerradoEn": null,
  "cerradoPor": null,
  "montoInicial": "100.00",
  "totalesPorMetodo": { "EFECTIVO": "46.00", "YAPE": "70.00", "PLIN": "0.00", "TARJETA": "0.00" },
  "totalCobrado": "116.00",
  "pedidosCobrados": 1,
  "pagosAnulados": 0,
  "vueltoEntregado": "4.00",
  "efectivoEsperado": "146.00",
  "efectivoContado": null,
  "diferencia": null,
  "observacion": null
}
```

| Campo | Notas |
|---|---|
| `totalesPorMetodo` | Lo cobrado por método, ya descontado el vuelto |
| `pedidosCobrados` | Pedidos distintos con al menos un pago vigente en este turno |
| `pagosAnulados` | Pagos de este turno que se anularon. No cuentan en ningún otro campo del resumen |
| `vueltoEntregado` | Suma de `recibido - monto` de los pagos en efectivo |
| `efectivoEsperado` | `montoInicial + totalesPorMetodo.EFECTIVO`: lo que debería haber en el cajón |
| `efectivoContado`, `diferencia`, `cerradoEn`, `cerradoPor` | `null` hasta el cierre. `diferencia = efectivoContado - efectivoEsperado` (negativo = falta) |

---

## Auth

### `POST /api/auth/login`

Sin autenticación. Máximo **5 intentos fallidos por minuto por IP** (los logins
correctos no cuentan).

**Body**

| Campo | Tipo | |
|---|---|---|
| `codigoNegocio` | texto | Obligatorio. Código del negocio, p. ej. `"valentina"`. No distingue mayúsculas |
| `usuario` | texto | Obligatorio |
| `password` | texto | Obligatorio |

**200**

```json
{
  "token": "eyJhbGciOi…",
  "usuario": { "id": "…", "nombre": "Mozo", "usuario": "mozo", "roles": ["MOZO"] },
  "negocio": { "id": "…", "codigo": "valentina", "nombre": "Cevichería Valentina", "logoUrl": "/api/negocios/valentina/logo?v=1" }
}
```

El token es un JWT con `usuarioId`, `negocioId` y `roles`; dura 12 horas.
`negocio.logoUrl` puede ser `null`; ver [Negocios](#negocios) para cómo usarlo.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta algún campo |
| 401 | `NO_AUTENTICADO` | Negocio, usuario o contraseña incorrectos, o usuario/negocio inactivo. El mensaje es el mismo en todos los casos |
| 429 | `DEMASIADOS_INTENTOS` | Se superó el límite; reintentar en un minuto |

### `GET /api/auth/yo`

Usuario y negocio de la sesión actual, leídos de la base. **Roles**: cualquiera.
Sirve para restaurar la sesión al abrir la app y para refrescar el nombre y el
logo del negocio.

**200** — mismos objetos `usuario` y `negocio` que el login, sin `token`:

```json
{
  "usuario": { "id": "…", "nombre": "Mozo", "usuario": "mozo", "roles": ["MOZO"] },
  "negocio": { "id": "…", "codigo": "valentina", "nombre": "Cevichería Valentina", "logoUrl": "/api/negocios/valentina/logo?v=1" }
}
```

**Errores**: 401 `NO_AUTENTICADO`.

### `GET /api/salud`

Sin autenticación. Comprueba que el servidor responde **y que llega a la base
de datos**. Es la ruta que consulta Railway para saber si el servicio está sano.

- **200** `{ "ok": true }`
- **503** `{ "ok": false, "error": { "codigo": "BASE_NO_DISPONIBLE", "mensaje": "…" } }`
  si la base no responde.

---

## Negocios

### `GET /api/negocios/:codigo/publico`

Sin autenticación. Lo único visible de un negocio antes de iniciar sesión: el
login lo usa para mostrar su nombre y su logo. `:codigo` no distingue
mayúsculas. Máximo **30 consultas por minuto por IP**.

**200**

```json
{ "nombre": "Cevichería Valentina", "logoUrl": "/api/negocios/valentina/logo?v=1" }
```

`logoUrl` es `null` si el negocio no tiene logo; en ese caso se muestra solo el
nombre.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 404 | `NO_ENCONTRADO` | No existe un negocio con ese código, o está inactivo |
| 429 | `DEMASIADOS_INTENTOS` | Se superó el límite; reintentar en un minuto |

### `GET /api/negocios/:codigo/logo`

Sin autenticación. Responde la imagen del logo con su `Content-Type`
(`image/png`, `image/jpeg` o `image/webp`) y un día de caché. Máximo **60
consultas por minuto por IP** (429 `DEMASIADOS_INTENTOS`); con la caché, un
equipo lo pide muy pocas veces.
**404** `NO_ENCONTRADO` si el negocio no existe, está inactivo o no tiene logo.

### Logo (`logoUrl`)

El logo se guarda en la base de datos (no en disco: sobrevive a cada
despliegue). `logoUrl` es la ruta de arriba con un `?v=…` que cambia cada vez
que el dueño sube otra imagen, así que se puede guardar en caché sin servir una
vieja: `/api/negocios/valentina/logo?v=1760000000000`. Se resuelve contra el
origen del servidor (en desarrollo, `http://localhost:3000/api/negocios/…`).
También puede ser una URL absoluta (`https://…`), que se usa tal cual.

El nombre y el logo del negocio salen siempre de la API; el frontend no los
lleva en su código. El dueño los cambia desde [Administración](#administración).

---

## Carta

### `GET /api/carta`

**Roles**: cualquiera. Devuelve solo lo activo, en el orden configurado.

**200**

```json
{
  "categorias": [
    {
      "id": "…",
      "nombre": "Frituras",
      "productos": [
        {
          "id": "…",
          "nombre": "Chicharrón de Pota",
          "descripcion": null,
          "imagenUrl": null,
          "areaId": "…",
          "tapers": 1,
          "esCombo": false,
          "comboCantidad": null,
          "variantes": [
            { "id": "…", "nombre": "S/ 10", "precio": "10.00" },
            { "id": "…", "nombre": "S/ 18", "precio": "18.00" }
          ],
          "opcionesCombo": []
        }
      ]
    }
  ],
  "notasRapidas": [{ "id": "…", "texto": "Sin cebolla" }],
  "areas": [{ "id": "…", "nombre": "Cocina" }, { "id": "…", "nombre": "Bebidas" }],
  "reparto": { "costoEnvioDefault": "3.00", "precioTaper": "1.00", "distritos": ["Tarapoto", "Morales", "La Banda de Shilcayo"], "region": "San Martín, Perú" },
  "cocina": { "tardaMin": 15, "muyTardeMin": 25 }
}
```

| Campo | Notas |
|---|---|
| `variantes` | Todo producto tiene al menos una. Si solo hay una llamada `"Única"`, no hace falta mostrar selector. Al pedir se envía el `id` de la variante |
| `tapers` | Tapers que ocupa una unidad en delivery / para llevar (0 = bebidas) |
| `esCombo`, `comboCantidad` | En un combo el cliente elige exactamente `comboCantidad` platos (2 = doble, 3 = triple) |
| `opcionesCombo` | Solo combos: `[{ productoId, nombre }]`, los platos elegibles. El `productoId` es lo que se envía en `componentes` |
| `notasRapidas` | Botones de texto para las notas de un item |
| `reparto` | Para tomar un pedido por teléfono y decirle el total al cliente: envío por defecto, precio de cada taper, distritos de reparto (el primero es el de por defecto) y la región que completa la dirección al buscarla en un mapa (`dirección, distrito, región`). `distritos` puede venir vacío y `region` en `null` |
| `cocina` | Minutos desde que entró una comanda a partir de los cuales el panel de cocina la marca como que tarda (ámbar) o va muy tarde (rojo). Los fija el dueño |
| `areas` | Áreas de preparación activas, en su orden: `[{ id, nombre }]`. Es el `areaId` de cada producto y de cada item de un pedido; el panel de cocina agrupa y filtra por ellas |

---

## Mesas

### `GET /api/mesas`

**Roles**: `MOZO`, `LOCAL`, `ADMIN`. Mesas activas en orden. Una mesa está
ocupada si tiene un pedido no pagado y no cancelado (sin contar los que tienen
`mesaLiberada`).

**200**

```json
{
  "mesas": [
    { "id": "…", "nombre": "Mesa 1", "estado": "libre", "pedido": null },
    {
      "id": "…",
      "nombre": "Mesa 3",
      "estado": "ocupada",
      "pedido": { "id": "…", "numero": 1, "estado": "PENDIENTE", "total": "130.00", "creadoEn": "2026-10-07T15:10:00.000Z" }
    }
  ]
}
```

---

## Clientes

### `GET /api/clientes/buscar?telefono=`

**Roles**: cualquiera. Para autocompletar el formulario de delivery. El teléfono
se acepta en cualquier formato (`+51 987 654 321`, `987654321`…); se compara
solo por dígitos y sin el prefijo 51.

**200** — con `cliente: null` si el teléfono no está registrado (no es un 404):

```json
{ "cliente": { "id": "…", "telefono": "987654321", "nombre": "Rosa Pérez", "direccion": "Jr. San Martín 245", "distrito": "Morales", "referencia": "Frente al parque" } }
```

**Errores**: 400 `DATOS_INVALIDOS` si falta `telefono` o no tiene entre 6 y 15 dígitos.

Los clientes se crean y actualizan solos al registrar pedidos con teléfono; no
hay endpoint para crearlos.

### `GET /api/clientes/ultimo-pedido?telefono=`

**Roles**: cualquiera. El último pedido no cancelado de ese cliente, para
"Repetir pedido". Mismo formato de teléfono que `/buscar`.

**200** `{ "pedido": Pedido }`, o `{ "pedido": null }` si el cliente no existe o
no tiene pedidos. Los platos de un combo vienen por nombre (`componentes`): para
repetirlo hay que buscarlos entre las `opcionesCombo` actuales de la carta.

**Errores**: 400 `DATOS_INVALIDOS` si falta `telefono` o no tiene entre 6 y 15 dígitos.

---

## Repartidores

### `GET /api/repartidores`

**Roles**: cualquiera. Repartidores activos, por nombre.

**200** `{ "repartidores": [{ "id": "…", "nombre": "José Falcón", "telefono": "916386642" }] }` (`telefono` puede ser `null`)

---

## Pedidos

### `POST /api/pedidos`

Crea un pedido con su primera ronda. **Roles**: `MOZO`, `LOCAL`, `ADMIN`.

**Body**

| Campo | Tipo | |
|---|---|---|
| `tipo` | `"MESA"` \| `"DELIVERY"` \| `"PARA_LLEVAR"` | Obligatorio |
| `idCliente` | UUID | Obligatorio. Lo genera el frontend (`crypto.randomUUID()`) una vez por pedido. Reenviar el mismo devuelve el pedido ya creado en vez de duplicarlo |
| `items` | lista, 1–100 | Obligatorio. Ver abajo. Se guardan en el orden enviado |
| `mesaId` | UUID | Obligatorio en `MESA`; no se admite en los demás |
| `nota` | texto ≤ 500 | Opcional. Nota general del pedido |
| `cliente` | objeto | Obligatorio en `DELIVERY`, opcional en `PARA_LLEVAR`, se ignora en `MESA` |
| `costoEnvio` | número 0–20 | Solo `DELIVERY`. Si falta, se usa el costo de envío por defecto del negocio. Se ignora en los demás tipos |
| `cantidadTapers` | entero 0–200 | Solo `DELIVERY` y `PARA_LLEVAR`. Si falta, se calcula sola; si viene, queda fija (`tapersManual`). Se ignora en `MESA` |
| `pagoPrevisto` | objeto | Opcional, `DELIVERY` y `PARA_LLEVAR`. Ver abajo |

`pagoPrevisto`:

| Campo | Tipo | |
|---|---|---|
| `momento` | `"ANTICIPADO"` \| `"AL_RECIBIR"` | Obligatorio. `ANTICIPADO`: el cliente dice que ya pagó; queda por confirmar |
| `metodo` | `"EFECTIVO"` \| `"YAPE"` \| `"PLIN"` \| `"TARJETA"` | Obligatorio. `ANTICIPADO` solo admite `YAPE` o `PLIN` |
| `pagaCon` | número > 0 | Solo `AL_RECIBIR` en `EFECTIVO`: con cuánto paga |

`items[]`:

| Campo | Tipo | |
|---|---|---|
| `varianteId` | UUID | Obligatorio. `id` de la variante en la carta |
| `cantidad` | entero 1–99 | Obligatorio |
| `notas` | lista de textos (≤ 10, cada uno ≤ 100) | Opcional. Por defecto `[]` |
| `componentes` | lista de UUID | Solo combos, y entonces obligatorio: `productoId` de cada plato elegido, exactamente `comboCantidad` elementos, todos de `opcionesCombo`. Se puede repetir un plato |

`cliente`:

| Campo | Tipo | |
|---|---|---|
| `telefono` | texto, 6–15 dígitos | Obligatorio en `DELIVERY`. Con teléfono, el cliente se guarda o actualiza para autocompletar después |
| `nombre` | texto ≤ 100 | Opcional. En un cliente existente, si no viene se conserva el anterior |
| `direccion` | texto ≤ 200 | Obligatorio en `DELIVERY` |
| `distrito` | texto ≤ 100 | Solo `DELIVERY`. Uno de `reparto.distritos` de la carta. Si falta, se usa el primero |
| `referencia` | texto ≤ 200 | Opcional |

Precios y nombres se toman siempre de la base de datos.

**Ejemplo (delivery)**

```json
{
  "tipo": "DELIVERY",
  "idCliente": "0b7f6a52-3a0e-4a65-8f43-3f3c1b6a9d10",
  "cliente": { "telefono": "987654321", "nombre": "Rosa Pérez", "direccion": "Jr. San Martín 245", "referencia": "Frente al parque" },
  "items": [
    { "varianteId": "…", "cantidad": 2, "notas": ["Sin cebolla"] },
    { "varianteId": "…", "cantidad": 1, "notas": [], "componentes": ["…", "…", "…"] }
  ]
}
```

**201** `{ "pedido": Pedido }` — pedido creado. Emite `pedido:creado`.
**200** `{ "pedido": Pedido }` — ya existía un pedido con ese `idCliente` (reintento); no emite evento.

**Errores**

| HTTP | `codigo` | Cuándo | Extra |
|---|---|---|---|
| 400 | `DATOS_INVALIDOS` | Validación. Incluye: `MESA` sin `mesaId`, `mesaId` en otro tipo, `DELIVERY` sin teléfono o dirección | `detalles` |
| 400 | `SOLICITUD_INVALIDA` | Alguna variante no existe o no está disponible | `varianteIds` |
| 400 | `SOLICITUD_INVALIDA` | Combo con una cantidad de platos distinta de `comboCantidad` | |
| 400 | `SOLICITUD_INVALIDA` | Combo con un plato que no es una de sus opciones | `productoId` |
| 400 | `SOLICITUD_INVALIDA` | `componentes` en un producto que no es combo | |
| 400 | `SOLICITUD_INVALIDA` | `cliente.distrito` no es un distrito de reparto del negocio | `distritos` |
| 404 | `NO_ENCONTRADO` | La mesa no existe | |
| 409 | `MESA_OCUPADA` | La mesa ya tiene un pedido abierto: hay que agregarle una ronda | `pedidoId` |
| 409 | `ID_CLIENTE_EN_USO` | Ese `idCliente` ya se usó en otro negocio; generar uno nuevo | |

### `POST /api/pedidos/:id/items`

Agrega una ronda a un pedido abierto (no pagado y no cancelado). **Roles**:
`MOZO`, `LOCAL`, `ADMIN`.

**Body**

| Campo | Tipo | |
|---|---|---|
| `idRonda` | UUID | Obligatorio. Lo genera el frontend una vez por ronda. Reenviar el mismo no duplica los items |
| `items` | lista, 1–100 | Obligatorio. Mismo formato que al crear el pedido |
| `nota` | texto ≤ 500 | Opcional. Se agrega a la nota del pedido, separada por `" · "` (`"Es un cumpleaños · Todo junto"`); no la reemplaza. Si el pedido no tenía nota, queda esta. Una nota idéntica a la que ya tiene el pedido no se repite, y un reintento con el mismo `idRonda` no la vuelve a agregar |

La nota existe para que un pedido que se anotó como nuevo y terminó entrando
como ronda (ver `MESA_OCUPADA`) no pierda su nota general. Tras varias rondas con
nota, `pedido.nota` puede superar los 500 caracteres.

Los items nuevos quedan al final de la comanda. Recalcula totales, estado y, en
delivery / para llevar con tapers automáticos, los tapers.

**201** `{ "pedido": Pedido }` — ronda agregada. Emite `pedido:actualizado`.
**200** `{ "pedido": Pedido }` — esa ronda ya había entrado (reintento); no emite evento.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` / `SOLICITUD_INVALIDA` | Igual que al crear el pedido (items, combos) |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `PEDIDO_PAGADO` | El pedido ya está pagado: crear uno nuevo |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

### `GET /api/pedidos/activos`

Pedidos no cancelados que todavía no están pagados o no están entregados, del
más antiguo al más nuevo. **Roles**: cualquiera.

**Query**

| Parámetro | |
|---|---|
| `areaId` | Opcional. Solo pedidos con items de esa área, y de cada uno solo esos items. Los totales siguen siendo los del pedido completo |

**200** `{ "pedidos": [Pedido, …] }`

**Errores**: 400 `DATOS_INVALIDOS` si `areaId` no es un UUID.

### `GET /api/pedidos/por-telefono`

Tablero de Delivery. **Roles**: cualquiera. Todos los `DELIVERY` y los
`PARA_LLEVAR` con teléfono, creados hoy (hora de `America/Lima`) o todavía sin
entregar o sin pagar de un día anterior, del más antiguo al más nuevo. A
diferencia de `/activos`, **incluye los ya entregados y pagados** de hoy; no
incluye los cancelados.

**200** `{ "pedidos": [Pedido, …] }`

### `PATCH /api/pedidos/:id/items/estado`

Cambia el estado de varios items a la vez. **Roles**: `MOZO`, `LOCAL`, `ADMIN`.

**Body** — exactamente uno de `itemIds` o `areaId`:

| Campo | Tipo | |
|---|---|---|
| `itemIds` | lista de UUID, 1–100 | Items concretos del pedido |
| `areaId` | UUID | Todos los items de esa área (la cocina marca su área entera). No toca los cancelados ni los ya entregados |
| `estado` | `"PENDIENTE"` \| `"PREPARANDO"` \| `"LISTO"` \| `"ENTREGADO"` | Obligatorio. Para cancelar se usa la ruta de cancelar |

**200** `{ "pedido": Pedido }` con el estado del pedido ya recalculado. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Faltan o sobran `itemIds` / `areaId`, o `estado` no es válido |
| 404 | `NO_ENCONTRADO` | El pedido no existe, algún item no es de este pedido, o el pedido no tiene items de esa área |
| 409 | `ITEM_CANCELADO` | Alguno de los `itemIds` está cancelado |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

### `PATCH /api/pedidos/:id/items/:itemId/cancelar`

Cancela un item. Sin body. **Roles**: `MOZO`, `LOCAL`, `ADMIN`; si el item ya
no está `PENDIENTE`, solo `ADMIN`.

Recalcula totales, estado y tapers automáticos. Si era el último item vivo, el
pedido queda `CANCELADO` (y libera la mesa).

**200** `{ "pedido": Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo | Extra |
|---|---|---|---|
| 403 | `SIN_PERMISO` | El item ya está en preparación, listo o entregado, y quien cancela no es `ADMIN` | |
| 404 | `NO_ENCONTRADO` | El pedido o el item no existen | |
| 409 | `ITEM_CANCELADO` | Ya estaba cancelado | |
| 409 | `ITEM_PAGADO` | El item ya fue cobrado en una cuenta dividida | |
| 409 | `PEDIDO_PAGADO` | El pedido ya está pagado | |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado | |
| 409 | `TOTAL_MENOR_A_LO_PAGADO` | Al cancelar, el total quedaría por debajo de lo ya cobrado | `totalPagado` |

### `PATCH /api/pedidos/:id/cargos`

Ajusta envío, tapers o descuento. **Roles**: `LOCAL`, `ADMIN`. Solo antes del
primer pago.

**Body** — al menos un campo; lo que no se envía no cambia:

| Campo | Tipo | |
|---|---|---|
| `costoEnvio` | número 0–20 | Solo `DELIVERY` |
| `cantidadTapers` | entero 0–200 \| `null` | Solo `DELIVERY` y `PARA_LLEVAR`. Un número fija la cantidad (`tapersManual: true`); `null` vuelve al cálculo automático |
| `descuento` | número ≥ 0 | En soles. No puede superar `subtotal + costoEnvio + cargoTapers` |

**200** `{ "pedido": Pedido }` con el total recalculado. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Body vacío o valores fuera de rango |
| 400 | `SOLICITUD_INVALIDA` | `costoEnvio` en un pedido que no es delivery, `cantidadTapers` en uno de mesa, o descuento mayor que el total |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `PEDIDO_CON_PAGOS` | El pedido ya tiene algún pago |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

### `PATCH /api/pedidos/:id/entrega`

Corrige los datos de entrega o el pago previsto de un pedido por teléfono que
todavía no se entregó (el cliente volvió a llamar). **Roles**: `LOCAL`, `ADMIN`.

**Body** — al menos un campo; lo que no se envía no cambia:

| Campo | Tipo | |
|---|---|---|
| `nombre` | texto ≤ 100 | |
| `direccion` | texto ≤ 200 | Solo `DELIVERY` |
| `distrito` | texto ≤ 100 | Solo `DELIVERY`. Uno de los distritos de reparto |
| `referencia` | texto ≤ 200 \| `null` | Solo `DELIVERY`. `""` o `null` la borran |
| `pagoPrevisto` | objeto | Igual que al crear el pedido. Reemplaza al anterior |

Si el pedido tiene un cliente guardado, su nombre y su dirección se actualizan
también, para la próxima vez.

**200** `{ pedido: Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Body vacío o `pagoPrevisto` mal armado |
| 400 | `SOLICITUD_INVALIDA` | Dirección en un pedido para llevar, o distrito que no es del negocio |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `NO_ES_DELIVERY` | El pedido es de mesa |
| 409 | `PEDIDO_ENTREGADO` | El pedido ya se entregó |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

### `PATCH /api/pedidos/:id/cancelar`

Cancela el pedido entero, con su motivo. **Roles**: `LOCAL`, `ADMIN`. A
diferencia de cancelar items uno por uno, no importa en qué estado estén: sirve
mientras el pedido no haya salido.

**Body** `{ "motivo": "El cliente ya no lo quiere" }`: texto de 3 a 200 caracteres, obligatorio.

Todos los items pasan a `CANCELADO`, el pedido queda `CANCELADO` con
`motivoCancelacion`, y libera la mesa si era de mesa.

Un pedido cancelado (por esta ruta o porque se canceló su último item) queda
con `total`, `costoEnvio`, `cargoTapers` y `descuento` en `0.00` y sin tapers.

**200** `{ pedido: Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta el motivo o tiene menos de 3 caracteres |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `PEDIDO_CON_PAGOS` | El pedido tiene algún pago vigente: hay que anularlo primero en Caja |
| 409 | `PEDIDO_YA_SALIO` | El pedido está `EN_CAMINO` o `ENTREGADO` |
| 409 | `PEDIDO_CANCELADO` | Ya estaba cancelado |

### `PATCH /api/pedidos/:id/repartidor`

Asigna o quita el repartidor de un delivery. **Roles**: `MOZO`, `LOCAL`, `ADMIN`.

**Body** `{ "repartidorId": "<uuid>" }`, o `{ "repartidorId": null }` para quitarlo.

**200** `{ "pedido": Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 404 | `NO_ENCONTRADO` | El pedido o el repartidor no existen (o el repartidor está inactivo) |
| 409 | `NO_ES_DELIVERY` | El pedido no es de delivery |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

### `PATCH /api/pedidos/:id/estado`

Despacho del pedido completo, y cómo deshacer el último paso. **Roles**: `MOZO`,
`LOCAL`, `ADMIN`.

**Body** `{ "estado": "EN_CAMINO" }`, `{ "estado": "ENTREGADO" }` o `{ "estado": "LISTO" }`

| `estado` | Desde | Efecto |
|---|---|---|
| `EN_CAMINO` | `LISTO` (solo `DELIVERY`) | El pedido sale: pasa a `EN_CAMINO` |
| `ENTREGADO` | `LISTO` o `EN_CAMINO`, cualquier tipo | Todos los items no cancelados pasan a `ENTREGADO`, y con ellos el pedido |
| `LISTO` | `EN_CAMINO` | **Deshace la salida**: el pedido vuelve a `LISTO`. No toca al repartidor asignado |
| `EN_CAMINO` | `ENTREGADO` (solo `DELIVERY`) | **Deshace la entrega**: los items vuelven a `LISTO` (conservan su `listoEn`) y el pedido a `EN_CAMINO` |
| `LISTO` | `ENTREGADO` (pedidos que no son delivery) | **Deshace la entrega**: los items y el pedido vuelven a `LISTO` |

Una entrega solo se deshace si no se registró ningún pago vigente **después** de
ella. Los pagos anteriores (el cliente pagó por adelantado) no lo impiden.

**200** `{ "pedido": Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `estado` distinto de `EN_CAMINO`, `ENTREGADO` o `LISTO` |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `NO_ES_DELIVERY` | `EN_CAMINO` en un pedido que no es delivery |
| 409 | `PEDIDO_NO_LISTO` | El pedido no está en un estado desde el que se pueda dar ese paso (todavía hay items sin terminar, o `LISTO` sobre un pedido que no salió ni se entregó) |
| 409 | `PEDIDO_CON_PAGOS` | Se quiere deshacer una entrega, pero ya se cobró después de ella |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

---|---|---|
| `EN_CAMINO` | Solo `DELIVERY`, y el pedido debe estar `LISTO` | El pedido pasa a `EN_CAMINO` |
| `ENTREGADO` | Cualquier tipo; el pedido debe estar `LISTO` o `EN_CAMINO` | Todos los items no cancelados pasan a `ENTREGADO`, y con ellos el pedido |

**200** `{ "pedido": Pedido }`. Emite `pedido:actualizado`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `estado` distinto de `EN_CAMINO` o `ENTREGADO` |
| 404 | `NO_ENCONTRADO` | El pedido no existe |
| 409 | `NO_ES_DELIVERY` | `EN_CAMINO` en un pedido que no es delivery |
| 409 | `PEDIDO_NO_LISTO` | El pedido no está en el estado requerido (todavía hay items sin terminar) |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado |

---

## Cuenta y pagos

### `GET /api/pedidos/:id/cuenta`

Detalle para cobrar y para dividir la cuenta por platos. **Roles**: cualquiera.

**200**

```json
{
  "cuenta": {
    "pedidoId": "…",
    "numero": 1,
    "tipo": "MESA",
    "items": [
      { "id": "…", "nombreProducto": "Ceviche Simple", "componentes": [], "cantidad": 2, "precioUnitario": "20.00", "subtotal": "40.00", "cantidadPagada": 2, "pagado": true },
      { "id": "…", "nombreProducto": "Gaseosa Personal", "componentes": [], "cantidad": 1, "precioUnitario": "3.00", "subtotal": "3.00", "cantidadPagada": 0, "pagado": false }
    ],
    "subtotal": "43.00",
    "costoEnvio": "0.00",
    "cantidadTapers": 0,
    "cargoTapers": "0.00",
    "descuento": "0.00",
    "total": "43.00",
    "totalPagado": "40.00",
    "saldoPendiente": "3.00",
    "pagado": false,
    "pagos": [
      {
        "id": "…", "metodo": "YAPE", "monto": "40.00", "recibido": null, "vuelto": "0.00", "referencia": null,
        "itemIds": ["…"], "creadoEn": "2026-10-07T16:02:00.000Z",
        "anulado": false, "anuladoEn": null, "anuladoPor": null, "motivoAnulacion": null, "corregible": true
      }
    ]
  }
}
```

| Campo | Notas |
|---|---|
| `items` | Sin los cancelados. `subtotal = precioUnitario × cantidad` |
| `items[].cantidadPagada` | Unidades de ese item ya cobradas en cuenta dividida (todas, si el pedido entero está pagado) |
| `items[].pagado` | `true` cuando `cantidadPagada` llega a `cantidad` |
| `pagos` | Todos los pagos del pedido, **incluidos los anulados** (`anulado: true`, con `anuladoEn`, `anuladoPor: { id, nombre }` y `motivoAnulacion`). Los anulados no cuentan en `totalPagado` ni en `cantidadPagada` |
| `pagos[].itemIds` | Items que cubrió ese pago; `[]` si fue a cuenta del total |
| `pagos[].corregible` | `true` si el pago está vigente y es del turno de caja abierto: se le puede cambiar el método o anular |

**Errores**: 404 `NO_ENCONTRADO`.

### `POST /api/pedidos/:id/pagos`

Registra uno o varios pagos. **Roles**: `LOCAL`, `ADMIN`. Requiere caja abierta.

**Body**

| Campo | Tipo | |
|---|---|---|
| `pagos` | lista, 1–10 | Obligatorio. Varios pagos en una misma petición = pago mixto |
| `idCobro` | UUID | Opcional, recomendado. Lo genera la caja una vez por cobro. Reenviar el mismo (porque la respuesta se perdió) devuelve lo ya registrado con **200**, sin cobrar otra vez ni emitir eventos |
| `itemIds` | lista de UUID, 1–100 | Opcional. Cuenta dividida por platos enteros: los items que se están pagando |
| `items` | lista de `{ itemId, cantidad }`, 1–100 | Opcional. Cuenta dividida por unidades: cuántas unidades de cada item se pagan (de un `2× Ceviche`, se puede cobrar 1). No se combina con `itemIds` |

`pagos[]`:

| Campo | Tipo | |
|---|---|---|
| `metodo` | `"EFECTIVO"` \| `"YAPE"` \| `"PLIN"` \| `"TARJETA"` | Obligatorio |
| `monto` | número > 0 | Obligatorio. Lo que se cobra (sin el vuelto) |
| `recibido` | número ≥ `monto` | Solo `EFECTIVO`: con cuánto pagó el cliente. Si falta, se asume pago exacto |
| `referencia` | texto ≤ 100 | Opcional. Nº de operación de Yape/Plin o voucher |

Reglas:

- La suma de los `monto` no puede superar el saldo pendiente.
- Con `itemIds`: los items deben ser del pedido, no estar cancelados ni tener
  ninguna unidad ya pagada, y la suma de los `monto` debe ser **exactamente** la
  suma de sus subtotales.
- Con `items`: igual, pero por unidades. `cantidad` no puede superar las unidades
  que quedan sin pagar de ese item, y los `monto` deben sumar `precioUnitario ×
  cantidad` de lo indicado.
- Envío, tapers y descuento no pertenecen a ningún item: ese resto se cobra con
  un pago sin `itemIds` ni `items`.
- Los pagos de una misma petición (pago mixto) forman un solo cobro: sus items
  se cuentan una sola vez.
- Cuando lo pagado iguala el total, el pedido queda `pagado` y la mesa libre.

**Ejemplo (mixto con vuelto)**

```json
{
  "pagos": [
    { "metodo": "YAPE", "monto": 70, "referencia": "OP 4471230" },
    { "metodo": "EFECTIVO", "monto": 46, "recibido": 50 }
  ]
}
```

**201**

```json
{
  "pedido": { "…": "Pedido completo, con pagado, totalPagado y saldoPendiente actualizados" },
  "pagos": [
    { "id": "…", "metodo": "YAPE", "monto": "70.00", "recibido": null, "vuelto": "0.00", "referencia": "OP 4471230" },
    { "id": "…", "metodo": "EFECTIVO", "monto": "46.00", "recibido": "50.00", "vuelto": "4.00", "referencia": null }
  ],
  "vuelto": "4.00",
  "saldoPendiente": "0.00"
}
```

Emite `pedido:actualizado` y `caja:actualizada`.

**Errores**

| HTTP | `codigo` | Cuándo | Extra |
|---|---|---|---|
| 400 | `DATOS_INVALIDOS` | Validación. Incluye `recibido` menor que `monto` y `recibido` en un método que no es efectivo | `detalles` |
| 400 | `SOLICITUD_INVALIDA` | Con `itemIds`, los pagos no suman lo que cuestan esos items | `subtotalItems` |
| 404 | `NO_ENCONTRADO` | El pedido no existe, o algún item no es de este pedido (o está cancelado) | |
| 409 | `SIN_CAJA_ABIERTA` | No hay turno de caja abierto | |
| 409 | `PAGO_EXCEDE_SALDO` | La suma supera el saldo pendiente | `saldoPendiente` |
| 409 | `ITEM_PAGADO` | Alguno de los items ya estaba pagado, o se piden más unidades de las que quedan por pagar | `itemIds` |
| 409 | `PEDIDO_PAGADO` | El pedido ya está pagado | |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado | |

### Corregir un pago

Un pago no se borra nunca. Mientras su turno de caja siga abierto se puede
corregir de dos formas, las dos de **roles** `LOCAL` y `ADMIN`, y las dos quedan
registradas (quién, cuándo, qué había antes). Después de cerrar la caja no se
toca nada.

Las dos responden **200** con el pedido, el pago y el turno ya actualizados, y
emiten `pedido:actualizado` y `caja:actualizada`:

```json
{
  "pedido": { "…": "Pedido completo" },
  "pago": { "id": "…", "metodo": "EFECTIVO", "monto": "53.00", "recibido": "60.00", "vuelto": "7.00", "referencia": null, "itemIds": [], "creadoEn": "…", "anulado": false, "anuladoEn": null, "anuladoPor": null, "motivoAnulacion": null },
  "turno": { "…": "Turno con su resumen" }
}
```

#### `PATCH /api/pedidos/:id/pagos/:pagoId/metodo`

Se cobró bien pero se anotó con otro método (era efectivo y se marcó Yape). El
monto no cambia.

| Campo | Tipo | |
|---|---|---|
| `metodo` | `"EFECTIVO"` \| `"YAPE"` \| `"PLIN"` \| `"TARJETA"` | Obligatorio |
| `recibido` | número ≥ monto del pago | Solo `EFECTIVO`. Si falta, se asume pago exacto. Al pasar a otro método, el recibido y el vuelto se borran |
| `referencia` | texto ≤ 100 | Opcional. Si no se envía, se conserva la que tenía; `""` la borra |

#### `PATCH /api/pedidos/:id/pagos/:pagoId/anular`

El pago estuvo mal (monto equivocado, pedido equivocado).

**Body** `{ "motivo": "Monto equivocado" }`: texto de 3 a 200 caracteres, obligatorio.

El pago queda marcado (`anulado`, `anuladoEn`, `anuladoPor`, `motivoAnulacion`) y
deja de contar en la cuenta, en el pedido y en el resumen del turno, que suma 1
a `pagosAnulados`. Si el pedido estaba pagado, vuelve a tener saldo pendiente y
reaparece entre los activos. Un pedido de mesa en ese caso queda con
`mesaLiberada: true` y **nunca vuelve a ocupar su mesa**, esté libre o no: un
pedido nuevo en esa mesa es un pedido nuevo, no una ronda del anterior. Si el
pedido todavía no estaba pagado (se anula un pago parcial), sigue ocupando la
mesa como antes.

**Errores (las dos rutas)**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta `metodo` o `motivo`, o el motivo tiene menos de 3 caracteres |
| 400 | `SOLICITUD_INVALIDA` | El pago ya tiene ese método; `recibido` en un método que no es efectivo, o menor que el monto |
| 404 | `NO_ENCONTRADO` | El pedido no existe, o el pago no es de ese pedido |
| 409 | `PAGO_ANULADO` | El pago ya estaba anulado |
| 409 | `TURNO_CERRADO` | El pago es de un turno de caja ya cerrado (o no hay caja abierta) |

### `GET /api/pedidos/:id/nota-venta`

Nota de venta en texto, lista para enviar por WhatsApp. **Roles**: cualquiera.

**200**

```json
{
  "texto": "*Cevichería Valentina*\nNota de venta - Pedido #1\n07/10/2026, 10:39\n…",
  "whatsappUrl": "https://wa.me/51987654321?text=*Cevicher%C3%ADa%20Valentina*%0A…"
}
```

- `texto` usa saltos de línea `\n` y `*negritas*` de WhatsApp. Contenido:

  ```
  *Cevichería Valentina*
  Nota de venta - Pedido #1
  07/10/2026, 10:39
  Delivery: Jr. San Martín 245
  Cliente: Rosa Pérez

  2 x Ceviche Mixto: S/ 60.00
  1 x Combo Triple: S/ 38.00
     (Ceviche Simple + Arroz con Mariscos + Chicharrón de Pescado)
  1 x Chicha de Jora: S/ 12.00

  Subtotal: S/ 110.00
  Envío: S/ 3.00
  Tapers (5): S/ 5.00
  *TOTAL: S/ 118.00*

  Pago: Yape S/ 70.00 + Efectivo S/ 48.00

  No es comprobante electrónico
  ¡Gracias por su preferencia!
  ```

- La fecha es la de creación del pedido en hora de Lima. La cuarta línea es la
  mesa, `Para llevar` o `Delivery: <dirección>`. Las líneas de envío, tapers y
  descuento solo aparecen si no son cero. Sin pagos vigentes dice `Pago: pendiente`; con
  pago parcial agrega `Pagado: S/ … - Saldo: S/ …`.
- `whatsappUrl` es `null` si el pedido no tiene teléfono de cliente. Si lo tiene,
  abre el chat con ese número (prefijo 51) y el texto ya escrito.

**Errores**: 404 `NO_ENCONTRADO`.

---

## Caja

Todos los endpoints de caja son de **roles** `LOCAL` y `ADMIN`. Solo puede haber
un turno abierto por negocio.

### `POST /api/caja/abrir`

**Body** `{ "montoInicial": 100 }` — número ≥ 0: el sencillo con el que se abre.

**201** `{ "turno": Turno }`. Emite `caja:actualizada`.

**Errores**

| HTTP | `codigo` | Cuándo | Extra |
|---|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta `montoInicial` o es negativo | `detalles` |
| 409 | `CAJA_YA_ABIERTA` | Ya hay un turno abierto | `turnoId` |

### `GET /api/caja/actual`

**200** `{ "turno": Turno }` con el resumen al momento, o `{ "turno": null }` si
la caja está cerrada (no es un 404).

### `GET /api/caja/cobrados`

Pedidos con algún pago en el turno abierto, del cobro más reciente al más
antiguo. Sirve para reenviar una nota de venta o corregir un pago antes del
cierre.

**200** — `{ "cobrados": [] }` si la caja está cerrada (no es un error):

```json
{
  "cobrados": [
    {
      "pedido": {
        "id": "…", "numero": 12, "tipo": "MESA",
        "mesa": { "id": "…", "nombre": "Mesa 3" }, "cliente": null,
        "total": "53.00", "totalPagado": "53.00", "saldoPendiente": "0.00", "pagado": true
      },
      "pagos": [
        { "id": "…", "metodo": "YAPE", "monto": "53.00", "recibido": null, "vuelto": "0.00", "referencia": "OP 1", "itemIds": [], "creadoEn": "…", "anulado": false, "anuladoEn": null, "anuladoPor": null, "motivoAnulacion": null }
      ],
      "ultimoPagoEn": "2026-10-07T16:02:00.000Z"
    }
  ]
}
```

`pagos` trae solo los de este turno, incluidos los anulados. `totalPagado` y
`saldoPendiente` son los del pedido completo. `cliente` es `{ nombre, telefono }`
o `null`.

### `POST /api/caja/cerrar`

**Body**

| Campo | Tipo | |
|---|---|---|
| `efectivoContado` | número ≥ 0 | Obligatorio. Lo que se contó en el cajón |
| `observacion` | texto ≤ 500 | Opcional |

**200**

```json
{
  "turno": { "…": "Turno con abierto: false, efectivoContado y diferencia" },
  "pedidosConPagoParcial": [
    { "id": "…", "numero": 4, "total": "53.00", "totalPagado": "20.00", "saldoPendiente": "33.00" }
  ],
  "aviso": "La caja se cerró con 1 pedido(s) con pago parcial pendiente de cobrar"
}
```

Los pedidos con pago parcial no impiden cerrar: se listan y se avisa. Sin ellos,
`pedidosConPagoParcial` es `[]` y `aviso` es `null`. Emite `caja:actualizada`.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta `efectivoContado` o es negativo |
| 409 | `SIN_CAJA_ABIERTA` | No hay turno abierto |

---

## Administración

Todo lo que cuelga de `/api/admin` es **solo para `ADMIN`** (403 `SIN_PERMISO`
para los demás). Como siempre, el negocio sale del token y lo de otro negocio
responde 404. Cada cambio emite `carta:actualizada` a todo el negocio.

**Regla general: lo que ya tiene historial no se borra.** Cada lista trae
`eliminable`; si es `false`, `DELETE` responde 409 `CON_HISTORIAL` y lo único
posible es desactivarlo (`activo: false`). Lo inactivo deja de salir en
`GET /carta`, `GET /mesas` y `GET /repartidores`, pero los pedidos pasados no
cambian (guardan su propia copia de nombres y precios).

Las rutas `…/mover` reciben `{ "direccion": "subir" | "bajar" }` y responden
204; en el extremo de la lista no hacen nada.

### Carta

#### `GET /api/admin/carta`

La carta entera, con lo inactivo.

```json
{
  "areas": [{ "id": "…", "nombre": "Cocina" }],
  "categorias": [
    {
      "id": "…", "nombre": "Frituras", "activo": true, "eliminable": false,
      "productos": [
        {
          "id": "…", "nombre": "Chicharrón de Pota", "categoriaId": "…", "areaId": "…",
          "tapers": 1, "activo": true, "esCombo": false, "comboCantidad": null, "eliminable": false,
          "variantes": [{ "id": "…", "nombre": "S/ 10", "precio": "10.00" }],
          "opcionesCombo": []
        }
      ]
    }
  ]
}
```

Una categoría es `eliminable` si no tiene platos; un plato, si nunca se vendió.
`variantes` trae solo las vigentes.

#### Categorías

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/admin/categorias` | `{ nombre }` | 201 `{ id }` (va al final) |
| PATCH | `/api/admin/categorias/:id` | `{ nombre?, activo? }` | 204 |
| DELETE | `/api/admin/categorias/:id` | | 204, o 409 `CON_HISTORIAL` si tiene platos |
| POST | `/api/admin/categorias/:id/mover` | `{ direccion }` | 204 |

#### `POST /api/admin/productos`

```json
{
  "nombre": "Chaufa de Mariscos",
  "categoriaId": "…",
  "areaId": "…",
  "tapers": 1,
  "variantes": [{ "nombre": "Personal", "precio": 15 }, { "nombre": "Fuente", "precio": 30 }],
  "esCombo": false,
  "comboCantidad": null,
  "opcionesCombo": []
}
```

| Campo | Regla |
|---|---|
| `variantes` | De 1 a 12. Con una sola, el nombre se guarda como `"Única"`; con varias, cada una lleva un nombre distinto. Precio de 0 a 9999 |
| `tapers` | 0 a 10 |
| `esCombo` | Un combo lleva `comboCantidad` (2 a 6), un solo precio y al menos un plato en `opcionesCombo` (ids de productos de esta carta que no sean combos) |

**201** `{ "id": "…" }`. El plato va al final de su categoría. **400** si algo
de lo anterior no se cumple o la categoría, el área o un plato del combo no son
de este negocio.

#### `PATCH /api/admin/productos/:id`

Los mismos campos, todos opcionales, más `activo`. Responde 204.

`variantes` reemplaza la lista completa: las que traen `id` se actualizan, las
que no, se crean, y las que ya no vienen se eliminan (si alguna se vendió, queda
retirada: no se borra, pero deja de ofrecerse). Al cambiar de categoría el plato
pasa al final de la nueva.

#### `PATCH /api/admin/variantes/:id/precio`

Cambio rápido de un precio. Body `{ "precio": 23.5 }`. **200**
`{ "id": "…", "precio": "23.50" }`. Los pedidos ya tomados conservan su precio.

#### `DELETE /api/admin/productos/:id` y `POST /api/admin/productos/:id/mover`

204. Eliminar responde 409 `CON_HISTORIAL` si el plato ya se vendió. Mover lo
sube o baja dentro de su categoría.

### Personal

#### `GET /api/admin/usuarios`

```json
{ "usuarios": [{ "id": "…", "nombre": "Soger", "usuario": "soger", "roles": ["MOZO"], "activo": true, "creadoEn": "…" }] }
```

#### `POST /api/admin/usuarios`

Body `{ nombre, usuario, password, roles }`. `usuario`: 3 a 30 letras
minúsculas, números, punto, guion o guion bajo (se pasa a minúsculas).
`password`: 6 caracteres como mínimo. `roles`: al menos uno. **201**
`{ "usuario": { … } }`; la persona ya puede iniciar sesión.

#### `PATCH /api/admin/usuarios/:id`

Body `{ nombre?, usuario?, roles?, activo? }`. **200** `{ "usuario": { … } }`.
Si cambian sus roles o se desactiva, su sesión deja de valer en la siguiente
petición (401).

#### `PUT /api/admin/usuarios/:id/password`

Body `{ "password": "…" }`. 204.

**Errores de personal**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 409 | `USUARIO_EN_USO` | Ya hay alguien con ese usuario en el negocio |
| 409 | `ES_TU_USUARIO` | El dueño intenta quitarse el rol `ADMIN` o desactivarse |
| 409 | `ULTIMO_ADMIN` | El cambio dejaría al negocio sin ningún `ADMIN` activo |

### Mesas, motorizados y notas rápidas

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/admin/mesas` | | `{ mesas: [{ id, nombre, activo, eliminable }] }` |
| POST | `/api/admin/mesas` | `{ nombre }` | 201 `{ id }` |
| PATCH | `/api/admin/mesas/:id` | `{ nombre?, activo? }` | 204; 409 `MESA_OCUPADA` al desactivar una mesa con un pedido abierto |
| DELETE | `/api/admin/mesas/:id` | | 204; 409 `CON_HISTORIAL` si ya tuvo pedidos |
| POST | `/api/admin/mesas/:id/mover` | `{ direccion }` | 204 |
| GET | `/api/admin/repartidores` | | `{ repartidores: [{ id, nombre, telefono, activo, eliminable }] }` |
| POST | `/api/admin/repartidores` | `{ nombre, telefono? }` | 201 `{ id }` |
| PATCH | `/api/admin/repartidores/:id` | `{ nombre?, telefono?, activo? }` | 204. `telefono: ""` o `null` lo quita |
| DELETE | `/api/admin/repartidores/:id` | | 204; 409 `CON_HISTORIAL` si ya llevó pedidos |
| GET | `/api/admin/notas` | | `{ notas: [{ id, texto, activo, eliminable }] }` |
| POST | `/api/admin/notas` | `{ texto }` | 201 `{ id }` |
| PATCH | `/api/admin/notas/:id` | `{ texto?, activo? }` | 204 |
| DELETE | `/api/admin/notas/:id` | | 204 (una nota siempre se puede eliminar) |
| POST | `/api/admin/notas/:id/mover` | `{ direccion }` | 204 |

El teléfono se normaliza igual que el de los clientes (solo dígitos, sin el 51).

### Negocio

#### `GET /api/admin/negocio` y `PATCH /api/admin/negocio`

```json
{
  "negocio": {
    "id": "…", "codigo": "valentina", "nombre": "Cevichería Valentina",
    "logoUrl": "/api/negocios/valentina/logo?v=1",
    "costoEnvioDefault": "3.00", "precioTaper": "1.00",
    "distritos": ["Tarapoto", "Morales", "La Banda de Shilcayo"], "region": "San Martín, Perú",
    "umbralTardaMin": 15, "umbralMuyTardeMin": 25
  }
}
```

`PATCH` recibe cualquiera de `nombre`, `costoEnvioDefault` y `precioTaper` (0 a
20), `region`, `distritos` (lista completa, sin repetidos; el primero es el de
por defecto), `umbralTardaMin` y `umbralMuyTardeMin` (1 a 240 minutos; el
segundo tiene que ser mayor). Responde el negocio actualizado. El `codigo` no se
cambia.

#### `PUT /api/admin/negocio/logo`

El cuerpo es **la imagen tal cual** (no JSON), con `Content-Type: image/png`,
`image/jpeg` o `image/webp`, de 1 MB como máximo. El tipo se comprueba por el
contenido del archivo. Responde `{ "negocio": { … } }` con el `logoUrl` nuevo.

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `SOLICITUD_INVALIDA` | No es una imagen PNG, JPG o WebP |
| 413 | `CUERPO_MUY_GRANDE` | Pesa más de 1 MB |

#### `DELETE /api/admin/negocio/logo`

Quita el logo (`logoUrl: null`). Responde `{ "negocio": { … } }`.

### `GET /api/admin/reportes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`

Días completos en la hora del negocio (America/Lima), los dos incluidos; un año
como máximo. **400** si falta una fecha o el rango está al revés.

```json
{
  "desde": "2026-10-07",
  "hasta": "2026-10-07",
  "ventas": {
    "total": "430.00",
    "pedidos": 18,
    "ticketPromedio": "23.89",
    "porMetodo": { "EFECTIVO": "250.00", "YAPE": "150.00", "PLIN": "0.00", "TARJETA": "30.00" },
    "porTipo": { "MESA": "300.00", "PARA_LLEVAR": "40.00", "DELIVERY": "90.00" },
    "porDia": [{ "fecha": "2026-10-07", "total": "430.00", "pedidos": 18 }]
  },
  "porCobrar": { "total": "53.00", "pedidos": 2 },
  "pedidosTomados": 20,
  "platos": [{ "nombre": "Ceviche Simple", "cantidad": 14, "total": "280.00" }],
  "porHora": [{ "hora": 0, "pedidos": 0 }, { "hora": 13, "pedidos": 9 }],
  "cocina": { "promedioMin": 11.4, "platos": 52, "porArea": [{ "area": "Cocina", "promedioMin": 12.8, "platos": 40 }] },
  "turnos": [],
  "correcciones": [
    { "id": "…", "tipo": "ANULACION", "detalle": { "motivo": "Se cobró dos veces", "metodo": "TARJETA", "monto": "13.00" }, "creadoEn": "…", "usuario": "Diana", "monto": "13.00", "pedido": { "id": "…", "numero": 7 } }
  ]
}
```

| Campo | Qué cuenta |
|---|---|
| `ventas` | **Lo cobrado en esos días**: pagos vigentes (los anulados no cuentan) por su fecha de cobro. `pedidos` son los pedidos distintos con algún cobro y `ticketPromedio` es `total / pedidos`. `porDia` trae todos los días del rango, también los que están en cero |
| `porCobrar` | Pedidos tomados en esos días, no cancelados, que todavía deben algo, y cuánto |
| `pedidosTomados` | Pedidos creados en esos días, sin los cancelados |
| `platos` | Los 10 más pedidos en esos días (sin los cancelados), por unidades; `total` es `cantidad × precio` |
| `porHora` | Siempre 24 filas (0 a 23, hora del negocio): pedidos tomados en esa hora |
| `cocina` | Minutos promedio desde que se pide un plato hasta que se marca listo, en general y por área. `promedioMin` es `null` si no hay platos listos |
| `turnos` | Los [turnos de caja](#turno-de-caja) abiertos en esos días, del más reciente al más antiguo, con su `diferencia` al cierre |
| `correcciones` | Cada cambio de método (`"METODO"`, con `detalle.antes` y `detalle.despues`) o anulación (`"ANULACION"`, con `detalle.motivo`) hecha en esos días |

---

## Tiempo real (Socket.IO)

Socket.IO corre sobre el mismo servidor y puerto que la API.

**Conexión.** El JWT va en el handshake:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { auth: { token } });

socket.on("connect_error", (err) => {
  // err.message === "No autenticado": token ausente, inválido, vencido,
  // o usuario desactivado / con roles cambiados. Llevar al login.
});
```

Cada socket entra solo a la sala de su negocio (`negocio:<id>`): nunca recibe
eventos de otro. La sesión se comprueba al conectar; no hay que unirse a nada ni
enviar mensajes: el servidor solo emite.

**Eventos (servidor → cliente)**

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `pedido:creado` | [Pedido](#pedido) completo | `POST /pedidos` (no en reintentos con el mismo `idCliente`) |
| `pedido:actualizado` | [Pedido](#pedido) completo | Ronda agregada, cambio de estado de items, item cancelado, cargos, repartidor, estado del pedido, pagos y sus correcciones |
| `caja:actualizada` | [Turno](#turno-de-caja) con su resumen | Apertura de caja, cada cobro, cada corrección de un pago, cierre de caja |
| `carta:actualizada` | `{}` | Cualquier cambio hecho desde [Administración](#administración) en la carta, las mesas, los motorizados, las notas rápidas o los datos del negocio |

Todos se emiten después de confirmar la transacción y los recibe todo el
negocio, incluido el dispositivo que hizo el cambio.

Notas para el frontend:

- El payload es siempre el objeto completo: basta con reemplazar el pedido (por
  `id`) o el turno en el estado local.
- `pedido:actualizado` trae **todos** los items aunque el panel esté filtrado por
  área; filtrar por `items[].areaId` en el cliente.
- Un pedido deja de estar "activo" cuando `estado` es `CANCELADO`, o cuando es
  `ENTREGADO` y además `pagado`.
- Las mesas no tienen evento propio: una mesa cambia con los pedidos de tipo
  `MESA` (ocupada mientras tenga uno no pagado y no cancelado).
- Con `carta:actualizada` hay que volver a pedir `GET /carta`, `GET /mesas`,
  `GET /repartidores` y `GET /auth/yo` (nombre y logo): el evento no trae datos.
- Tras una reconexión, volver a pedir `GET /pedidos/activos` (y `GET
  /caja/actual` si aplica): los eventos emitidos durante el corte no se reenvían.

---

## Resumen de endpoints

| Método | Ruta | Roles | Evento |
|---|---|---|---|
| POST | `/api/auth/login` | público | |
| GET | `/api/auth/yo` | cualquiera | |
| GET | `/api/negocios/:codigo/publico` | público | |
| GET | `/api/negocios/:codigo/logo` | público | |
| GET | `/api/salud` | público | |
| GET | `/api/carta` | cualquiera | |
| GET | `/api/mesas` | MOZO, LOCAL, ADMIN | |
| GET | `/api/clientes/buscar?telefono=` | cualquiera | |
| GET | `/api/clientes/ultimo-pedido?telefono=` | cualquiera | |
| GET | `/api/repartidores` | cualquiera | |
| POST | `/api/pedidos` | MOZO, LOCAL, ADMIN | `pedido:creado` |
| GET | `/api/pedidos/activos[?areaId=]` | cualquiera | |
| GET | `/api/pedidos/por-telefono` | cualquiera | |
| POST | `/api/pedidos/:id/items` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/items/estado` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/items/:itemId/cancelar` | MOZO, LOCAL, ADMIN (no pendiente: solo ADMIN) | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/cargos` | LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/entrega` | LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/cancelar` | LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/repartidor` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/estado` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| GET | `/api/pedidos/:id/cuenta` | cualquiera | |
| POST | `/api/pedidos/:id/pagos` | LOCAL, ADMIN | `pedido:actualizado`, `caja:actualizada` |
| PATCH | `/api/pedidos/:id/pagos/:pagoId/metodo` | LOCAL, ADMIN | `pedido:actualizado`, `caja:actualizada` |
| PATCH | `/api/pedidos/:id/pagos/:pagoId/anular` | LOCAL, ADMIN | `pedido:actualizado`, `caja:actualizada` |
| GET | `/api/pedidos/:id/nota-venta` | cualquiera | |
| POST | `/api/caja/abrir` | LOCAL, ADMIN | `caja:actualizada` |
| GET | `/api/caja/actual` | LOCAL, ADMIN | |
| GET | `/api/caja/cobrados` | LOCAL, ADMIN | |
| POST | `/api/caja/cerrar` | LOCAL, ADMIN | `caja:actualizada` |
| GET | `/api/admin/carta`, `/usuarios`, `/mesas`, `/repartidores`, `/notas`, `/negocio`, `/reportes` | ADMIN | |
| POST, PATCH, PUT, DELETE | `/api/admin/…` (ver [Administración](#administración)) | ADMIN | `carta:actualizada` |
