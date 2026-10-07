# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite para el frontend (decidido en `CLAUDE.md`; todavía no hay código de
frontend). Consume el backend existente: API REST en Express 5 y eventos de
Socket.IO, documentados en `docs/API.md`.

## Users

Personal de restaurantes y cevicherías pequeñas. En el primer cliente, la
Cevichería Valentina (Tarapoto, Perú), son tres puestos:

- **Mozo** (rol `MOZO`): toma pedidos de pie, en el salón, desde su propio
  celular Android. Su trabajo es anotar rápido lo que pide la mesa, mandar
  rondas adicionales y saber cuándo algo está listo.
- **Cocina y caja** (rol `LOCAL`): en este local es una sola persona (la tía).
  Ve los pedidos que entran, marca su avance, cobra y lleva el turno de caja.
  Trabaja frente a un monitor de PC; si no hay PC disponible, en un celular.
- **Dueño** (rol `ADMIN`): puede hacer todo lo anterior. Carta, precios, mesas,
  usuarios y reportes son su responsabilidad, pero el backend todavía no tiene
  endpoints para administrarlos.

Condiciones confirmadas de uso:

- Horas punta con mucha prisa: se toman pedidos de pie y con apuro.
- Personal poco habituado a apps; hoy no trabajan con un sistema.
- Pantallas difíciles de leer: local con mucha luz, y cocina con manos mojadas
  o pantalla sucia.

## Product Purpose

Sistema de comandas (POS) que lleva un pedido desde que el mozo lo toma hasta
que se cobra: el pedido aparece al instante en cocina, su estado vuelve al mozo
y la caja cuadra al cierre del turno. Cubre atención en mesa, para llevar y
delivery.

La Cevichería Valentina es el piloto. El objetivo es venderlo a más
restaurantes y cevicherías; por eso es multi-negocio desde el inicio.

## Positioning

Hecho a la medida de cómo trabaja una cevichería peruana pequeña, no adaptado
de un POS genérico:

- Combos doble y triple donde el cliente elige los platos.
- Tapers cobrados por unidad en delivery y para llevar, calculados según el
  producto.
- Cobro con efectivo (con vuelto), Yape, Plin y tarjeta, y cuenta dividida por
  items.
- Un mismo puesto puede ser cocina y caja a la vez.
- Funciona con los celulares que el personal ya tiene: sin tablets ni
  impresoras.

## Operating Context

- **Dispositivos**: celulares Android personales (mozo) y un monitor de PC o un
  celular (cocina y caja). No hay tablet ni impresora por ahora.
- **Flujo de un pedido**: `PENDIENTE` → `PREPARANDO` → `LISTO` → `EN_CAMINO`
  (solo delivery) → `ENTREGADO`, o `CANCELADO`. Cada item tiene además su
  propio estado.
- **Tipos de pedido**: `MESA`, `PARA_LLEVAR` y `DELIVERY`. Delivery y para
  llevar guardan nombre, teléfono, dirección y referencia del cliente; delivery
  suma costo de envío y puede tener repartidor asignado.
- **Rondas**: a un pedido abierto se le agregan items en rondas sucesivas.
- **Caja**: un solo turno abierto por negocio, con monto inicial, cobros por
  método de pago y cierre.
- **Tiempo real**: todos los dispositivos del negocio reciben cada pedido nuevo
  o modificado y cada cambio de caja.
- **Sesión**: se entra con código de negocio, usuario y contraseña. El token
  dura 12 horas.
- **Moneda**: soles (S/), siempre con 2 decimales.

## Capabilities and Constraints

Lo que el backend ya ofrece (referencia: `docs/API.md`):

- Login, carta completa (categorías, productos, variantes, combos, notas
  rápidas, áreas), mesas con su estado de ocupación, búsqueda de clientes por
  teléfono y lista de repartidores.
- Crear pedidos, agregar rondas, cambiar estado de items y de pedidos, cancelar
  items, ajustar cargos (envío, tapers, descuento) y asignar repartidor.
- Cuenta, pagos (incluida cuenta dividida) y nota de venta.
- Abrir, consultar y cerrar el turno de caja.

Restricciones que el frontend debe respetar:

- El negocio sale siempre del token; ninguna pantalla lo elige ni lo envía.
- Precios y nombres salen del servidor, nunca del cliente.
- Caja, cobros y cargos son solo para `LOCAL` y `ADMIN`.
- Crear un pedido y agregar una ronda llevan un UUID generado en el cliente
  para que un reintento no duplique nada.
- Tras una reconexión hay que volver a pedir los pedidos activos: los eventos
  perdidos no se reenvían.
- Ante un 401, volver al login.
- Mensajes de error del servidor en español.
- Código y comentarios en español.

Decisiones abiertas:

- Administración de carta, precios, mesas y usuarios, y reportes: sin endpoints
  todavía.
- Impresión de comandas o notas de venta: no hay impresora por ahora.
- Logo por negocio: `Negocio` guarda nombre pero no logo ni otros datos de
  marca.

## Brand Commitments

- La interfaz lleva la marca del negocio que inició sesión (hoy, Cevichería
  Valentina). "Comandas" es el nombre interno del producto y no tiene identidad
  propia definida.
- Logo de la Cevichería Valentina: `design-ref/logo.png`.
- Toda la interfaz en español, con el vocabulario del local: comanda, mozo,
  mesa, ronda, taper, para llevar, delivery, repartidor, caja, turno, vuelto,
  Yape, Plin.

## Evidence on Hand

- `design-ref/logo.png`: logo de la Cevichería Valentina.
- `design-ref/carta-1.jpg` y `design-ref/carta-2.jpg`: fotos de la carta
  impresa.
- `prisma/seed.ts`: carta real cargada (ceviches y leches, sudados, arroces y
  chaufas, frituras, guarniciones, combos, bebidas) con sus precios, y los
  usuarios de desarrollo.
- `docs/API.md`: contrato completo de endpoints y eventos.

No hay testimonios, métricas de uso, precios del producto ni otros clientes: no
inventarlos.

## Product Principles

1. **La hora punta manda.** Lo que se usa con el local lleno (tomar un pedido,
   ver qué falta, cobrar) va primero y en el menor número de pasos.
2. **Se entiende sin capacitación.** Palabras del local, una acción clara por
   momento y nada que requiera saber de sistemas.
3. **El servidor es la verdad.** La pantalla muestra lo que confirmó el
   servidor; precios, totales y estados no se calculan ni se suponen en el
   cliente.
4. **Nada se pierde ni se duplica.** Un pedido enviado dos veces sigue siendo
   uno, y tras un corte la pantalla se vuelve a poner al día sola.
5. **Sirve para el siguiente restaurante.** Nada queda atado a Valentina: la
   marca, la carta y los puestos salen de los datos del negocio.

## Accessibility & Inclusion

- Legible con mucha luz ambiental y con la pantalla sucia o mojada.
- Controles que se aciertan con prisa, de pie y con los dedos mojados.
- Lenguaje llano en español para personas con poca costumbre de usar apps.
