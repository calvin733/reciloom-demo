import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { resetCsrf } from './api/http';
import { safeReturnTo } from './auth/AuthContext';
import { jsonResponse, original, originalId, recipeDetail, variationId } from './test/fixtures';

const account = { id: 'owner', displayName: 'Dapur Maya', email: 'maya@example.test' };
const published = { ...recipeDetail, ...original, authorId: 'someone-else' };
const draft = { ...recipeDetail, title: 'Roti Madu', status: 'DRAFT', authorId: account.id, author: { id: account.id, displayName: account.displayName } };
const raw = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
type Handler = (path: string, init: RequestInit) => Response | Promise<Response>;
function mockApi(handler: Handler, authenticated = true) {
  const mock = vi.fn(async (path: string, init: RequestInit = {}) => {
    if (path === '/api/auth/me') return authenticated ? jsonResponse(account) : raw({ message: 'Authentication required.' }, 401);
    if (path === '/api/auth/csrf') return raw({ csrfToken: 'a'.repeat(64) });
    return handler(path, init);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
function open(path: string) { render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }
beforeEach(resetCsrf);
afterEach(() => vi.unstubAllGlobals());

describe('akun dan navigasi yang memerlukan sesi', () => {
  it('register, login, dan logout memakai API dan token session baru', async () => {
    const user = userEvent.setup();
    const mock = mockApi(path => {
      if (path === '/api/auth/register') return jsonResponse(account, 201);
      if (path === '/api/auth/login') return jsonResponse(account);
      if (path === '/api/me/recipes') return jsonResponse([]);
      if (path === '/api/auth/logout') return raw({ message: 'Logged out successfully.' });
      throw new Error(`Unexpected ${path}`);
    }, false);
    open('/register');
    await user.type(await screen.findByLabelText('Display name'), 'Dapur Maya');
    await user.type(screen.getByLabelText('Email'), account.email);
    await user.type(screen.getByLabelText('Password'), 'test-password-123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'My recipes' });
    const registration = mock.mock.calls.find(call => call[0] === '/api/auth/register');
    expect(JSON.parse(registration![1]!.body as string)).toEqual({ displayName: 'Dapur Maya', email: account.email, password: 'test-password-123' });
    expect(registration![1]!.headers).toMatchObject({ 'X-CSRF-Token': 'a'.repeat(64) });
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Log in to ReciLoom' });
    expect(mock.mock.calls.filter(call => call[0] === '/api/auth/csrf')).toHaveLength(2);
    expect(localStorage.length).toBe(0);
  });
  it('memulihkan session dan memisahkan Draft/Published di My Recipes', async () => {
    const user = userEvent.setup();
    const mock = mockApi(path => path === '/api/me/recipes' ? jsonResponse([draft, { ...published, title: 'Resep yang dibagikan' }]) : raw({}, 404));
    open('/my-recipes');
    const title = await screen.findByRole('heading', { name: 'Roti Madu' });
    expect(within(title).getByRole('link')).toHaveAttribute('href', `/recipes/${variationId}/edit`);
    expect(screen.queryByRole('heading', { name: 'Resep yang dibagikan' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Published/ }));
    expect(screen.getByRole('link', { name: /View recipe/ })).toHaveAttribute('href', `/recipes/${originalId}`);
    expect(mock.mock.calls.some(call => call[0] === '/api/auth/login')).toBe(false);
  });
  it('melindungi editor dan menampilkan kesalahan login tanpa membuka editor', async () => {
    const user = userEvent.setup();
    mockApi(path => path === '/api/auth/login' ? raw({ message: 'Invalid email or password.' }, 401) : raw({}, 404), false);
    open('/recipes/new');
    await user.type(await screen.findByLabelText('Email'), account.email);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.queryByLabelText('Recipe title')).not.toBeInTheDocument();
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/login?returnTo=/login'])('menolak tujuan login eksternal atau berulang: %s', destination => {
    expect(safeReturnTo(destination)).toBe('/my-recipes');
    expect(safeReturnTo('/recipes/new')).toBe('/recipes/new');
  });
});

describe('Fork dari halaman resep', () => {
  it('mempertahankan niat setelah login dan baru membuat fork saat Continue ditekan', async () => {
    const user = userEvent.setup();
    const mock = mockApi((path, init) => {
      if (path === `/api/recipes/${originalId}`) return jsonResponse(published);
      if (path === '/api/auth/login') return jsonResponse(account);
      if (path === `/api/recipes/${originalId}/fork` && init.method === 'POST') return jsonResponse({ id: variationId }, 201);
      if (path === `/api/me/recipes/${variationId}`) return jsonResponse(draft);
      throw new Error(`Unexpected ${path}`);
    }, false);
    open(`/recipes/${originalId}`);
    await user.click(await screen.findByRole('button', { name: 'Fork recipe' }));
    await user.type(await screen.findByLabelText('Email'), account.email);
    await user.type(screen.getByLabelText('Password'), 'test-password-123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    const continueButton = await screen.findByRole('button', { name: 'Continue to fork' });
    expect(mock.mock.calls.filter(call => call[0].endsWith('/fork'))).toHaveLength(0);
    await user.click(continueButton);
    expect(await screen.findByLabelText('Recipe title')).toHaveValue('Roti Madu');
    expect(mock.mock.calls.filter(call => call[0].endsWith('/fork'))).toHaveLength(1);
  });
  it('pengingat Continue dapat ditutup tanpa mutasi', async () => {
    const user = userEvent.setup();
    const mock = mockApi(path => path === `/api/recipes/${originalId}` ? jsonResponse(published) : raw({}, 404));
    open(`/recipes/${originalId}?continueFork=1`);
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'Continue to fork' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fork recipe' })).toBeInTheDocument();
    expect(mock.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(0);
  });
});

describe('editor terhubung dengan API', () => {
  it('menyimpan draft di editor, lalu menyimpan ulang dan publish setelah isian lengkap', async () => {
    const user = userEvent.setup();
    let content: { title: string; ingredients: { name: string; quantity: string; unit: string }[]; steps: { instruction: string }[] } = { title: '', ingredients: [], steps: [] };
    const detail = () => ({ ...published, ...content, status: 'DRAFT', authorId: account.id, parentRecipeId: null, ingredients: content.ingredients.map((row, i) => ({ ...row, id: `i-${i}`, position: i + 1, note: null, changeReason: null, observedEffect: null })), steps: content.steps.map((row, i) => ({ ...row, id: `s-${i}`, position: i + 1 })) });
    const mock = mockApi((path, init) => {
      if (path === '/api/recipes' && init.method === 'POST') return jsonResponse({ id: originalId }, 201);
      if (path === `/api/me/recipes/${originalId}` && init.method === 'PUT') { content = JSON.parse(init.body as string); return jsonResponse(detail()); }
      if (path === `/api/me/recipes/${originalId}`) return jsonResponse(detail());
      if (path.endsWith('/publish-readiness')) return jsonResponse({ readyToPublish: content.ingredients.length > 0 && content.steps.length > 0, issues: [] });
      if (path.endsWith('/publish')) return jsonResponse(detail());
      if (path === `/api/recipes/${originalId}`) return jsonResponse({ ...detail(), status: 'PUBLISHED' });
      throw new Error(`Unexpected ${path}`);
    });
    open('/recipes/new');
    await user.type(await screen.findByLabelText('Recipe title'), 'Roti buatan rumah');
    expect(screen.getByRole('button', { name: 'Publish recipe' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mock.mock.calls.some(call => call[0] === `/api/me/recipes/${originalId}` && call[1]?.method === 'GET')).toBe(true));
    expect(await screen.findByLabelText('Recipe title')).toHaveValue('Roti buatan rumah');
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved');
    await user.type(screen.getByLabelText('Ingredient name 1'), 'Tepung');
    await user.type(screen.getByLabelText('Amount 1'), '250');
    await user.type(screen.getByLabelText('Unit 1'), 'g');
    await user.type(screen.getByLabelText('Instructions for step 1'), 'Campurkan dan panggang sampai matang.');
    await user.click(screen.getByRole('button', { name: 'Publish recipe' }));
    await screen.findByRole('heading', { level: 1, name: 'Roti buatan rumah' });
    expect(mock.mock.calls.filter(call => call[0] === '/api/recipes' && call[1]?.method === 'POST')).toHaveLength(1);
    expect(mock.mock.calls.filter(call => call[1]?.method === 'PUT')).toHaveLength(2);
    expect(mock.mock.calls.some(call => call[0].endsWith('/publish'))).toBe(true);
  });
  it('mempertahankan metadata saat reorder dan menyimpan catatan eksperimen fork', async () => {
    const user = userEvent.setup();
    const mock = mockApi((path, init) => {
      if (path === `/api/me/recipes/${variationId}`) return jsonResponse(draft);
      if (path.endsWith('/experiment') && init.method === 'PATCH') return jsonResponse({});
      if (path.endsWith('/publish-readiness')) return jsonResponse({ readyToPublish: true, issues: [] });
      throw new Error(`Unexpected ${path}`);
    });
    open(`/recipes/${variationId}/edit`);
    await screen.findByLabelText('Recipe title');
    await user.click(screen.getByRole('button', { name: 'Move ingredient 1 down' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    const put = mock.mock.calls.find(call => call[1]?.method === 'PUT');
    const body = JSON.parse(put![1]!.body as string);
    expect(body.ingredients[0]).toMatchObject({ name: 'Madu', quantity: '25.125', changeReason: 'Mengganti gula', observedEffect: 'Aroma lebih kuat' });
    const patch = mock.mock.calls.find(call => call[1]?.method === 'PATCH');
    expect(JSON.parse(patch![1]!.body as string)).toMatchObject({ experimentGoal: 'Mengurangi gula pasir', experimentStatus: 'SUCCESS' });
  });
  it('menghormati readiness server dan tidak publish saat server menolak', async () => {
    const user = userEvent.setup();
    const mock = mockApi(path => path.endsWith('/publish-readiness') ? jsonResponse({ readyToPublish: false, issues: [{ field: 'ingredients', message: 'Check the ingredients.' }] }) : jsonResponse(draft));
    open(`/recipes/${variationId}/edit`);
    await user.click(await screen.findByRole('button', { name: 'Publish recipe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the ingredients.');
    expect(mock.mock.calls.some(call => call[0].endsWith('/publish'))).toBe(false);
  });
  it('draft yang sudah published dibuka sebagai informasi baca saja', async () => {
    mockApi(() => jsonResponse({ ...draft, status: 'PUBLISHED' }));
    open(`/recipes/${variationId}/edit`);
    await screen.findByRole('heading', { name: 'Recipe already published' });
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });
  it('membuka login dari editor saat session server habis meskipun user lama masih ada di context', async () => {
    const user = userEvent.setup();
    const mock = mockApi((path, init) => {
      if (path === `/api/me/recipes/${variationId}` && init.method === 'PUT') return raw({ message: 'Authentication required.' }, 401);
      if (path === `/api/me/recipes/${variationId}`) return jsonResponse(draft);
      if (path === '/api/auth/login') return jsonResponse(account);
      throw new Error(`Unexpected ${path}`);
    });
    open(`/recipes/${variationId}/edit`);
    await screen.findByLabelText('Recipe title');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Copy any unsaved changes before logging in again.');
    await user.click(screen.getByRole('link', { name: 'Log in again' }));
    await user.type(await screen.findByLabelText('Email'), account.email);
    await user.type(screen.getByLabelText('Password'), 'test-password-123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByLabelText('Recipe title')).toHaveValue('Roti Madu');
    expect(mock.mock.calls.filter(call => call[0] === '/api/auth/login')).toHaveLength(1);
  });
});
