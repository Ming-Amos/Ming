/* Runs inside an opaque-origin iframe. Never attach uploaded markup to the host DOM. */
(() => {
  const boot = document.currentScript.dataset.boot;
  const nativeTimeout = window.setTimeout.bind(window);
  const delay = ms => new Promise(resolve => nativeTimeout(resolve, ms));
  const diagnostics = [];
  const note = value => { if (diagnostics.length < 30) diagnostics.push(String(value).slice(0, 500)); };
  window.addEventListener('error', event => note(event.message || 'Page script error'));
  window.addEventListener('unhandledrejection', event => note(event.reason?.message || 'Unhandled page error'));
  document.addEventListener('securitypolicyviolation', event => note(`Blocked ${event.violatedDirective}: ${event.blockedURI}`));
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (anchor && !anchor.getAttribute('href')?.startsWith('#')) event.preventDefault();
  }, true);
  const bounded = value => String(value ?? '').slice(0, 1000);
  function visible(element) {
    const style = getComputedStyle(element);
    return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }
  function selectorFor(element) {
    if (element.id) return '#' + CSS.escape(element.id);
    const test = element.getAttribute('data-testid');
    if (test) return '[data-testid="' + CSS.escape(test) + '"]';
    const parts = [];
    for (let node = element; node && node !== document.body && parts.length < 8; node = node.parentElement) {
      const siblings = [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName);
      parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')' : ''));
    }
    return 'body' + (parts.length ? ' > ' + parts.join(' > ') : '');
  }
  function inventory() {
    return [...document.querySelectorAll('input,button,select,textarea,[role="button"],[id],[data-testid]')]
      .filter(visible).slice(0, 80).map(element => ({ selector: selectorFor(element), tag: element.tagName.toLowerCase(),
        label: bounded(element.getAttribute('aria-label')
          || (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent?.trim() || '').filter(Boolean).join(' ')
          || (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'OUTPUT', 'METER', 'PROGRESS'].includes(element.tagName) ? Array.from(element.labels || []) : []).map(label => (label.innerText || label.textContent || '').trim()).filter(Boolean).join(' ')
          || element.getAttribute('placeholder') || element.innerText || element.id).slice(0, 100),
        type: element.getAttribute('type') || '', text: bounded(element.innerText).slice(0, 160) }));
  }
  function storageAdapter(initial) {
    const data = Object.assign(Object.create(null), initial || {});
    const api = { getItem: key => Object.hasOwn(data, String(key)) ? data[String(key)] : null,
      setItem(key, value) { key = String(key); value = String(value); const next = { ...data, [key]: value };
        if (Object.keys(next).length > 100 || JSON.stringify(next).length > 131072) throw new DOMException('Isolated storage limit reached.', 'QuotaExceededError');
        data[key] = value;
      }, removeItem: key => { delete data[String(key)]; }, clear: () => { for (const key of Object.keys(data)) delete data[key]; },
      key: index => Object.keys(data)[Number(index)] ?? null, get length() { return Object.keys(data).length; } };
    return { data, proxy: new Proxy(api, { get(target, property) { return property in target || typeof property === 'symbol' ? Reflect.get(target, property) : target.getItem(property) ?? undefined; },
      set(target, property, value) { target.setItem(property, value); return true; }, deleteProperty(target, property) { target.removeItem(property); return true; },
      ownKeys: () => Object.keys(data), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }) };
  }
  async function execute(step) {
    const matches = [...document.querySelectorAll(step.selector)];
    if (step.action === 'assertCount') return { passed: matches.length === Number(step.value), observed: `${matches.length} matching elements`, expected: `${step.value} matching elements` };
    const element = matches[0];
    if (!element) return { passed: false, observed: `No element matches ${step.selector}`, expected: step.value || `An element matching ${step.selector}` };
    if (matches.length > 1) return { passed: false, observed: `${matches.length} elements match; use a unique selector.`, expected: 'One target element' };
    if (step.action === 'assertText') {
      const text = visible(element) ? String(element.innerText ?? '') : '';
      return { passed: visible(element) && text.includes(step.value), observed: bounded(text) || '(no visible text)', expected: `Visible text contains: ${step.value}` };
    }
    if (step.action === 'assertValue') {
      if (!element.matches('input,textarea,select')) throw new Error('Assert value requires an input, textarea, or select element.');
      return { passed: String(element.value) === step.value, observed: bounded(element.value), expected: step.value };
    }
    if (!visible(element) || element.disabled) return { passed: false, observed: 'Target is hidden or disabled', expected: 'An enabled visible target' };
    element.scrollIntoView({ block: 'nearest' });
    if (step.action === 'click') element.click();
    else if (step.action === 'fill') {
      if (!element.matches('input,textarea') || element.readOnly) throw new Error('Fill requires an editable input or textarea.');
      element.focus();
      const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, step.value);
      element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (step.action === 'select') {
      if (!(element instanceof HTMLSelectElement) || ![...element.options].some(option => option.value === step.value)) throw new Error('Select requires an existing option value.');
      element.value = step.value; element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (step.action === 'check' || step.action === 'uncheck') {
      if (!element.matches('input[type="checkbox"],input[type="radio"]')) throw new Error('Check requires a checkbox or radio input.');
      const desired = step.action === 'check'; if (element.checked !== desired) element.click();
      if (element.checked !== desired) return { passed: false, observed: `Checked: ${element.checked}`, expected: `Checked: ${desired}` };
    } else throw new Error('Unsupported action.');
    await delay(250);
    return { passed: true, observed: `Executed ${step.action} on ${step.selector}`, expected: step.description || step.action };
  }
  async function initialize(event) {
    if (event.source !== parent || event.data?.type !== 'ming-upload-init' || event.data.boot !== boot || !event.ports[0]) return;
    event.stopImmediatePropagation();
    window.removeEventListener('message', initialize, true);
    const port = event.ports[0];
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    const send = port.postMessage.bind(port);
    const local = storageAdapter(event.data.storage?.local), session = storageAdapter(event.data.storage?.session);
    Object.defineProperty(window, 'localStorage', { configurable: false, get: () => local.proxy });
    Object.defineProperty(window, 'sessionStorage', { configurable: false, get: () => session.proxy });
    async function capture() {
      try {
        const clone = document.body.cloneNode(true);
        const originals = [document.body, ...document.body.querySelectorAll('*')];
        const copies = [clone, ...clone.querySelectorAll('*')];
        if (copies.length > 3000) throw new Error('DOM snapshot supports up to 3000 elements.');
        for (let index = 0; index < originals.length; index++) {
          const original = originals[index], copy = copies[index];
          if (['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'STYLE', 'META'].includes(original.tagName)) { copy.remove(); continue; }
          for (const attribute of [...copy.attributes]) if (/^on/i.test(attribute.name)) copy.removeAttribute(attribute.name);
          const computed = getComputedStyle(original);
          let styles = '';
          for (const property of computed) styles += property + ':' + computed.getPropertyValue(property) + ';';
          copy.setAttribute('style', styles + ';animation:none!important;transition:none!important;');
          if (original instanceof HTMLInputElement) { copy.setAttribute('value', original.value); if (original.checked) copy.setAttribute('checked', ''); else copy.removeAttribute('checked'); }
          if (original instanceof HTMLTextAreaElement) copy.textContent = original.value;
          if (original instanceof HTMLSelectElement) [...copy.options].forEach((option, offset) => { option.selected = original.options[offset].selected; if (option.selected) option.setAttribute('selected', ''); else option.removeAttribute('selected'); });
          if (original instanceof HTMLCanvasElement) { const image = document.createElement('img'); image.src = original.toDataURL(); image.setAttribute('style', copy.getAttribute('style')); copy.replaceWith(image); }
        }
        const width = Math.min(innerWidth, 1280), height = Math.min(Math.max(document.documentElement.scrollHeight, innerHeight), 1200);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        const content = new XMLSerializer().serializeToString(clone);
        if (content.length > 12000000) throw new Error('DOM snapshot exceeds its size limit.');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${content}</foreignObject></svg>`;
        const image = new Image();
        await Promise.race([new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('DOM snapshot could not be rendered.')); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }), delay(3500).then(() => { throw new Error('DOM capture timed out.'); })]);
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0);
        return { capture: canvas.toDataURL('image/png') };
      } catch (error) { return { captureError: bounded(error.message || error) }; }
    }
    port.onmessage = async message => {
      const { id, command, step } = message.data || {};
      try {
        if (command === 'inventory') send({ id, result: { elements: inventory(), warnings: [...diagnostics] } });
        else if (command === 'storage') send({ id, result: { local: { ...local.data }, session: { ...session.data } } });
        else if (command === 'step') {
          let result = await execute(step);
          if (!result.passed && step.action.startsWith('assert')) {
            for (let retry = 0; retry < 7 && !result.passed; retry++) { await delay(200); result = await execute(step); }
          }
          const visual = await capture();
          send({ id, result: { ...result, ...visual, diagnostics: [...diagnostics] } });
        } else if (command === 'capture') send({ id, result: { ...(await capture()), diagnostics: [...diagnostics] } });
        else throw new Error('Unknown check command.');
      } catch (error) { send({ id, error: bounded(error.message || error) }); }
    };
    port.start();
    for (const script of event.data.scripts) {
      const element = document.createElement('script');
      if (script.module) {
        element.type = 'module'; element.textContent = script.code;
        await Promise.race([new Promise(resolve => { element.onload = resolve; element.onerror = () => { note('Module script failed to load.'); resolve(); }; document.body.append(element); }), delay(4000).then(() => note('Module initialization exceeded 4 seconds; review this app before relying on its checks.'))]);
      } else { element.textContent = script.code; document.body.append(element); }
    }
    document.dispatchEvent(new Event('DOMContentLoaded')); window.dispatchEvent(new Event('load'));
    await delay(120);
    send({ id: 'ready', result: { elements: inventory(), warnings: [...diagnostics] } });
  }
  window.addEventListener('message', initialize, true);
  parent.postMessage({ type: 'ming-upload-ready', boot }, '*');
})();
