---
name: Comandas
description: Comandas para restaurantes y cevicherías, legibles con prisa, con sol y a distancia
colors:
  primario: "#0BB2AC"
  primario-presionado: "#0AA19C"
  primario-fuerte: "#077A76"
  primario-profundo: "#065F5C"
  primario-suave: "#D9F3F1"
  acento: "#E28430"
  acento-fuerte: "#A8500F"
  acento-suave: "#FCEBDA"
  marino: "#173863"
  tinta: "#0E2748"
  texto-suave: "#46597A"
  listo: "#BDC767"
  listo-fuerte: "#55600F"
  listo-suave: "#EEF2CF"
  alerta: "#F2B21B"
  alerta-fuerte: "#7A5200"
  alerta-suave: "#FDF1CC"
  peligro: "#B3261E"
  peligro-suave: "#FBE4E2"
  fondo: "#EFF5F6"
  superficie: "#FFFFFF"
  borde: "#C5D3DC"
  borde-fuerte: "#7C8FA6"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.11
  headline:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  interior: "10px"
  control: "14px"
  panel: "20px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  boton-primario:
    backgroundColor: "{colors.primario}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "56px"
    padding: "0 24px"
  boton-primario-hover:
    backgroundColor: "{colors.primario-presionado}"
  boton-peligro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.peligro}"
    rounded: "{rounded.control}"
    height: "56px"
  campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "56px"
    padding: "0 16px"
  cabecera:
    backgroundColor: "{colors.primario}"
    textColor: "{colors.tinta}"
  pestana-activa:
    backgroundColor: "{colors.marino}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.interior}"
  nav-inferior-activa:
    backgroundColor: "{colors.primario-suave}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "64px"
  indicador-en-linea:
    backgroundColor: "{colors.listo-suave}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    height: "36px"
  indicador-reconectando:
    backgroundColor: "{colors.alerta}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    height: "36px"
---

# Design System: Comandas

## Overview

**Creative North Star: "La carta plastificada"**

La carta de una cevichería se lee de pie, con sol y con las manos ocupadas:
turquesa plano, letras gruesas, precios grandes. Comandas toma de ahí su
paleta, su peso tipográfico y su borde ondulado, y nada más. La estructura es
la de una herramienta de trabajo: cada pantalla dice dónde estás, qué hay y
qué se puede tocar.

El tema es claro porque se usa de día, en un local abierto y con la pantalla a
veces sucia. El color hace trabajos concretos: el turquesa marca el armazón y
la acción principal, el marino es el texto, y lima, ámbar y rojo son estados.

Los tokens viven en `frontend/src/estilos.css` (bloque `@theme` de Tailwind
v4). Este documento los explica; si difieren, manda el frontmatter.

**Key Characteristics:**
- Tema claro, sin modo oscuro.
- Turquesa plano en el armazón; texto marino sobre blanco en el contenido.
- Una sola familia tipográfica, con cuerpo de 18 px como mínimo.
- Controles de 56 px de alto; ningún destino táctil baja de 48 px.
- El nombre y el logo del negocio vienen siempre de la API.

## Colors

Cuatro colores salen de `design-ref/`, muestreados de los archivos; el resto
son variantes del mismo tono para cumplir contraste.

| Origen | Token | Medido en |
|---|---|---|
| Carta, fondo | `primario` | color dominante de `carta-1.jpg` y `carta-2.jpg` |
| Carta, títulos | `acento` | "CEVICHERIA VALENTINA" en `carta-1.jpg` |
| Logo, aro | `marino` | color dominante de `logo.png` |
| Logo, limones | `listo` | rodajas de limón de `logo.png` |

### Primary
- **Turquesa de carta** (`primario`): cabecera, campo superior del login y
  botón principal. Nunca lleva texto blanco (2.63:1); lleva `tinta` (5.69:1).
- **Turquesa presionado** (`primario-presionado`): hover del botón principal.
- **Turquesa fuerte** (`primario-fuerte`): íconos y texto turquesa sobre blanco
  (5.18:1).
