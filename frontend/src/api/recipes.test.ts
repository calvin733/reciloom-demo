import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getRecipe, getRecipes } from './recipes';
import { jsonResponse, original, recipeDetail, variation, variationId } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('kontrak API resep publik', () => {
  it('membaca envelope, penulis null, dan cookie same-origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([original, variation]));
    vi.stubGlobal('fetch', fetchMock);
    const recipes = await getRecipes();
    expect(recipes).toHaveLength(2);
    expect(recipes[1].author).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/recipes', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('mempertahankan Decimal string dan metadata serta mengurutkan posisi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(recipeDetail)));
    const recipe = await getRecipe(variationId);
    expect(recipe.ingredients.map((item) => item.name)).toEqual(['Tepung', 'Madu']);
    expect(recipe.ingredients[1].quantity).toBe('25.125');
    expect(recipe.ingredients[1].changeReason).toBe('Mengganti gula');
    expect(recipe.ingredients[1].observedEffect).toBe('Aroma lebih kuat');
    expect(recipe.steps[0].instruction).toBe('Campurkan semua bahan.');
  });

  it('menolak UUID tidak valid tanpa request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getRecipe('../auth/me')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 404, 500])('memetakan HTTP %i menjadi error terkontrol', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('internal private detail', { status })));
    await expect(getRecipe(variationId)).rejects.toMatchObject({ status });
    await expect(getRecipe(variationId)).rejects.not.toThrow('internal private detail');
  });

  it('memberi pesan yang bisa ditindaklanjuti ketika backend mati', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getRecipes()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Try again') });
  });

  it.each([
    { data: {} },
    { data: [{ ...original, status: 'DRAFT' }] },
    { data: [{ ...original, author: { email: 'do-not-display@example.test' } }] },
  ])('menolak respons sukses dengan bentuk yang salah', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(getRecipes()).rejects.toBeInstanceOf(ApiError);
  });

  it('menolak HTML fallback yang salah dianggap respons API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SPA</html>')));
    await expect(getRecipes()).rejects.toMatchObject({ status: 502 });
  });

  it('menolak quantity numerik agar ketepatan Decimal tidak berubah', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...recipeDetail, ingredients: [{ ...recipeDetail.ingredients[0], quantity: 25.125 }] })));
    await expect(getRecipe(variationId)).rejects.toMatchObject({ status: 502 });
  });

  it('meneruskan abort tanpa mengubahnya menjadi error jaringan', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    await expect(getRecipes(controller.signal)).rejects.toBe(abortError);
  });
});
