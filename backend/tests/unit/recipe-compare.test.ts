import { describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import { compareIngredients, compareSteps } from "../../src/services/recipe-compare.rules.js";
import { ingredient, step } from "../helpers/recipes.js";

describe("Compare bahan: aturan nama dan satuan yang sudah ada", () => {
  it("mengenali bahan baru", () => {
    expect(compareIngredients([], [ingredient()])[0]).toMatchObject({ type: "ADDED", before: null, after: { name: "Gula" } });
  });
  it("mengenali bahan dihapus", () => {
    expect(compareIngredients([ingredient()], [])[0]).toMatchObject({ type: "REMOVED", before: { name: "Gula" }, after: null });
  });
  it("mengenali perubahan quantity", () => {
    const changes = compareIngredients([ingredient()], [ingredient({ quantity: new Prisma.Decimal("80.125") })]);
    expect(changes[0]).toMatchObject({ type: "MODIFIED", before: { quantity: "100" }, after: { quantity: "80.125" } });
  });
  it("menganggap Decimal setara tetap unchanged", () => {
    expect(compareIngredients([ingredient()], [ingredient({ quantity: new Prisma.Decimal("100.000") })])[0].type).toBe("UNCHANGED");
  });
  it("mengenali perubahan note", () => {
    expect(compareIngredients([ingredient()], [ingredient({ note: "Gula halus" })])[0].type).toBe("MODIFIED");
  });
  it("rename tetap removed dan added, tanpa mengubah algoritma", () => {
    expect(compareIngredients([ingredient()], [ingredient({ name: "Gula kastor" })]).map(item => item.type)).toEqual(["REMOVED", "ADDED"]);
  });
  it("menormalisasi kapital dan spasi nama/satuan untuk matching", () => {
    expect(compareIngredients([ingredient()], [ingredient({ name: " GULA ", unit: " G " })])[0].type).toBe("UNCHANGED");
  });
  it("tidak menghilangkan bahan dengan key duplikat", () => {
    const changes = compareIngredients([ingredient(), ingredient({ position: 2 })], [ingredient()]);
    expect(changes.map(item => item.type)).toEqual(["UNCHANGED", "REMOVED"]);
  });
  it("mengembalikan annotations walaupun flag perubahan isi tetap unchanged", () => {
    const changes = compareIngredients([ingredient()], [ingredient({ changeReason: "Percobaan", observedEffect: "Lebih lembut" })]);
    expect(changes[0]).toMatchObject({ type: "UNCHANGED", after: { changeReason: "Percobaan", observedEffect: "Lebih lembut" } });
  });
});

describe("Compare langkah: matching berdasarkan posisi", () => {
  it("menangani unchanged, modified, dan added secara berurutan", () => {
    const original = [step(), step({ position: 2, instruction: "Panggang." })];
    const fork = [step(), step({ position: 2, instruction: "Kukus." }), step({ position: 3, instruction: "Sajikan." })];
    expect(compareSteps(original, fork).map(item => item.type)).toEqual(["UNCHANGED", "MODIFIED", "ADDED"]);
  });
  it("mengenali posisi yang dihapus", () => {
    expect(compareSteps([step()], [])[0]).toMatchObject({ type: "REMOVED", after: null });
  });
  it("menjaga perilaku positional diff ketika disisipi langkah pertama", () => {
    const fork = [step({ instruction: "Panaskan oven." }), step({ position: 2 })];
    expect(compareSteps([step()], fork).map(item => item.type)).toEqual(["MODIFIED", "ADDED"]);
  });
});
