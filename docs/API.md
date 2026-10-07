# API de Comandas

Referencia de todos los endpoints HTTP y eventos de Socket.IO del backend.

- [Convenciones](#convenciones)
- [Objetos](#objetos): [Pedido](#pedido) · [Turno de caja](#turno-de-caja)
- [Auth](#auth) · [Carta](#carta) · [Mesas](#mesas) · [Clientes](#clientes) · [Repartidores](#repartidores)
- [Pedidos](#pedidos) · [Cuenta y pagos](#cuenta-y-pagos) · [Caja](#caja)
- [Tiempo real (Socket.IO)](#tiempo-real-socketio)
- [Resumen de endpoints](#resumen-de-endpoints)

## Convenciones

| Tema | Regla |
|---|---|
| URL base | `http://localhost:3000/api` en desarrollo |
| Formato | JSON en peticiones y respuestas (`Content-Type: application/json`). Cuerpo máximo: 100 kB |
| Autenticación | `Authorization: Bearer <token>` en todo excepto `POST /auth/login` y `GET /salud` |
| Negocio | Sale siempre del token. Ningún endpoint recibe `negocioId` |
| Montos (respuesta) | Texto con 2 decimales: `"25.00"` |
| Montos (petición) | Número con 2 decimales como máximo: `25` o `25.5` |
| Fechas | ISO 8601 en UTC: `"2026-10-07T15:39:12.123Z"` |
| Ids | UUID. Un id mal formado responde 400 |
| Campos desconocidos | Se ignoran (por ejemplo, un `precio` enviado por el cliente) |

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
| 413 | `CUERPO_MUY_GRANDE` | Cuerpo de más de 100 kB |
| 429 | `DEMASIADOS_INTENTOS` | Límite de intentos de login |
| 500 | `ERROR_INTERNO` | Error inesperado |

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
  "mozo": { "id": "…", "nombre": "Mozo" },
  "cliente": { "nombre": "Rosa Pérez", "telefono": "987654321" },
  "direccionEntrega": "Jr. San Martín 245",
  "referenciaEntrega": "Frente al parque",
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
      "creadoEn": "2026-10-07T15:39:12.123Z"
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
| `mozo` | `{ id, nombre }` de quien creó el pedido (sea cual sea su rol) |
| `cliente` | `{ nombre, telefono }` (cualquiera puede ser `null`), o `null` si no hay datos. Siempre `null` en `MESA` |
| `direccionEntrega`, `referenciaEntrega` | Solo `DELIVERY`. Copia del momento del pedido |
| `repartidor` | `{ id, nombre }` o `null` |
| `total` | `subtotal + costoEnvio + cargoTapers - descuento` |
| `tapersManual` | `true` si la cantidad de tapers se fijó a mano y ya no se recalcula |
| `pagado` | `true` cuando lo cobrado iguala el total. Un pedido de mesa pagado libera la mesa |
| `items` | En el orden en que se pidieron (`orden`: 1, 2, 3… a lo largo de todas las rondas). **Incluye los cancelados** |
| `items[].estado` | `PENDIENTE`, `PREPARANDO`, `LISTO`, `ENTREGADO`, `CANCELADO` |
| `items[].nombreProducto` | `"Producto"`, o `"Producto — Variante"` si la variante no es "Única". Copia del momento del pedido, igual que `precioUnitario` |
| `items[].componentes` | Solo combos: nombres de los platos elegidos. `[]` en el resto |
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
| `pedidosCobrados` | Pedidos distintos con al menos un pago en este turno |
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
  "negocio": { "id": "…", "codigo": "valentina", "nombre": "Cevichería Valentina" }
}
```

El token es un JWT con `usuarioId`, `negocioId` y `roles`; dura 12 horas.

**Errores**

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta algún campo |
| 401 | `NO_AUTENTICADO` | Negocio, usuario o contraseña incorrectos, o usuario/negocio inactivo. El mensaje es el mismo en todos los casos |
| 429 | `DEMASIADOS_INTENTOS` | Se superó el límite; reintentar en un minuto |

### `GET /api/salud`

Sin autenticación. **200** `{ "ok": true }`.

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
  "notasRapidas": [{ "id": "…", "texto": "Sin cebolla" }]
}
```

| Campo | Notas |
|---|---|
| `variantes` | Todo producto tiene al menos una. Si solo hay una llamada `"Única"`, no hace falta mostrar selector. Al pedir se envía el `id` de la variante |
| `tapers` | Tapers que ocupa una unidad en delivery / para llevar (0 = bebidas) |
| `esCombo`, `comboCantidad` | En un combo el cliente elige exactamente `comboCantidad` platos (2 = doble, 3 = triple) |
| `opcionesCombo` | Solo combos: `[{ productoId, nombre }]`, los platos elegibles. El `productoId` es lo que se envía en `componentes` |
| `notasRapidas` | Botones de texto para las notas de un item |

---

## Mesas

### `GET /api/mesas`

**Roles**: `MOZO`, `LOCAL`, `ADMIN`. Mesas activas en orden. Una mesa está
ocupada si tiene un pedido no pagado y no cancelado.

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
{ "cliente": { "id": "…", "telefono": "987654321", "nombre": "Rosa Pérez", "direccion": "Jr. San Martín 245", "referencia": "Frente al parque" } }
```

**Errores**: 400 `DATOS_INVALIDOS` si falta `telefono` o no tiene entre 6 y 15 dígitos.

Los clientes se crean y actualizan solos al registrar pedidos con teléfono; no
hay endpoint para crearlos.

---

## Repartidores

### `GET /api/repartidores`

**Roles**: cualquiera. Repartidores activos, por nombre.

**200** `{ "repartidores": [{ "id": "…", "nombre": "Motorizado", "telefono": null }] }`

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

Despacho del pedido completo. **Roles**: `MOZO`, `LOCAL`, `ADMIN`.

**Body** `{ "estado": "EN_CAMINO" }` o `{ "estado": "ENTREGADO" }`

| `estado` | Condición | Efecto |
|---|---|---|
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
      { "id": "…", "nombreProducto": "Ceviche Simple", "componentes": [], "cantidad": 2, "precioUnitario": "20.00", "subtotal": "40.00", "pagado": true },
      { "id": "…", "nombreProducto": "Gaseosa Personal", "componentes": [], "cantidad": 1, "precioUnitario": "3.00", "subtotal": "3.00", "pagado": false }
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
      { "id": "…", "metodo": "YAPE", "monto": "40.00", "referencia": null, "itemIds": ["…"], "creadoEn": "2026-10-07T16:02:00.000Z" }
    ]
  }
}
```

| Campo | Notas |
|---|---|
| `items` | Sin los cancelados. `subtotal = precioUnitario × cantidad` |
| `items[].pagado` | `true` si el item figura en los `itemIds` de algún pago, o si el pedido entero está pagado |
| `pagos[].itemIds` | Items que cubrió ese pago; `[]` si fue a cuenta del total |

**Errores**: 404 `NO_ENCONTRADO`.

### `POST /api/pedidos/:id/pagos`

Registra uno o varios pagos. **Roles**: `LOCAL`, `ADMIN`. Requiere caja abierta.

**Body**

| Campo | Tipo | |
|---|---|---|
| `pagos` | lista, 1–10 | Obligatorio. Varios pagos en una misma petición = pago mixto |
| `itemIds` | lista de UUID, 1–100 | Opcional. Cuenta dividida: los items que se están pagando |

`pagos[]`:

| Campo | Tipo | |
|---|---|---|
| `metodo` | `"EFECTIVO"` \| `"YAPE"` \| `"PLIN"` \| `"TARJETA"` | Obligatorio |
| `monto` | número > 0 | Obligatorio. Lo que se cobra (sin el vuelto) |
| `recibido` | número ≥ `monto` | Solo `EFECTIVO`: con cuánto pagó el cliente. Si falta, se asume pago exacto |
| `referencia` | texto ≤ 100 | Opcional. Nº de operación de Yape/Plin o voucher |

Reglas:

- La suma de los `monto` no puede superar el saldo pendiente.
- Con `itemIds`: los items deben ser del pedido, no estar cancelados ni ya
  pagados, y la suma de los `monto` debe ser **exactamente** la suma de sus
  subtotales. Envío, tapers y descuento no pertenecen a ningún item: ese resto se
  cobra con un pago sin `itemIds`.
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
| 409 | `ITEM_PAGADO` | Alguno de los `itemIds` ya estaba pagado | `itemIds` |
| 409 | `PEDIDO_PAGADO` | El pedido ya está pagado | |
| 409 | `PEDIDO_CANCELADO` | El pedido está cancelado | |

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
  descuento solo aparecen si no son cero. Sin pagos dice `Pago: pendiente`; con
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
| `pedido:actualizado` | [Pedido](#pedido) completo | Ronda agregada, cambio de estado de items, item cancelado, cargos, repartidor, estado del pedido, pagos |
| `caja:actualizada` | [Turno](#turno-de-caja) con su resumen | Apertura de caja, cada cobro, cierre de caja |

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
- Tras una reconexión, volver a pedir `GET /pedidos/activos` (y `GET
  /caja/actual` si aplica): los eventos emitidos durante el corte no se reenvían.

---

## Resumen de endpoints

| Método | Ruta | Roles | Evento |
|---|---|---|---|
| POST | `/api/auth/login` | público | |
| GET | `/api/salud` | público | |
| GET | `/api/carta` | cualquiera | |
| GET | `/api/mesas` | MOZO, LOCAL, ADMIN | |
| GET | `/api/clientes/buscar?telefono=` | cualquiera | |
| GET | `/api/repartidores` | cualquiera | |
| POST | `/api/pedidos` | MOZO, LOCAL, ADMIN | `pedido:creado` |
| GET | `/api/pedidos/activos[?areaId=]` | cualquiera | |
| POST | `/api/pedidos/:id/items` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/items/estado` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/items/:itemId/cancelar` | MOZO, LOCAL, ADMIN (no pendiente: solo ADMIN) | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/cargos` | LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/repartidor` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| PATCH | `/api/pedidos/:id/estado` | MOZO, LOCAL, ADMIN | `pedido:actualizado` |
| GET | `/api/pedidos/:id/cuenta` | cualquiera | |
| POST | `/api/pedidos/:id/pagos` | LOCAL, ADMIN | `pedido:actualizado`, `caja:actualizada` |
| GET | `/api/pedidos/:id/nota-venta` | cualquiera | |
| POST | `/api/caja/abrir` | LOCAL, ADMIN | `caja:actualizada` |
| GET | `/api/caja/actual` | LOCAL, ADMIN | |
| POST | `/api/caja/cerrar` | LOCAL, ADMIN | `caja:actualizada` |