- **Turquesa profundo** (`primario-profundo`): lo mismo cuando se necesita AAA
  (7.50:1 sobre blanco).
- **Turquesa suave** (`primario-suave`): destino activo de la navegación
  inferior, hover y selección de texto.

### Secondary
- **Naranja de carta** (`acento`): reservado para llamar la atención sobre un
  elemento por pantalla. Como relleno lleva `tinta` (5.40:1).
- **Naranja fuerte** (`acento-fuerte`): texto e íconos naranjas sobre blanco
  (5.50:1).
- **Naranja suave** (`acento-suave`): fondo de avisos de acento.

### Tertiary
- **Lima** (`listo`, `listo-fuerte`, `listo-suave`): éxito y "listo". El
  relleno lleva `tinta` (8.22:1); el texto usa `listo-fuerte` (6.85:1).
- **Ámbar** (`alerta`, `alerta-fuerte`, `alerta-suave`): alerta y
  "reconectando". No está en las referencias: se eligió más amarillo que el
  naranja para que no se confundan. Relleno con `tinta` (7.96:1).
- **Rojo** (`peligro`, `peligro-suave`): errores y acciones destructivas.
  Tampoco está en las referencias. Texto sobre blanco 6.54:1; blanco sobre
  rojo 6.54:1.

### Neutral
- **Marino** (`marino`): texto por defecto. 11.78:1 sobre blanco y 10.70:1
  sobre `fondo`: AAA en cualquier tamaño.
- **Tinta** (`tinta`): marino oscurecido para títulos y para todo texto sobre
  un relleno de color.
- **Texto suave** (`texto-suave`): ayudas y etiquetas secundarias. 7.07:1 sobre
  blanco, 6.42:1 sobre `fondo`.
- **Papel** (`fondo`): fondo de la app, tomado del papel claro de la carta.
- **Superficie** (`superficie`): campos, paneles y barras.
- **Borde** (`borde`): separadores decorativos.
- **Borde fuerte** (`borde-fuerte`): contorno de campos y zonas vacías
  (3.31:1 sobre blanco).

### Named Rules
**La regla de la tinta.** Sobre turquesa, naranja, lima o ámbar el texto es
siempre `tinta`, nunca blanco. Blanco solo sobre `marino` y `peligro`.

**La regla de la cocina.** En `/local` el contenido es marino o tinta sobre
blanco o papel (AAA). El texto sobre un relleno de color mide al menos 20 px
en negrita, que es donde 5.4:1 a 5.7:1 alcanza AAA para texto grande.

**Las reglas de `/local`.** En el panel de cocina el color tiene un solo
significado cada uno, para leerlo a 2 o 3 metros:

- **Tipo de pedido** (franja de la tarjeta): Mesa en blanco con filete de
  tinta, Para llevar en `primario`, Delivery en `acento`. Es la única excepción
  a la reserva del naranja, y vale solo en `/local`.
- **Tardanza**: `alerta` con "Tarda" (15 min) y `peligro` con "Muy tarde"
  (25 min), en la píldora del tiempo y en el borde de la tarjeta.
- **Listo**: `listo`, en el botón y en lo ya terminado.
- **Notas**: inverso, `marino` con texto blanco en negrita e ícono de aviso.
  Ningún otro elemento del contenido de `/local` usa ese tratamiento.

**La regla del estado doble.** Un estado nunca se comunica solo con color:
lleva ícono y palabra ("En línea", "Reconectando").

## Typography

**Display Font:** Atkinson Hyperlegible Next Variable (con ui-sans-serif, system-ui)
**Body Font:** la misma

**Character:** Una familia diseñada para lectores con baja visión: letras y
números que no se confunden entre sí (1, l, I; 0, O) a distancia o con
reflejos. Se sirve desde el propio proyecto (`@fontsource-variable`), sin
depender de la red.

