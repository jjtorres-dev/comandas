import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: la URL de conexión vive aquí, no en schema.prisma
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
