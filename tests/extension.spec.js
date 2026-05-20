// @ts-check
import { test, expect, chromium } from '@playwright/test';
import http from 'http';
import path from 'path';
import fs from 'fs';

const EXTENSION_PATH = process.cwd();
const TEST_PAGE_PATH = path.join(EXTENSION_PATH, 'tests', 'test-page.html');

// Write a minimal test page so the extension can inject into it
if (!fs.existsSync(TEST_PAGE_PATH)) {
  fs.writeFileSync(TEST_PAGE_PATH, '<html><head><meta charset="utf-8"></head><body><h1>RadioLag Test</h1></body></html>');
}

test.describe('RadioLag Extension', () => {
  /** @type {http.Server} */
  let server;
  let serverUrl;
  /** @type {import('playwright').BrowserContext} */
  let browserContext;

  test.beforeAll(async () => {
    // Start local HTTP server
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(TEST_PAGE_PATH, 'utf-8'));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    serverUrl = `http://127.0.0.1:${addr.port}/`;

    // Launch Chrome with extension
    const userDataDir = path.join(EXTENSION_PATH, 'test-results', `ext-user-data-${Date.now()}`);
    console.log('User data dir:', userDataDir);
    console.log('Extension path:', EXTENSION_PATH);
    browserContext = await chromium.launchPersistentContext(userDataDir, {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
  });

  test.afterAll(async () => {
    await browserContext?.close();
    await new Promise((resolve) => server?.close(resolve));
    // Clean up test page
    try { fs.unlinkSync(TEST_PAGE_PATH); } catch (_) { /* ignore */ }
  });

  // --- HELPERS ---
  async function newPage() {
    const p = await browserContext.newPage();
    await p.goto(serverUrl, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#radio-ser-host', { timeout: 10000 });
    return p;
  }

  async function getSR(p) {
    return p.evaluateHandle(() => document.querySelector('#radio-ser-host').shadowRoot);
  }

  async function q(p, sel) {
    const sr = await getSR(p);
    return sr.asElement().$(sel);
  }

  async function qq(p, sel) {
    const sr = await getSR(p);
    return sr.asElement().$$(sel);
  }

  async function clickSR(p, sel) {
    const el = await q(p, sel);
    if (el) await el.click();
  }

  async function textSR(p, sel) {
    const el = await q(p, sel);
    return el ? el.textContent() : null;
  }

  async function displaySR(p, sel) {
    const el = await q(p, sel);
    return el ? el.evaluate((e) => e.style.display) : null;
  }

  async function computedBg(p, sel) {
    const el = await q(p, sel);
    return el ? el.evaluate((e) => window.getComputedStyle(e).backgroundColor) : null;
  }

  async function getAttr(p, sel, attr) {
    const el = await q(p, sel);
    return el ? el.evaluate((e, a) => e.getAttribute(a), attr) : null;
  }

  // ================================================================
  // TESTS
  // ================================================================

  test('DEBUG — extension injection', async () => {
    const p = await browserContext.newPage();
    p.on('console', (msg) => console.log(`[PAGE] ${msg.type()}: ${msg.text()}`));
    p.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));
    await p.goto(serverUrl, { waitUntil: 'load' });
    await p.waitForTimeout(4000);
    const host = await p.$('#radio-ser-host');
    console.log('radio-ser-host found:', !!host);
    console.log('Chrome userAgent:', await p.evaluate(() => navigator.userAgent));
    console.log('Plugins length:', (await p.evaluate(() => navigator.plugins.length)));
    // Check content script injection by evaluating whether our host exists
    const bodyHTML = await p.evaluate(() => document.body?.innerHTML?.substring(0, 500));
    console.log('Body HTML:', bodyHTML);
    // Check if there's any sign of extension
    const allScripts = await p.evaluate(() => document.querySelectorAll('script').length);
    console.log('Scripts on page:', allScripts);
    await p.screenshot({ path: path.join(EXTENSION_PATH, 'test-results', 'debug.png') });
    await p.close();
  });

  test('01 — Shadow DOM inyectado con botón flotante 📻', async () => {
    const p = await newPage();
    expect(await p.$('#radio-ser-host')).not.toBeNull();

    const btn = await q(p, '#radio-ser-btn');
    expect(btn).not.toBeNull();
    const text = await btn.textContent();
    expect(text).toContain('📻');
    expect(text).toContain('Radio');
    expect(await displaySR(p, '#radio-ser-btn')).not.toBe('none');
    await p.close();
  });

  test('02 — Click botón abre selector con SER y COPE', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');

    expect(await displaySR(p, '#radio-ser-selector')).toBe('block');

    const stationBtns = await qq(p, '.station-btn');
    expect(stationBtns).toHaveLength(2);
    expect(await stationBtns[0].textContent()).toContain('SER');
    expect(await stationBtns[1].textContent()).toContain('COPE');
    await p.close();
  });

  test('03 — Seleccionar SER abre panel de control', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[0].click();

    expect(await displaySR(p, '#radio-ser-panel')).toBe('block');
    expect(await textSR(p, '#station-name')).toContain('SER');
    expect(await q(p, '#delay-slider')).not.toBeNull();
    expect(await q(p, '#btn-play-pause')).not.toBeNull();
    expect(await q(p, '#btn-change-station')).not.toBeNull();
    expect(await q(p, '#btn-close-radio')).not.toBeNull();
    expect(await q(p, '#radio-led')).not.toBeNull();
    await p.close();
  });

  test('04 — Seleccionar COPE muestra nombre COPE', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[1].click();

    expect(await textSR(p, '#station-name')).toContain('COPE');
    await p.close();
  });

  test('05 — Slider delay actualiza valor (0→50→179→0)', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[0].click();

    const slider = await q(p, '#delay-slider');
    const display = await q(p, '#delay-value');

    await slider.evaluate((el) => {
      el.value = '50';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await display.textContent()).toBe('50.0');

    await slider.evaluate((el) => {
      el.value = '179';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await display.textContent()).toBe('179.0');

    await slider.evaluate((el) => {
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await display.textContent()).toBe('0.0');
    await p.close();
  });

  test('06 — Botón Cambiar vuelve al selector', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[0].click();

    await clickSR(p, '#btn-change-station');

    expect(await displaySR(p, '#radio-ser-selector')).toBe('block');
    expect(await displaySR(p, '#radio-ser-panel')).toBe('none');
    await p.close();
  });

  test('07 — Botón cerrar oculta panel, botón reaparece', async () => {
    const p = await newPage();
    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[0].click();

    await clickSR(p, '#btn-close-radio');

    expect(await displaySR(p, '#radio-ser-btn')).toBe('flex');
    expect(await displaySR(p, '#radio-ser-panel')).toBe('none');
    await p.close();
  });

  test('08 — Color botón: gris → SER(rojo) → COPE(azul)', async () => {
    const p = await newPage();
    const bg = (sel) => computedBg(p, sel);

    expect(await bg('#radio-ser-btn')).toBe('rgb(108, 117, 125)');

    await clickSR(p, '#radio-ser-btn');
    const b1 = await qq(p, '.station-btn');
    await b1[0].click();
    await clickSR(p, '#btn-close-radio');
    expect(await bg('#radio-ser-btn')).toBe('rgb(220, 53, 69)');

    await clickSR(p, '#radio-ser-btn');
    await clickSR(p, '#btn-change-station');
    const b2 = await qq(p, '.station-btn');
    await b2[1].click();
    await clickSR(p, '#btn-close-radio');
    expect(await bg('#radio-ser-btn')).toBe('rgb(26, 82, 118)');
    await p.close();
  });

  test('09 — Tooltip botón muestra nombre de emisora', async () => {
    const p = await newPage();

    expect(await getAttr(p, '#radio-ser-btn', 'title')).toBe('Abrir radio');

    await clickSR(p, '#radio-ser-btn');
    const btns = await qq(p, '.station-btn');
    await btns[0].click();
    await clickSR(p, '#btn-close-radio');
    expect(await getAttr(p, '#radio-ser-btn', 'title')).toBe('Cadena SER');
    await p.close();
  });
});
