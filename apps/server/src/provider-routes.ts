import type { Application, Request, Response, NextFunction } from "express";
import { configureProviderStorage, getProviderStatus, saveProviderConfig, clearProviderConfig, testProviderConnection, ProviderConfigError } from "./provider";

/** Mount after the application's trusted-origin and public-read-only guards. */
export function mountProviderRoutes(app: Application, runtimeDir: string): void {
  configureProviderStorage(runtimeDir);
  app.use("/api/provider", (_req: Request, res: Response, next: NextFunction) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get("/api/provider/status", (_req, res) => {
    if (process.env.MING_PUBLIC_DEMO === "1") {
      res.json({ status: { configured: false, providerLabel: "公开演示不连接模型", baseUrl: "", modelId: "", missingFields: [], hasKey: false, keyStored: false, configSource: "none", environmentOverride: false, readOnly: true } }); return;
    }
    res.json({ status: getProviderStatus() });
  });
  const localOnly = (_req: Request, res: Response, next: NextFunction) => {
    if (process.env.MING_PUBLIC_DEMO === "1") { res.status(403).json({ ok: false, error: "公开演示不支持模型配置或调用。请在本地打开 Ming。" }); return; }
    next();
  };
  const report = (res: Response, error: unknown) => res.status(error instanceof ProviderConfigError ? error.statusCode : 500).json({ ok: false, error: error instanceof ProviderConfigError ? error.message : "模型配置操作失败。请检查本地服务状态。" });
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