### Hierarchy
- **Display** (700, 2.25rem, 1.11): título de pantalla en monitor y nombre del
  negocio en el login.
- **Headline** (700, 1.875rem, 1.2): título de pantalla en celular.
- **Title** (700, 1.5rem, 1.33): encabezado de formulario y pestañas en monitor.
- **Body** (400, 1.125rem, 1.55): texto corrido. 1.25rem en campos y botones.
- **Label** (700, 1rem, 1.5): etiquetas de navegación, ayudas y errores. Es el
  tamaño más pequeño del sistema.

### Named Rules
**La regla de los 16.** Ningún texto baja de 16 px, y el cuerpo es de 18 px.

**La regla del peso.** La jerarquía se marca con negrita y tamaño, no con
mayúsculas sostenidas ni con gris.

## Layout

- **Celular (`/mozo`)**: una columna con 16 px de margen, cabecera fija arriba
  y navegación fija abajo, al alcance del pulgar. El contenido reserva el alto
  de la barra inferior más el área segura del dispositivo. Lo que se toca vive
  en la mitad inferior; arriba solo se lee.
- **Monitor (`/local`)**: ancho completo con 32 px de margen. Las pestañas
  viven dentro de la cabecera; por debajo de 1024 px bajan a una segunda fila
  de ancho completo.
- **Login**: campo turquesa de al menos 38% del alto con la marca centrada, y
  formulario en una columna de 448 px como máximo.
- Alto mínimo `100dvh`, nunca `100vh`. Sin desplazamiento horizontal a 412 px
  ni a 1920 px.
- Espaciado en pasos de 4 px: grupos apretados (8 px), campos (20 a 24 px),
  secciones (32 px).

## Elevation & Depth

Plano por defecto: la profundidad viene del contraste entre papel, superficie
y turquesa. Solo dos sombras, ambas teñidas de tinta.

### Shadow Vocabulary
- **Plato** (`box-shadow: 0 6px 20px -6px rgb(14 39 72 / 0.35)`): el disco
  blanco que sostiene el logo.
- **Barra** (`box-shadow: 0 -4px 16px -8px rgb(14 39 72 / 0.25)`): separa la
  navegación inferior del contenido que pasa por debajo.

## Shapes

Esquinas redondeadas y amables, en tres pasos: controles 14 px, paneles 20 px,
y 10 px para lo que vive dentro de un control (pestañas, botón de ver
contraseña). Las píldoras completas se reservan para estados. Los bordes son de
2 px: uno de 1 px desaparece con sol.

**El plato.** El logo del negocio se sirve siempre sobre un disco blanco:
llega de la API con cualquier forma y color, y así se lee sobre el turquesa.
Sin logo, el plato muestra las iniciales.

**La ola.** El campo turquesa del login termina en la misma curva que la carta
impresa. Es la única forma decorativa del sistema y solo aparece ahí.

## Components

### Buttons
- **Shape:** esquinas de control (14 px), 56 px de alto, ancho completo en
  formularios, texto de 20 px en negrita.
- **Primary:** relleno `primario`, texto `tinta`.
- **Hover / Focus:** hover a `primario-presionado`; foco con anillo marino de
  3 px separado 2 px; al presionar, escala a 0.97 en 160 ms.
- **Peligro:** fondo blanco, borde y texto `peligro`; hover a `peligro-suave`.
- **Texto:** subrayado de 2 px, 48 px de alto, para acciones secundarias como
  "Cambiar de negocio".
- **Ocupado:** el ícono se cambia por un indicador giratorio y el botón se
  bloquea.

### Inputs / Fields
- **Style:** fondo blanco, borde `borde-fuerte` de 2 px, 56 px de alto, texto
  de 20 px. La etiqueta va siempre arriba, en negrita.
- **Focus:** borde marino más el anillo de foco.
- **Error:** borde `peligro` y mensaje debajo con ícono, en negrita.
- **Ayuda:** debajo del campo, en `texto-suave`.

