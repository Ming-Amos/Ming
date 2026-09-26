/**
 * Page context inspector.
 * Launches a headless browser, navigates to the target URL,
 * and returns bounded page structure (title, interactive elements, visible text).
 *
 * This data is used to ground the model prompt. It is treated as untrusted
 * input — page content helps locate controls but cannot redefine expected behavior.
 */

import { chromium } from "playwright";
import type { PageContext } from "@ming/contracts";

const INSPECT_TIMEOUT_MS = 15_000;
const MAX_ELEMENTS = 40;
const MAX_TEXT_CHARS = 1500;

export async function inspectPage(opts: {
  projectId: string;
  targetVariant: string;
  targetUrl: string;
}): Promise<PageContext> {
  const capturedAt = new Date().toISOString();
  const base: Omit<PageContext, "title" | "elements" | "visibleTextSummary" | "error"> = {
    projectId: opts.projectId,
    targetVariant: opts.targetVariant,
    targetUrl: opts.targetUrl,
    capturedAt,
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(opts.targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: INSPECT_TIMEOUT_MS,
    });

    const title = await page.title();

    // Gather interactive elements: inputs, buttons, selects with accessible labels
    const elements = await page.evaluate((maxEls: number) => {
      const results: Array<{ label: string; role: string; selector?: string }> = [];
      const seen = new Set<Element>();

      function addEl(el: Element, role: string, label: string, selector?: string) {
        if (seen.has(el)) return;
        seen.add(el);
        if (results.length < maxEls) {
          results.push({ label: label.trim().slice(0, 100), role, selector });
        }
      }

      // Labeled inputs
      document.querySelectorAll("input, textarea, select").forEach((el) => {
        const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const id = input.id;
        const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
        const labelText =
          labelEl?.textContent?.trim() ||
          input.getAttribute("aria-label") ||
          input.getAttribute("placeholder") ||
          input.getAttribute("name") ||
          "";
        const tag = input.tagName.toLowerCase();
        const role = tag === "select" ? "combobox" : tag === "textarea" ? "textbox" : (input.type || "textbox");
        const selector = id ? `#${id}` : undefined;
        addEl(el, role, labelText || `(unlabeled ${tag})`, selector);
      });

      // Buttons
      document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']").forEach((el) => {
        const btn = el as HTMLElement;
        const label =
          btn.getAttribute("aria-label") ||
          btn.textContent?.trim() ||
          btn.getAttribute("value") ||
          "";
        const id = btn.id;
        addEl(el, "button", label || "(unlabeled button)", id ? `#${id}` : undefined);
      });

      return results;
    }, MAX_ELEMENTS);

    // Visible text summary (bounded)
    const visibleText = await page.evaluate(() => {
      return document.body.innerText?.slice(0, 3000) ?? "";
    });
    const visibleTextSummary = visibleText.slice(0, MAX_TEXT_CHARS);

    await context.close();

    return {
      ...base,
      title,
      elements,
      visibleTextSummary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      title: "",
      elements: [],
      visibleTextSummary: "",
      error: `页面检查失败：${message}`,
    };
  } finally {
    if (browser) await browser.close();
  }
}
