/** Read-only Sites adapter. Every acceptance result is a recorded wire response. */
export function createWorker(bundle) {
  if (bundle?.schemaVersion !== 1 || !bundle.responses || !Array.isArray(bundle.screenshots)) {
    throw new Error('Invalid reviewed public-demo bundle');
  }
  const responses = bundle.responses;
  const screenshots = new Set(bundle.screenshots);
  const own = (key) => Object.prototype.hasOwnProperty.call(responses, key);

  function json(body, status, head = false) {
    return new Response(head ? null : JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-ming-demo-mode': 'recorded-evidence',
      },
    });
  }

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const head = request.method === 'HEAD';
      if (!['GET', 'HEAD'].includes(request.method)) {
        return json({ ok: false, error: 'This public demo displays recorded evidence only. Run Ming locally to execute checks, generate plans, or repair an application.' }, 403);
      }

      if (url.pathname === '/api/capabilities') {
        return json({ ok: true, readOnly: true, sourceBinding: 'self-contained-html-snapshot', demoMode: 'recorded-evidence' }, 200, head);
      }
      if (url.pathname === '/api/provider/status') {
        return json({ ok: true, status: { configured: false, providerLabel: 'Recorded evidence demo — model calls disabled', baseUrl: '(disabled)', modelId: '(disabled)', missingFields: ['LOCAL_MODEL_CONFIGURATION_REQUIRED'] } }, 200, head);
      }
      if (url.pathname === '/api/projects') {
        return json({ ok: true, projects: [], readOnly: true }, 200, head);
      }
      if (url.pathname.startsWith('/api/screenshots/')) {
        let filename;
        try { filename = decodeURIComponent(url.pathname.slice('/api/screenshots/'.length)); }
        catch { return json({ ok: false, error: 'Invalid screenshot path' }, 400, head); }
        if (url.search || !screenshots.has(filename) || /[\\/]/.test(filename)) {
          return json({ ok: false, error: 'Screenshot is not included in this reviewed demo' }, 404, head);
        }
        const imageUrl = new URL(request.url);
        imageUrl.pathname = '/demo-evidence/screenshots/' + encodeURIComponent(filename);
        imageUrl.search = '';
        return env.ASSETS.fetch(new Request(imageUrl, { method: request.method }));
      }
      if (url.pathname.startsWith('/api/')) {
        url.searchParams.sort();
        const key = url.pathname + url.search;
        if (!own(key)) return json({ ok: false, error: 'This record is not included in the public demo' }, 404, head);
        return json(responses[key], 200, head);
      }
      if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/.')) {
        return json({ ok: false, error: 'Not available in the public demo' }, 404, head);
      }

      const response = await env.ASSETS.fetch(request);
      const acceptsHtml = request.headers.get('accept')?.includes('text/html');
      if (response.status !== 404 || !acceptsHtml) return response;
      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/index.html';
      indexUrl.search = '';
      return env.ASSETS.fetch(new Request(indexUrl, { method: request.method, headers: request.headers }));
    },
  };
}