### Navigation
- **Cabecera:** franja `primario` con el plato del logo, el nombre del negocio
  (hasta dos líneas) y el indicador de conexión.
- **Navegación inferior (mozo):** tres destinos de 64 px de alto con ícono de
  28 px y etiqueta. El activo lleva fondo `primario-suave`, texto `tinta` e
  ícono relleno; el fondo se desliza de un destino a otro en 200 ms.
- **Pestañas (local):** grupo blanco dentro de la cabecera; la activa es
  `marino` con texto blanco. 48 px de alto en celular, 56 px y texto de 24 px
  en monitor.

### Indicador de conexión
Píldora de 36 px siempre visible en la cabecera. "En línea": fondo
`listo-suave` con ícono de wifi. "Reconectando": fondo `alerta` con ícono
giratorio.

### Segunda pulsación
Lo destructivo pide una segunda pulsación: el botón pasa a rojo con la
pregunta ("¿Salir?", "Sí, cancelar", "Sí, borrar") durante 4 segundos, sin
cambiar de ancho. Un toque
accidental no deja la cocina sin pantalla ni borra un plato. Lo usan Salir
(local) y `BotonConfirmar` (cancelar un item, descartar un pedido de la cola).

### Cabecera de pantalla (mozo)
Las pantallas de una sola tarea (tomar pedido, resumen, mesa) cambian la marca
por una flecha de volver de 48 px, el título (la mesa) y una segunda línea que
dice en qué paso estás. No llevan navegación inferior: su borde de abajo es de
la acción principal.

### Baldosa de mesa
Grilla de 2 columnas, 128 px de alto mínimo, siempre en el mismo orden. Cinco
estados, cada uno con ícono y palabra:

| Estado | Fondo y borde | Dice |
|---|---|---|
| Libre | `superficie`, `borde-fuerte` | "Libre" |
| Ocupada | `primario-suave`, `marino` | total y "hace 25 min" |
| Listo | `listo`, `tinta` de 3 px, campana rellena | "2 platos listos" |
| Falta enviar | `superficie`, `marino` punteado | "Falta enviar · 3 platos" (le toca al mozo) |
| Esperando conexión | `alerta-suave`, `alerta-fuerte` | "Esperando conexión" (le toca al celular) |

El relleno lima completo se reserva para "listo": baldosa, tarjeta de pedido,
banda del detalle, píldora y aviso.

### Botón de producto
Dos columnas, 112 px de alto mínimo: nombre en negrita (hasta 3 líneas) y
precio. Un toque suma 1. Con unidades pasa a `primario-suave` con borde
`primario-profundo`, muestra la cantidad en un disco `marino` y un "−" de 48 px.

### Chips
Píldoras de 48 px con borde de 2 px; la elegida es `marino` con texto blanco.
Se usan para categorías (fila deslizable, sin barra) y notas rápidas (con un
check al marcarlas). Una nota ya puesta se muestra como etiqueta `fondo` con
borde, nunca en naranja.

### Hoja inferior
Para una decisión corta (variante, combo, notas, cola, mesa ocupada): un
`<dialog>` modal anclado abajo, con título, botón de cerrar de 48 px, cuerpo
desplazable y acciones fijas al pie. Sube en 280 ms con curva de cajón y baja
en 180 ms; con movimiento reducido solo cambia la opacidad. Con el teclado
abierto ocupa todo el alto visible y su pie queda encima del teclado: el botón
de acción nunca se tapa.

Dentro de una hoja las preguntas van en el orden de la decisión, de arriba
abajo. En las notas: a cuántas unidades aplica ("¿Para los 2 o solo para 1?"),
en un combo a qué plato, y recién después qué nota. Una pregunta de dos
respuestas se muestra como dos opciones juntas con una siempre elegida.

### Avisos
Los avisos (sonner) salen abajo, justo encima de la navegación inferior o de
la barra del pedido, y nunca tapan un control. El de "listo" es lima con
campana; su botón de acción mide 48 px.

