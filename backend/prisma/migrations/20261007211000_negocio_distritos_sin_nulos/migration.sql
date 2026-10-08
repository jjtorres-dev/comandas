-- Los negocios que ya existían quedaron con "distritos" en NULL al agregar la
-- columna: una lista vacía dice lo mismo ("sin distritos definidos") sin nulos
UPDATE "Negocio" SET "distritos" = '{}' WHERE "distritos" IS NULL;
