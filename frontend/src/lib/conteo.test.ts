import { describe, expect, it } from "vitest";
import { contar, conteo, conteoDeItems, conteoDeProductos } from "./conteo";

const plato = (cantidad: number) => ({ cantidad, pasaPorCocina: true });
const bebida = (cantidad: number) => ({ cantidad, pasaPorCocina: false });

describe("conteo: platos y bebidas", () => {
  it("solo platos", () => {
    expect(conteo([plato(2)])).toBe("2 platos");
    expect(conteo([plato(1), plato(1)])).toBe("2 platos");
  });

  it("solo bebidas", () => {
    expect(conteo([bebida(6)])).toBe("6 bebidas");
  });

  it("ambos: los platos primero, aunque las bebidas se hayan pedido antes", () => {
    expect(conteo([bebida(6), plato(2)])).toBe("2 platos · 6 bebidas");
  });

  it("singular con 1", () => {
    expect(conteo([plato(1)])).toBe("1 plato");
    expect(conteo([bebida(1)])).toBe("1 bebida");
    expect(conteo([plato(1), bebida(1)])).toBe("1 plato · 1 bebida");
    expect(conteo([plato(1), bebida(3)])).toBe("1 plato · 3 bebidas");
  });

  it("los cancelados no cuentan", () => {
    expect(conteo([plato(2), { ...plato(3), cancelado: true }, { ...bebida(6), cancelado: true }])).toBe("2 platos");
    expect(conteo([{ ...plato(1), cancelado: true }, bebida(2)])).toBe("2 bebidas");
  });

  it("si el área no se conoce, cuenta como plato", () => {
    expect(conteo([{ cantidad: 2 }, { cantidad: 1, pasaPorCocina: null }, bebida(1)])).toBe("3 platos · 1 bebida");
  });

  it("sin nada que contar dice 0 platos", () => {
    expect(conteo([])).toBe("0 platos");
    expect(conteo([{ ...bebida(2), cancelado: true }])).toBe("0 platos");
  });

  it("contar devuelve los dos números", () => {
    expect(contar([plato(2), bebida(6), plato(1)])).toEqual({ platos: 3, bebidas: 6 });
  });
});

describe("conteoDeItems: los items de un pedido", () => {
  const item = (cantidad: number, pasaPorCocina: boolean, estado = "PENDIENTE") => ({ cantidad, pasaPorCocina, estado }) as Parameters<typeof conteoDeItems>[0][number];

  it("un combo es un item: cuenta como 1 plato", () => {
    // Combo Triple (trae 3 platos) + 1 ceviche + 6 cervezas ya en la mesa
    expect(conteoDeItems([item(1, true), item(1, true), item(6, false, "ENTREGADO")])).toBe("2 platos · 6 bebidas");
  });

  it("deja fuera los items cancelados", () => {
    expect(conteoDeItems([item(2, true), item(1, true, "CANCELADO"), item(1, false, "CANCELADO")])).toBe("2 platos");
  });
});

describe("conteoDeProductos: lo que todavía no se envía", () => {
  const carta = {
    areas: [
      { id: "cocina", nombre: "Cocina", pasaPorCocina: true },
      { id: "bebidas", nombre: "Bebidas", pasaPorCocina: false },
    ],
    categorias: [
      { productos: [{ id: "ceviche", areaId: "cocina" }, { id: "combo", areaId: "cocina" }] },
      { productos: [{ id: "cerveza", areaId: "bebidas" }, { id: "raro", areaId: "area-borrada" }] },
    ],
  };
  const linea = (productoId: string, cantidad: number) => ({ productoId, cantidad });

  it("el área sale de la carta, por el producto", () => {
    expect(conteoDeProductos([linea("cerveza", 6)], carta)).toBe("6 bebidas");
    expect(conteoDeProductos([linea("cerveza", 6), linea("ceviche", 1), linea("combo", 1)], carta)).toBe("2 platos · 6 bebidas");
  });

  it("un producto que ya no está en la carta, o de un área que no se conoce, cuenta como plato", () => {
    expect(conteoDeProductos([linea("ya-no-existe", 1), linea("raro", 1), linea("cerveza", 1)], carta)).toBe("2 platos · 1 bebida");
  });

  it("sin carta todavía, todo cuenta como plato", () => {
    expect(conteoDeProductos([linea("cerveza", 6)], undefined)).toBe("6 platos");
  });
});