### Barra de pedido
Fija abajo con la sombra Barra: un solo botón de 64 px. En la carta dice
cuántos platos, el total y "Ver pedido"; en el resumen, "Enviar a cocina".

### Franja de cola
Franja `alerta` bajo la cabecera, en todas las pantallas del mozo, mientras
haya algo que no llegó a cocina: "1 pedido por enviar · Ver". No aparece en un
envío normal, solo cuando ya falló una vez.

### Píldora de estado
32 px, ícono y palabra: Pendiente (`fondo`), Preparando (`alerta-suave`),
Listo (`listo`), Entregado (`primario-suave`), Cancelado (`peligro-suave`).

### Comanda (cocina)
Una tarjeta por pedido con platos por preparar, la más antigua primero, en dos
columnas en monitor (una tarjeta corta sube al hueco que deja una larga) y en
lista en celular. Son dos y no tres porque, con los tamaños de lectura a
distancia, es el ancho en que una tarjeta de 6 platos cabe entera. De arriba abajo: franja del tipo con el número y el tiempo; nota general;
rondas ya hechas en una línea gris; cada ronda pendiente como bloque (con
"Ronda 2" y "NUEVO" si nadie la empezó), sus platos agrupados por área; y al
pie "Empezar" y "Listo" de 72 px.

Tamaños mínimos en monitor (1920×1080), con sus tokens: número del pedido
48 px, cantidad 40 px (`text-cantidad`), plato 28 px (`text-plato`), nota 26 px
en negrita (`text-nota`), tiempo 24 px. Una tarjeta de 6 platos cabe entera en
pantalla. En celular bajan en proporción (36, 36, 24, 20 y 20 px).

Cada plato es una fila tocable que lo marca listo a él solo; tocar uno ya
listo lo devuelve a preparación. El estado va bajo la cantidad, o una vez en el
encabezado del área si todo el grupo está igual.

### Deshacer (cocina)
Todo cambio de estado muestra durante 8 segundos qué se hizo y un botón
"Deshacer", con una línea que se acorta. En monitor va en la fila del filtro, a
la derecha, donde no tapa ninguna tarjeta; en celular, abajo. Lo marcado listo
queda además en "Recién listos" (columna angosta en monitor, franja plegada en
celular) con "Deshacer" y "Entregado".

### Empezar turno
`/local` abre con un solo botón enorme: ese toque activa el sonido de los
pedidos nuevos y pide mantener la pantalla encendida. Si el navegador no lo
permite, queda una franja `alerta-suave` que lo dice.

### Feedback
Tres animaciones, todas de una sola vez: `pulso` (180 ms) en la cantidad que
cambia, `llegada` (280 ms) cuando algo pasa a listo o cambia de estado, y la
confirmación "Enviando a cocina" (450 ms en pantalla). Solo responden a algo
que acaba de pasar: no se disparan al abrir una pantalla ni se repiten en bucle.

## Do's and Don'ts

### Do:
- **Do** usar `tinta` para todo texto sobre un relleno de color.
- **Do** acompañar cada estado con ícono y palabra.
- **Do** mantener cada destino táctil en 48 px o más, y los controles
  principales en 56 px.
- **Do** tomar el nombre y el logo del negocio de la API y servir el logo
  sobre el plato blanco.
- **Do** usar íconos de Phosphor en un solo peso por contexto: relleno para lo
  activo, regular para el resto.
- **Do** respetar `prefers-reduced-motion`: sin desplazamientos, solo cambios
  de color y opacidad.

### Don't:
- **Don't** poner texto blanco sobre turquesa, naranja, lima o ámbar.
- **Don't** escribir el nombre o el logo de un negocio en el código.
- **Don't** usar texto de menos de 16 px ni bordes de 1 px en controles.
- **Don't** usar el naranja para estados: es acento; la alerta es ámbar.
- **Don't** repetir la ola fuera del login ni añadir más formas decorativas.
- **Don't** animar nada por encima de 300 ms ni acciones que se repiten todo
  el turno.
