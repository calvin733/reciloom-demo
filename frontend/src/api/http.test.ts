import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, resetCsrf } from './http';
import { login, logout } from './auth';
import { jsonResponse } from '../test/fixtures';

const token = (value = 'a') => new Response(JSON.stringify({ csrfToken: value.repeat(64) }));
const account = { id: 'owner', displayName: 'Maya', email: 'maya@example.test' };
beforeEach(resetCsrf);
afterEach(() => vi.unstubAllGlobals());
describe('HTTP session dan siklus CSRF', () => {
  it('GET tidak mengambil CSRF; mutasi menggunakan cookie dan token tanpa query string', async () => {
    const mock = vi.fn().mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(token()).mockResolvedValueOnce(jsonResponse({ id: 'draft' }));
    vi.stubGlobal('fetch', mock);
    await apiRequest('/api/recipes');
    await apiRequest('/api/recipes', { method: 'POST', body: { title: 'Roti' } });
    expect(mock.mock.calls.map(call => call[0])).toEqual(['/api/recipes', '/api/auth/csrf', '/api/recipes']);
    expect(mock.mock.calls[2][1]).toMatchObject({ credentials: 'same-origin', headers: { 'X-CSRF-Token': 'a'.repeat(64), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Roti' }) });
  });
  it('login dan logout menghapus token lama setelah session berubah', async () => {
    const mock = vi.fn().mockResolvedValueOnce(token('a')).mockResolvedValueOnce(jsonResponse(account)).mockResolvedValueOnce(token('b')).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Logged out.' }))).mockResolvedValueOnce(token('c')).mockResolvedValueOnce(jsonResponse(account));
    vi.stubGlobal('fetch', mock);
    await login(account.email, 'test-password-only');
    await logout();
    await login(account.email, 'test-password-only');
    expect(mock.mock.calls.filter(call => call[0] === '/api/auth/csrf')).toHaveLength(3);
    expect(mock.mock.calls[3][1].headers['X-CSRF-Token']).toBe('b'.repeat(64));
  });
  it('memperbarui token CSRF stale satu kali setelah 403 dari middleware', async () => {
    const mock = vi.fn().mockResolvedValueOnce(token('a')).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid or missing CSRF token.' }), { status: 403 })).mockResolvedValueOnce(token('b')).mockResolvedValueOnce(jsonResponse({ id: 'fork' }));
    vi.stubGlobal('fetch', mock);
    await apiRequest('/api/recipes/test/fork', { method: 'POST' });
    expect(mock).toHaveBeenCalledTimes(4);
    expect(mock.mock.calls[3][1].headers['X-CSRF-Token']).toBe('b'.repeat(64));
  });
  it('tidak mengulang mutasi pada kegagalan jaringan yang hasilnya tidak diketahui', async () => {
    const mock = vi.fn().mockResolvedValueOnce(token()).mockRejectedValueOnce(new TypeError('connection lost'));
    vi.stubGlobal('fetch', mock);
    await expect(apiRequest('/api/recipes', { method: 'POST', body: { title: 'Roti' } })).rejects.toMatchObject({ status: 0 });
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('meneruskan field error backend dan menyembunyikan detail internal 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid recipe data.', errors: [{ field: 'ingredients.0.quantity', message: 'Invalid quantity.' }] }), { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'PRIVATE DATABASE DETAIL' }), { status: 500 })));
    await expect(apiRequest('/api/me/recipes/test', { method: 'PUT', body: {} })).rejects.toMatchObject({ status: 400, issues: [{ field: 'ingredients.0.quantity', message: 'Invalid quantity.' }] });
    await expect(apiRequest('/api/recipes')).rejects.not.toThrow('PRIVATE DATABASE DETAIL');
  });
  it('menolak token malformed sebelum request perubahan data', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ csrfToken: 'invalid' })));
    vi.stubGlobal('fetch', mock);
    await expect(apiRequest('/api/recipes', { method: 'POST' })).rejects.toMatchObject({ status: 502 });
    expect(mock).toHaveBeenCalledOnce();
  });
});
