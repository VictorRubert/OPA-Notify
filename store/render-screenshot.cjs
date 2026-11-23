// Render the real popup with synthetic data for the Chrome Web Store listing.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = 'https://termofy-preview.example';
const output = path.join(__dirname, 'termofy-popup-1280x800.png');
const now = new Date('2026-11-23T13:40:00-03:00').getTime();

const cover = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Termofy — prévia</title>
<style>
*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;background:#111925;color:#f3f6fb;font:16px Arial,sans-serif;overflow:hidden}
.head{height:100px;padding:30px 72px 18px;border-bottom:1px solid #344358;display:flex;align-items:center;gap:18px}
.mark{width:52px;height:52px;object-fit:contain}.head h1{font-size:32px;margin:0}.head p{color:#b8c5d5;margin:4px 0 0}
.body{display:flex;gap:90px;padding:35px 176px}.panel{width:400px}.panel h2{font-size:16px;margin:0 0 12px;color:#ffad4b}
iframe{display:block;width:400px;height:600px;border:1px solid #44536a;border-radius:12px;background:#151b25;box-shadow:0 16px 40px #0005}
.foot{position:absolute;right:72px;bottom:18px;color:#9eafc3;font-size:12px}
</style>
<div class="head"><img class="mark" src="/icons/termofy-mark.svg" alt=""><div><h1>Termofy</h1><p>Acompanhe e priorize seus atendimentos no Opa! Suite</p></div></div>
<div class="body"><div class="panel"><h2>Notificações e fila</h2><iframe title="Aba Notificações" src="/popup/popup.html"></iframe></div>
<div class="panel"><h2>Humor e pendência externa</h2><iframe title="Aba Termostato" src="/popup/popup.html#termostato"></iframe></div></div>
<div class="foot">Prévia da extensão com dados fictícios</div></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/**`, route => {
      const requestPath = new URL(route.request().url()).pathname;
      if (requestPath === '/') return route.fulfill({ contentType: 'text/html', body: cover });
      const local = path.resolve(root, '.' + requestPath);
      if (!local.startsWith(root + path.sep) || !fs.existsSync(local)) return route.abort();
      const contentType = local.endsWith('.css') ? 'text/css' : local.endsWith('.js') ? 'application/javascript' : local.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
      return route.fulfill({ contentType, body: fs.readFileSync(local) });
    });
    await page.addInitScript(({ timestamp }) => {
      Date.now = () => timestamp;
      window.chrome = {
        storage: { local: { get: async () => ({}), set: async () => {} } },
        runtime: { sendMessage: async () => ({
          success: true, currentCount: 3, lastCheckAt: timestamp - 4000,
          history: [
            { company: 'EMPRESA EXEMPLO A', protocol: 'OPA2026000001', receivedAt: timestamp - 300000 },
            { company: 'EMPRESA EXEMPLO B', protocol: 'OPA2026000002', receivedAt: timestamp - 900000 },
            { company: 'EMPRESA EXEMPLO C', protocol: 'OPA2026000003', receivedAt: timestamp - 1800000 }
          ]
        }) }
      };
    }, { timestamp: now });
    await page.goto(origin + '/');
    await page.frameLocator('iframe[title="Aba Notificações"]').locator('#currentCount').getByText('3').waitFor();
    await page.frameLocator('iframe[title="Aba Termostato"]').locator('#tab-termostato[aria-selected="true"]').waitFor();
    if (errors.length) throw new Error(errors.join('\n'));
    await page.screenshot({ path: output });
    console.log(output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
