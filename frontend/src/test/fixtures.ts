// Data ini hanya dipakai tes; tidak dimasukkan ke database atau katalog aplikasi.
export const originalId = '11111111-1111-4111-8111-111111111111';
export const variationId = '22222222-2222-4222-8222-222222222222';

export const original = {
  id: originalId,
  title: 'Roti Susu',
  status: 'PUBLISHED',
  createdAt: '2026-10-31T08:00:00.000Z',
  parentRecipeId: null,
  author: { id: 'author-1', displayName: 'Maya' },
  experimentGoal: null,
  experimentResult: null,
  experimentStatus: 'NOT_TESTED',
};

export const variation = {
  ...original,
  id: variationId,
  title: 'Roti Madu',
  parentRecipeId: originalId,
  author: null,
  experimentGoal: 'Mengurangi gula pasir',
  experimentResult: 'Tekstur lebih lembut',
  experimentStatus: 'SUCCESS',
};

export const recipeDetail = {
  ...variation,
  ingredients: [
    { id: 'i-2', position: 2, name: 'Madu', quantity: '25.125', unit: 'g', note: 'Madu cair', changeReason: 'Mengganti gula', observedEffect: 'Aroma lebih kuat' },
    { id: 'i-1', position: 1, name: 'Tepung', quantity: '250', unit: 'g', note: null, changeReason: null, observedEffect: null },
  ],
  steps: [
    { id: 's-2', position: 2, instruction: 'Panggang hingga matang.' },
    { id: 's-1', position: 1, instruction: 'Campurkan semua bahan.' },
  ],
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
}
