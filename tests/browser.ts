import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
const mime: Record<string,string> = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.wasm':'application/wasm'};
export const test = base.extend({
  context: async ({context}, use) => {
    if (process.env.IGNITE_TEST_STATIC) {
      const root = resolve('dist');
      await context.route('http://127.0.0.1:4173/**', async route => {
        const url = new URL(route.request().url());
        const file = resolve(root, url.pathname === '/' ? 'index.html' : '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + sep)) return route.abort();
        try { await route.fulfill({body:await readFile(file),contentType:mime[extname(file)] ?? 'application/octet-stream'}); }
        catch { await route.fulfill({status:404}); }
      });
    }
    await use(context);
  },
});
export { expect };
export async function navigateTo(page:Page,name:'Resources'|'Settings') {
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  const more=nav.getByRole('button',{name:'More',exact:true});
  if (await more.isVisible() && (await more.getAttribute('aria-expanded'))!=='true') await more.click();
  await nav.getByRole('button',{name,exact:true}).click();
}
export async function visit(page: Page) {
  await page.goto('/');
  await page.locator('.app-shell').waitFor();
  const agreement = page.getByRole('dialog', {name:'Key facts before you continue'});
  if (await agreement.count()) {
    await agreement.getByRole('checkbox').check();
    await agreement.getByRole('button', {name:'Continue',exact:true}).click();
  }
  const skipSetup = page.getByRole('button', {name:'Skip setup',exact:true});
  if (await skipSetup.isVisible()) await skipSetup.click();
}
