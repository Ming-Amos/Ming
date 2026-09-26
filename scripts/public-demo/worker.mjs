/** Recorded-evidence API plus a bundled, independently executed browser trial. */
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
        return json({ ok: false, error: 'Hosted API records are read-only. Upload a static project for browser checks, try the live sample, or run Ming locally for server-backed applications.' }, 403);
      }

      if (url.pathname === '/api/capabilities') {
        return json({ ok: true, readOnly: true, sourceBinding: 'self-contained-html-snapshot', demoMode: 'recorded-evidence', uploadedProjects: { available: true, path: '/#upload', formats: ['html', 'static-zip'], execution: 'isolated-visitor-browser', planning: 'manually-confirmed', captureKind: 'dom-render', modelCalls: false }, liveTrial: { available: true, path: '/#trial', execution: 'visitor-browser', scope: 'bundled-shipboard', captureKind: 'dom-render', modelCalls: false } }, 200, head);
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
      // A missing trial document must fail, never become a nested application shell.
      if (url.pathname.startsWith('/trial/')) return response;
      const acceptsHtml = request.headers.get('accept')?.includes('text/html');
      if (response.status !== 404 || !acceptsHtml) return response;
      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/index.html';
      indexUrl.search = '';
      return env.ASSETS.fetch(new Request(indexUrl, { method: request.method, headers: request.headers }));
    },
  };
}
