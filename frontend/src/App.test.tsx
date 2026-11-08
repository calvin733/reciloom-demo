import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import App from './App';
import { jsonResponse, original, originalId, recipeDetail, variation, variationId } from './test/fixtures';

afterEach(() => vi.unstubAllGlobals());

// Pertahankan pemeriksaan request katalog. Restorasi sesi pada kelompok tes
// pengunjung selalu 401 dan diperiksa tersendiri pada tes alur akun.
function publicFetch(mock: (path: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => path === '/api/auth/me'
    ? Promise.resolve(new Response(JSON.stringify({ message: 'Authentication required.' }), { status: 401 }))
    : mock(path, init));
}

function openApp(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('alur pengunjung ReciLoom', () => {
  it('menampilkan loading lalu empty state tanpa resep contoh', async () => {
    publicFetch(vi.fn().mockResolvedValue(jsonResponse([])));
    openApp();
    expect(screen.getByRole('status')).toHaveTextContent('Loading recipes');
    expect(await screen.findByRole('heading', { name: 'No published recipes yet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Roti/ })).not.toBeInTheDocument();
  });

  it('mencari judul/pembuat, memfilter variasi, dan menghapus pencarian', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([original, variation]));
    publicFetch(fetchMock);
    openApp();
    await screen.findByRole('heading', { name: 'Roti Susu' });
    await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'maya');
    expect(screen.getByRole('heading', { name: 'Roti Susu' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Roti Madu' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Variations' }));
    expect(screen.getByRole('heading', { name: 'No matching recipes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'All recipes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Roti Madu' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('membuka detail, catatan bahan, dan tujuan/hasil eksperimen', async () => {
    const user = userEvent.setup();
    publicFetch(vi.fn().mockResolvedValueOnce(jsonResponse([variation])).mockResolvedValueOnce(jsonResponse(recipeDetail)));
    openApp();
    await user.click(await screen.findByRole('link', { name: /Roti Madu/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Roti Madu' })).toBeInTheDocument();
    expect(screen.getByText('25.125 g')).toBeInTheDocument();
    expect(screen.getByText('Mengganti gula')).toBeInTheDocument();
    expect(screen.getByText('Aroma lebih kuat')).toBeInTheDocument();
    expect(screen.getByText('Mengurangi gula pasir')).toBeInTheDocument();
    expect(screen.getByText('Tekstur lebih lembut')).toBeInTheDocument();
    expect(screen.getByText('Unknown author')).toBeInTheDocument();
    const steps = screen.getByRole('region', { name: 'Directions' });
    expect(within(steps).getAllByRole('listitem')[0]).toHaveTextContent('Campurkan semua bahan.');
  });

  it('menawarkan retry setelah gagal lalu berhasil', async () => {
    const user = userEvent.setup();
    publicFetch(vi.fn().mockResolvedValueOnce(new Response('', { status: 500 })).mockResolvedValueOnce(jsonResponse([original])));
    openApp();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Roti Susu' })).toBeInTheDocument();
  });

  it('menangani detail 404', async () => {
    publicFetch(vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    openApp(`/recipes/${variationId}`);
    expect(await screen.findByRole('heading', { name: 'Recipe not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse recipes' })).toHaveAttribute('href', '/');
  });

  it('menangani alamat detail invalid tanpa request ke backend', async () => {
    const fetchMock = vi.fn();
    publicFetch(fetchMock);
    openApp('/recipes/bukan-uuid');
    expect(await screen.findByText('This recipe link is invalid.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('membatalkan request detail lama saat pindah resep asal', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    publicFetch(vi.fn().mockImplementation((_path, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return Promise.resolve(jsonResponse(signals.length === 1 ? recipeDetail : { ...recipeDetail, ...original }));
    }));
    openApp(`/recipes/${variationId}`);
    await user.click(await screen.findByRole('link', { name: /View source recipe/ }));
    await screen.findByRole('heading', { level: 1, name: 'Roti Susu' });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('mengabaikan balasan resep A yang datang setelah resep B dibuka', async () => {
    const user = userEvent.setup();
    const finishRequests: ((response: Response) => void)[] = [];
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finishRequests.push(resolve); }));
    publicFetch(fetchMock);
    render(<MemoryRouter initialEntries={[`/recipes/${originalId}`]}><Link to={`/recipes/${variationId}`}>Pindah resep uji</Link><App /></MemoryRouter>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('link', { name: 'Pindah resep uji' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => finishRequests[1](jsonResponse(recipeDetail)));
    expect(screen.getByRole('heading', { level: 1, name: 'Roti Madu' })).toBeInTheDocument();
    await act(async () => finishRequests[0](jsonResponse({ ...recipeDetail, ...original })));
    expect(screen.getByRole('heading', { level: 1, name: 'Roti Madu' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Roti Susu' })).not.toBeInTheDocument();
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('menampilkan halaman untuk rute yang tidak dikenal', () => {
    publicFetch(vi.fn());
    openApp('/halaman-tidak-ada');
    expect(within(screen.getByRole('main')).getByRole('heading')).toHaveTextContent('Page not found');
  });
});
