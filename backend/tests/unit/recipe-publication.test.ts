import { describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import { getPublishIssues } from "../../src/services/recipe-publication.rules.js";
import { draft, ingredient, step } from "../helpers/recipes.js";

describe("Validasi publish", () => {
  it("menerima draft dengan konten lengkap", () => {
    expect(getPublishIssues(draft())).toEqual([]);
  });
  it("menolak resep yang sudah published", () => {
    expect(getPublishIssues(draft({ status: "PUBLISHED" }))).toContainEqual(expect.objectContaining({ field: "status" }));
  });
  it("tetap mensyaratkan title publish minimal 3 karakter", () => {
    expect(getPublishIssues(draft({ title: "A" }))).toContainEqual(expect.objectContaining({ field: "title" }));
  });
  it("menolak draft tanpa bahan dan langkah", () => {
    expect(getPublishIssues({ ...draft(), ingredients: [], steps: [] }).map(item => item.field)).toEqual(["ingredients", "steps"]);
  });
  it.each(["0", "-1"])("menolak quantity %s", (value) => {
    expect(getPublishIssues({ ...draft(), ingredients: [ingredient({ quantity: new Prisma.Decimal(value) })] })).toContainEqual(expect.objectContaining({ field: "ingredients" }));
  });
  it("menolak nama bahan atau unit kosong", () => {
    expect(getPublishIssues({ ...draft(), ingredients: [ingredient({ name: " ", unit: " " })] })).toContainEqual(expect.objectContaining({ field: "ingredients" }));
  });
  it("menolak instruksi kosong", () => {
    expect(getPublishIssues({ ...draft(), steps: [step({ instruction: " " })] })).toContainEqual(expect.objectContaining({ field: "steps" }));
  });
});
