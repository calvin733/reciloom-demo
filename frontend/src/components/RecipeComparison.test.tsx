import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RecipeComparison from './RecipeComparison';
import { getComparison } from '../api/recipes';
import { jsonResponse, originalId, variationId } from '../test/fixtures';

const flour = { position: 1, name: 'Tepung', quantity: '250', unit: 'g', note: null, changeReason: null, observedEffect: null };
const comparison = {
  original: { id: originalId, title: 'Roti asal' }, fork: { id: variationId, title: 'Roti variasi' },
  ingredients: [
    { type: 'MODIFIED', before: flour, after: { ...flour, quantity: '200', changeReason: 'Mengurangi tepung' } },
    { type: 'ADDED', before: null, after: { ...flour, name: 'Madu', quantity: '25.125' } },
    { type: 'REMOVED', before: { ...flour, name: 'Gula' }, after: null },
    { type: 'UNCHANGED', before: { ...flour, name: 'Garam' }, after: { ...flour, name: 'Garam' } },
  ],
  steps: [{ type: 'MODIFIED', before: { position: 1, instruction: 'Campur.' }, after: { position: 1, instruction: 'Aduk perlahan.' } }],
};
afterEach(() => vi.unstubAllGlobals());
describe('Compare dalam detail resep', () => {
  it('menampilkan empat status, nilai sebelum/sesudah, metadata, dan batas algoritma', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(comparison)));
    render(<MemoryRouter><RecipeComparison recipeId={variationId} /></MemoryRouter>);
    await screen.findByText('Added 1');
    expect(screen.getByText('Removed 1')).toBeInTheDocument();
    expect(screen.getByText('Changed 2')).toBeInTheDocument();
    expect(screen.getByText('Unchanged 1')).toBeInTheDocument();
    expect(screen.getAllByText('250 g')).toHaveLength(4);
    expect(screen.getByText('200 g')).toBeInTheDocument();
    expect(screen.getByText('25.125 g')).toBeInTheDocument();
    expect(screen.getByText('Reason for change')).toBeInTheDocument();
    expect(screen.getByText('Mengurangi tepung')).toBeInTheDocument();
    await user.click(screen.getByText('How the comparison works'));
    expect(screen.getByText(/Grams and cups are compared as separate units/)).toBeVisible();
    expect(screen.getByText(/Steps are compared by position/)).toBeVisible();
  });
  it('menolak bentuk respons compare yang dapat merusak render', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...comparison, ingredients: [{ type: 'MODIFIED', before: flour, after: { ...flour, name: {} } }] })));
    await expect(getComparison(variationId)).rejects.toMatchObject({ status: 502 });
  });
  it('mengizinkan retry setelah kegagalan jaringan', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(jsonResponse(comparison)));
    render(<MemoryRouter><RecipeComparison recipeId={variationId} /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByText('Added 1');
  });
});
