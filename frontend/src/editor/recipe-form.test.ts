import { describe, expect, it } from 'vitest';
import { recipeDetail } from '../test/fixtures';
import type { RecipeDetail } from '../api/recipes';
import { draftIssues, emptyForm, formatFieldIssue, fromRecipe, moveRow, newIngredient, publishIssues, toExperiment, toPayload } from './recipe-form';

const recipe = { ...recipeDetail, status: 'DRAFT', authorId: 'owner' } as RecipeDetail;
describe('mapper editor dan aturan sebelum request', () => {
  it('mempertahankan Decimal dan seluruh metadata ketika memuat lalu menyimpan', () => {
    const form = fromRecipe(recipe);
    const payload = toPayload(form);
    expect(payload.ingredients[0]).toEqual({ name: 'Madu', quantity: '25.125', unit: 'g', note: 'Madu cair', changeReason: 'Mengganti gula', observedEffect: 'Aroma lebih kuat' });
    expect(toExperiment(form)).toEqual({ experimentGoal: 'Mengurangi gula pasir', experimentResult: 'Tekstur lebih lembut', experimentStatus: 'SUCCESS' });
    expect(payload.ingredients[0]).not.toHaveProperty('id');
    expect(payload.ingredients[0]).not.toHaveProperty('position');
  });
  it('mengosongkan field nullable secara eksplisit dan tidak mengirim null untuk note', () => {
    const form = fromRecipe(recipe);
    form.ingredients[0].note = ''; form.ingredients[0].changeReason = ' '; form.ingredients[0].observedEffect = '';
    expect(toPayload(form).ingredients[0]).toEqual({ name: 'Madu', quantity: '25.125', unit: 'g', changeReason: null, observedEffect: null });
    form.experimentGoal = '  ';
    expect(toExperiment(form).experimentGoal).toBeNull();
  });
  it('mengizinkan draft tanpa bahan/langkah tetapi tetap menolak publish yang belum lengkap', () => {
    const form = emptyForm(); form.title = 'A';
    expect(draftIssues(form, false)).toEqual([]);
    expect(toPayload(form)).toEqual({ title: 'A', ingredients: [], steps: [] });
    expect(publishIssues(form, false)).toHaveLength(3);
  });
  it.each(['0', '-1', '1,5', '1.0001', '1000000000'])('menolak jumlah %s yang akan ditolak backend', quantity => {
    const form = fromRecipe(recipe); form.ingredients[0].quantity = quantity;
    expect(draftIssues(form, true).some(issue => issue.includes('positive amount'))).toBe(true);
  });
  it('baris berisi catatan saja tidak dibuang diam-diam', () => {
    const form = emptyForm(); form.title = 'Roti';
    form.ingredients.push({ ...newIngredient(), note: 'Jangan hilang' });
    expect(toPayload(form).ingredients).toHaveLength(1);
    const issues = draftIssues(form, false);
    expect(issues).toHaveLength(3);
    expect(issues.every(issue => issue.includes('ingredient 2'))).toBe(true);
    expect(formatFieldIssue(form, { field: 'ingredients.0.quantity', message: 'Invalid quantity format.' }))
      .toBe('Ingredient 2 amount (Invalid quantity format)');
  });
  it('reorder memindahkan catatan bersama bahannya tanpa mengubah array asal', () => {
    const form = fromRecipe(recipe);
    const original = form.ingredients;
    form.ingredients = moveRow(form.ingredients, 0, 1);
    expect(toPayload(form).ingredients[1].changeReason).toBe('Mengganti gula');
    expect(original[0].name).toBe('Madu');
    expect(moveRow(original, 0, -1)).toBe(original);
  });
  it('menuntut hasil eksperimen untuk status sudah diuji dan menerapkan batas form', () => {
    const form = fromRecipe(recipe); form.experimentResult = '';
    expect(draftIssues(form, true)).toContain('Add a result when you mark an experiment as tested');
    form.ingredients = Array.from({ length: 51 }, newIngredient);
    expect(draftIssues(form, true)).toContain('Use up to 50 ingredients and 50 steps');
  });
});
