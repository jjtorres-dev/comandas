# Desplegar Comandas en Railway

Guía paso a paso para poner Comandas en internet con [Railway](https://railway.com),
escrita para quien nunca lo usó. Al terminar tendrás la aplicación en una
dirección `https://….up.railway.app`, con su base de datos.

> Railway cambia sus pantallas de vez en cuando. Si un botón no se llama
> exactamente como aquí, busca el que diga lo mismo con otras palabras; la
> documentación oficial está en <https://docs.railway.com>.

## Qué se despliega

**Un solo servicio** y una base de datos:

| Pieza | Qué es |
|---|---|
| Servicio `comandas` | La imagen que construye el `Dockerfile` de la raíz. El backend (API y tiempo real) sirve también la aplicación web: todo sale del mismo dominio |
| PostgreSQL | La base de datos que ofrece Railway. Ahí vive todo: carta, pedidos, caja y también el logo |

Cada vez que el servicio arranca aplica solo las migraciones pendientes de la
base (`prisma migrate deploy`) y recién después levanta el servidor. Si una
migración falla, la versión nueva no entra y sigue funcionando la anterior.

## Antes de empezar

- El código en un repositorio de **GitHub** (puede ser privado).
- Una cuenta en Railway con un plan de pago (el plan gratuito de prueba se
  agota y apaga el servicio).
- En tu computadora, para los pasos 6 y 8: [Node.js 22](https://nodejs.org) y
  **Podman** o Docker.

Comprueba primero que la imagen construye en tu equipo. Desde la raíz del
proyecto:

```bash
podman build -t comandas .
```

## 1. Crear el proyecto

1. Entra a <https://railway.com> e inicia sesión con tu cuenta de GitHub.
2. **New Project → Deploy from GitHub repo**. La primera vez Railway pide
   permiso para ver tus repositorios: dáselo al de Comandas.
3. Elige el repositorio. Railway crea un servicio y empieza a construir la
   imagen con el `Dockerfile` (lo indica `railway.json`).

**Ese primer intento va a fallar: es normal.** Todavía no tiene base de datos
ni variables. En el registro verás algo así, que es justo lo que falta:

```
No se puede arrancar: faltan o están mal estas variables de entorno
  - DATABASE_URL: falta. …
  - JWT_SECRET: falta. …
```

## 2. Agregar PostgreSQL

1. En el lienzo del proyecto: **+ New → Database → Add PostgreSQL**.
2. Espera a que quede en verde. No hay que configurarle nada.

Fíjate cómo se llama ese servicio (normalmente `Postgres`): lo necesitas en el
paso siguiente.

## 3. Variables del servicio

Clic en el servicio de la aplicación (no en el de Postgres) → pestaña
**Variables** → **New Variable**. Agrega estas:

| Variable | Valor | Para qué |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | La conexión a la base. Se escribe tal cual, con las llaves: Railway la reemplaza sola. Si tu base no se llama `Postgres`, usa su nombre |
| `JWT_SECRET` | un texto aleatorio de 64 caracteres | Firma las sesiones. Genera el tuyo (abajo) y **no lo compartas ni lo subas a GitHub** |
| `NODE_ENV` | `production` | La imagen ya lo trae, pero conviene dejarlo escrito |
| `TRUST_PROXY` | `1` | Railway pone un proxy delante: con esto los límites de intentos ven la IP real de cada equipo |

`PORT` **no se agrega**: Railway la define sola.

Para generar el `JWT_SECRET`, en una terminal:

```bash
openssl rand -hex 32
```

Si más adelante cambias el `JWT_SECRET`, todas las sesiones abiertas dejan de
valer y cada persona tiene que volver a entrar. Nada más.

Para el primer arranque agrega además las tres del **usuario inicial** (el
dueño; se explican en el paso 6):

| Variable | Ejemplo |
|---|---|
| `ADMIN_INICIAL_NOMBRE` | `Colver Falcón` |
| `ADMIN_INICIAL_USUARIO` | `colver` (minúsculas, sin espacios) |
| `ADMIN_INICIAL_PASSWORD` | una contraseña de 8 caracteres o más |

Guarda los cambios (**Deploy**). El servicio se vuelve a construir y esta vez
arranca.

## 4. Comprobar que arrancó

En el servicio → pestaña **Deployments** → el despliegue más reciente → **View
logs**. Tiene que verse:

```
All migrations have been successfully applied.
Comandas escuchando en el puerto 8080 (production)
```

(el número de puerto lo pone Railway). Railway además consulta sola
`/api/salud` para saber si el servicio está sano; esa ruta comprueba también la
conexión con la base.

## 5. Dominio

Servicio → **Settings → Networking → Generate Domain**. Si pregunta por el
puerto, elige el que aparece en el registro del paso anterior.

Railway te da una dirección como `https://comandas-production-xxxx.up.railway.app`,
ya con HTTPS. Ábrela: tiene que salir el login. Todavía no puedes entrar: falta
crear el negocio.

## 6. Primer seed: crear el negocio

El **seed de producción** crea la Cevichería Valentina con su carta, mesas,
distritos, notas rápidas, logo y el motorizado, y el usuario inicial con las
tres variables `ADMIN_INICIAL_…` del paso 3.

- **Nunca borra ni cambia nada.** Crea solo lo que falta, así que se puede
  correr más de una vez sin miedo.
- El usuario inicial solo se crea si el negocio **no tiene ningún usuario**. No
  hay usuarios de prueba.

Se corre **dentro** del servicio, con la herramienta de Railway para la
terminal:

```bash
npm install -g @railway/cli   # una sola vez
railway login                 # abre el navegador para iniciar sesión
railway link                  # elige el proyecto y el servicio de la aplicación
railway ssh                   # abre una terminal dentro del servicio
```

Ya dentro del servicio:

```bash
npm run seed:produccion
exit
```

Tiene que responder:

```
Seed de producción listo (código del negocio: valentina).
  Se creó: el negocio, la carta, las mesas, las notas rápidas, el motorizado José Falcón, el usuario inicial "colver" (dueño, cocina y caja).
```

Ahora entra a la dirección del paso 5 con:

- **Código del negocio:** `valentina`
- **Usuario y contraseña:** los de `ADMIN_INICIAL_USUARIO` y `ADMIN_INICIAL_PASSWORD`

Ese usuario es dueño y también cocina y caja. Desde **Administración →
Personal** crea a los demás (mozo, cocina y caja) con sus propias contraseñas.

**Después del primer ingreso, borra las tres variables `ADMIN_INICIAL_…`** en
la pestaña Variables: ya no hacen falta y así la contraseña no queda escrita en
Railway. Puedes cambiar esa contraseña desde Administración → Personal.

## 7. Ver los registros (logs)

- **En la web:** servicio → **Deployments** → **View logs**. Hay un buscador
  arriba.
- **En la terminal:** `railway logs` (o `railway logs -n 200` para las últimas
  200 líneas).

Cada línea es un JSON con la hora, el nivel y, en las peticiones, su id:

```json
{"level":"info","time":"2026-10-08T01:15:02.123Z","req":{"id":"7b1c…","method":"POST","url":"/api/pedidos"},"res":{"statusCode":201},"responseTime":41,"msg":"request completed"}
```

- No registran contraseñas, tokens, ni el contenido de los pedidos.
- Si a alguien le sale "Error interno del servidor", el aviso trae un
  `idPeticion`. Búscalo en los logs y verás el error completo de esa petición.
- Para más detalle por un rato, agrega la variable `LOG_LEVEL=debug`; para
  menos, `LOG_LEVEL=warn`.

## 8. Respaldos

### La opción simple: los de Railway

En el servicio de **Postgres → pestaña Backups** se pueden hacer copias a mano
y programarlas (diarias, semanales). Se restauran desde esa misma pestaña.
Actívalas: es la red de seguridad del día a día.

### Una copia en tu poder

Para tener el archivo fuera de Railway (recomendado al menos una vez por
semana, y siempre antes de un cambio grande):

1. La base es privada. Para llegar desde tu computadora, en el servicio de
   **Postgres → Settings → Networking** activa el acceso público (**Public
   Networking / TCP Proxy**). Aparece la variable `DATABASE_PUBLIC_URL` en la
   pestaña Variables de Postgres: cópiala.
2. En tu computadora, dentro de la carpeta `backend/` (con `npm install` hecho):

   ```bash
   DATABASE_URL='pega-aquí-la-DATABASE_PUBLIC_URL' npm run respaldo
   ```

   Deja un archivo como `backend/respaldos/comandas-2026-10-07-2130.dump`
   (fecha y hora de Lima). No necesitas instalar PostgreSQL: si no lo tienes,
   el script usa `pg_dump` desde su imagen oficial con Podman o Docker, de la
   misma versión que el servidor.
3. Guarda ese archivo fuera de la computadora (Drive, un USB). **Contiene todos
   los datos del negocio**: no lo subas a GitHub (la carpeta `respaldos/` ya
   está ignorada).
4. Si no vas a hacer respaldos seguido, vuelve a apagar el acceso público.

### Restaurar un respaldo

Restaurar **reemplaza todo** lo que hay en la base por lo del archivo. Úsalo
solo si de verdad hay que volver atrás.

```bash
DATABASE_URL='la-DATABASE_PUBLIC_URL' npm run restaurar -- respaldos/comandas-2026-10-07-2130.dump
```

Pide escribir el nombre de la base para confirmar. Va en una sola transacción:
o entra todo, o la base queda como estaba. Al terminar, reinicia el servicio de
la aplicación (Deployments → menú de los tres puntos → **Restart**).

Conviene ensayarlo una vez contra una base de prueba, para saber que el
respaldo sirve antes de necesitarlo.

## 9. Publicar una versión nueva

Sube los cambios a la rama principal de GitHub (`git push`). Railway construye
la imagen y, si arranca bien y `/api/salud` responde, reemplaza a la anterior.
Si no arranca, la anterior sigue en pie.

En los equipos que tienen la aplicación abierta aparece el aviso **"Hay una
versión nueva · Actualizar"** (tarda hasta 15 minutos, o al volver a la app).
Nunca se recarga sola: cada persona toca "Actualizar" cuando le viene bien, y
los pedidos sin enviar del mozo se conservan.

## 10. Volver a una versión anterior

Si la versión nueva salió mal:

1. Servicio → pestaña **Deployments**.
2. Busca el último despliegue que funcionaba, abre su menú de los **tres
   puntos** y elige **Rollback** (o **Redeploy**).
3. Railway vuelve a poner esa imagen, con las variables que tenía.

Dos cosas a tener en cuenta:

- **Volver atrás el código no vuelve atrás la base.** Si la versión nueva
  agregó columnas o tablas, se quedan; casi siempre la versión anterior
  funciona igual con ellas. Si no (una migración que borró o renombró algo),
  hay que restaurar el respaldo de antes de publicar. Por eso: **respaldo antes
  de cada versión que cambie la base**.
- En GitHub, deshaz también el cambio (`git revert`) para que el próximo `push`
  no vuelva a publicar la versión mala.

## Problemas frecuentes

| Qué pasa | Qué revisar |
|---|---|
| El servicio no arranca y el log dice "No se puede arrancar: faltan o están mal…" | El mismo mensaje dice qué variable corregir (paso 3) |
| El log dice que no puede conectarse a la base | Que `DATABASE_URL` sea `${{Postgres.DATABASE_URL}}` con el nombre correcto del servicio de la base, y que Postgres esté en verde |
| "Error: P3009" o una migración fallida | Una migración quedó a medias. No borres nada: guarda el log y restaura el último respaldo si hace falta |
| El login dice "No existe un negocio con ese código" | Falta correr el seed (paso 6), o el código está mal escrito: es `valentina` |
| El seed dice "faltan los datos del primero" | Faltan las variables `ADMIN_INICIAL_…` en el servicio (paso 3). Tras agregarlas, espera a que redespliegue y vuelve a entrar con `railway ssh` |
| "Demasiados intentos" al entrar | Hay 5 intentos fallidos por minuto por equipo. Espera un minuto. Si le pasa a todos a la vez, revisa `TRUST_PROXY=1` |
| La app no se actualiza en un celular | Tocar "Actualizar" en el aviso; si no aparece, cerrar la app del todo y volver a abrirla |

## Probar la imagen en tu equipo

Para ensayar un despliegue sin tocar Railway, contra una base local:

```bash
podman build -t comandas .
podman run --rm --network host \
  -e DATABASE_URL='postgresql://comandas:comandas_dev@localhost:5433/una_base_de_prueba' \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e PORT=3000 -e TRUST_PROXY=false \
  comandas
```

Y abre <http://localhost:3000>. Usa una base de prueba, no la de desarrollo: al
arrancar aplica las migraciones.
