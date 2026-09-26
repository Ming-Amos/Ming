import type { Application, Request, Response, NextFunction } from "express";
import { configureProviderStorage, getProviderStatus, saveProviderConfig, clearProviderConfig, testProviderConnection, ProviderConfigError } from "./provider";

/** Mount after the application's trusted-origin and public-read-only guards. */
export function mountProviderRoutes(app: Application, runtimeDir: string): void {
  configureProviderStorage(runtimeDir);
  app.use("/api/provider", (_req: Request, res: Response, next: NextFunction) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get("/api/provider/status", (_req, res) => {
    if (process.env.MING_PUBLIC_DEMO === "1") {
      res.json({ status: { configured: false, providerLabel: "Model connections are disabled in this demo", baseUrl: "", modelId: "", missingFields: [], hasKey: false, keyStored: false, configSource: "none", environmentOverride: false, readOnly: true } }); return;
    }
    res.json({ status: getProviderStatus() });
  });
  const localOnly = (_req: Request, res: Response, next: NextFunction) => {
    if (process.env.MING_PUBLIC_DEMO === "1") { res.status(403).json({ ok: false, error: "Model configuration and requests are disabled in this demo. Open Ming locally." }); return; }
    next();
  };
  const report = (res: Response, error: unknown) => res.status(error instanceof ProviderConfigError ? error.statusCode : 500).json({ ok: false, error: error instanceof ProviderConfigError ? error.message : "The model configuration operation failed. Check the local service." });
  app.put("/api/provider/config", localOnly, (req, res) => {
    try { res.json({ ok: true, status: saveProviderConfig(req.body) }); } catch (error) { report(res, error); }
  });
  app.delete("/api/provider/config", localOnly, (_req, res) => {
    try { res.json({ ok: true, status: clearProviderConfig() }); } catch (error) { report(res, error); }
  });
  app.post("/api/provider/test", localOnly, async (_req, res) => {
    try { const result = await testProviderConnection(); res.json({ ...result, status: getProviderStatus() }); } catch (error) { report(res, error); }
  });
}
