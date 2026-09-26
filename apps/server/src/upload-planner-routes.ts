import path from 'path';
import type { Application, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { getUploadPlannerEnvironment } from './provider';

/** The shared planner is also deployed as a Worker module; it never runs in the browser. */
export function mountUploadPlannerRoutes(app: Application): void {
  const { handleUploadPlanner } = require(path.resolve(__dirname, '../../../scripts/public-demo/upload-planner.mjs')) as {
    handleUploadPlanner(request: Request, env: Record<string, unknown>): Promise<Response | null>;
  };
  async function handle(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const headers = new Headers();
      for (const name of ['origin', 'content-type', 'sec-fetch-site']) {
        const value = req.get(name); if (value) headers.set(name, value);
      }
      const request = new Request(`http://${req.get('host')}${req.originalUrl}`, {
        method: req.method, headers, signal: controller.signal,
        ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
      });
      const response = await handleUploadPlanner(request, process.env.MING_PUBLIC_DEMO === '1' ? {} : getUploadPlannerEnvironment());
      if (!response) { res.status(404).json({ ok: false, error: 'Planner route not found.' }); return; }
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.status(response.status).send(await response.text());
    } catch {
      if (!res.headersSent && !res.destroyed) res.status(503).json({ ok: false, error: 'The draft planner could not finish. Retry when ready.' });
    } finally { res.removeListener('close', cancel); }
  }
  app.get('/api/upload/planner/status', (req, res) => { void handle(req, res); });
  app.post('/api/upload/planner/draft', (req, res) => { void handle(req, res); });
}
