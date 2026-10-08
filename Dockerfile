# Comandas en un solo servicio: el backend (Express + Socket.IO) sirve también
# el build del frontend. Pensado para Railway; se prueba igual con Podman o Docker:
#   podman build -t comandas .
# Las variables que necesita al arrancar están en backend/.env.example.

# ---------- 1. Frontend: Vite deja la aplicación web en frontend/dist ----------
FROM docker.io/library/node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Sin VITE_API_URL: la API está en el mismo origen
RUN npm run build

# ---------- 2. Backend: tsc deja el servidor en backend/dist ----------
FROM docker.io/library/node:22-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
# `prisma generate` lee prisma.config.ts, que exige la variable aunque no se
# conecte a nada: vale cualquier URL y no queda en la imagen final
RUN DATABASE_URL="postgresql://sin:usar@localhost:5432/solo_para_compilar" npm run build
# Fuera lo que solo sirve para compilar y probar (tsx, vitest, typescript…)
RUN npm prune --omit=dev

# ---------- 3. Imagen final: solo lo que hace falta para correr ----------
FROM docker.io/library/node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=backend --chown=node:node /app/backend/dist ./dist
# Prisma necesita el schema y las migraciones para `migrate deploy`
COPY --chown=node:node backend/package.json backend/prisma.config.ts ./
COPY --chown=node:node backend/prisma/schema.prisma ./prisma/schema.prisma
COPY --chown=node:node backend/prisma/migrations ./prisma/migrations
COPY --from=frontend --chown=node:node /app/frontend/dist /app/frontend/dist
# El seed de producción carga este logo si el negocio todavía no tiene uno
COPY --chown=node:node design-ref/logo.png /app/design-ref/logo.png

# Sin privilegios de administrador dentro del contenedor
USER node
EXPOSE 3000
# 1) Revisa las variables de entorno y, si falta alguna, lo dice claro y sale.
# 2) Aplica las migraciones pendientes; si fallan, el servidor no arranca.
# 3) `exec` deja a node como proceso principal: recibe el SIGTERM de Railway y cierra con orden
CMD ["sh", "-c", "node dist/config/env.js && ./node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
