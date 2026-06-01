import { describe, it, expect, vi, afterEach } from 'vitest';
import { http } from '../../client/src/api/http.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('http', () => {
  it('returns parsed JSON on success', async () => {
    // Описание: успешный ответ парсится в объект.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });

    vi.stubGlobal('fetch', fetchMock);

    const data = await http('/health');

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws API message on failure', async () => {
    // Описание: ошибочный ответ выбрасывает message.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue(JSON.stringify({ message: 'Bad request' })),
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(http('/fail')).rejects.toThrow('Bad request');
  });
});
