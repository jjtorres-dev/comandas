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
  de la barra inferior más el área segura del dispositivo.
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

### Salir (local)
Pide una segunda pulsación: el botón pasa a rojo con "¿Salir?" durante 4
segundos. Un toque accidental no deja la cocina sin pantalla.

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
