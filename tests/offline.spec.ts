import {test, expect, visit} from './browser';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';

test('production shell reopens offline and keeps private records out of its cache', async ({page, context, baseURL})=>{
  await visit(page);
  const manifest=await page.evaluate(async()=>(await fetch('/manifest.webmanifest')).json());
  expect(manifest).toMatchObject({name:'IGNITE',display:'standalone'});
  await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null && !!navigator.serviceWorker?.controller);
  await context.setOffline(true);
  if (process.env.IGNITE_TEST_STATIC) await context.route(baseURL+'/**',route=>route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Evening ratings'}).click();
  await page.getByLabel('How much physical energy did you have today?').selectOption('4');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await page.getByRole('button',{name:'Meal Log'}).click();
  await page.getByLabel('Dish name').fill('Offline private fictional dish');
  await page.getByRole('button',{name:'Confirm meal'}).click();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.getByLabel('Task',{exact:true}).fill('Offline fictional plan');
  await page.getByRole('button',{name:'Add task'}).click();
  await page.reload();
  await expect(page.getByText('Offline fictional plan · 20 min',{exact:true})).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByRole('row',{name:/Physical Vitality/}).locator('td[data-rating="4"]')).toHaveCount(1);
  const cache = await page.evaluate(async()=>{
    const name=(await caches.keys()).find(key=>key.startsWith('ignite-shell-'));
    if(!name) return [];
    const store=await caches.open(name);
    return Promise.all((await store.keys()).map(async request=>({url:request.url,privateText:(await (await store.match(request))?.text())?.includes('Offline private fictional dish')})));
  });
  expect(cache.length).toBeGreaterThan(2);
  expect(cache.every(item=>item.url.startsWith(baseURL+'/')&&!item.privateText)).toBe(true);
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('ignite-veritas-v1')!));
  expect(persisted.extras.meals[0].text).toContain('Offline private fictional dish');
  expect(persisted.extras.tasks[0].label).toBe('Offline fictional plan');
});

test('a new app-shell cache activates without replacing local records', async ({page, context, baseURL})=>{
  const output=resolve('dist');
  const worker=await readFile(resolve(output,'ignite-sw.js'),'utf8');
  const contentTypes:Record<string,string>={
    '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json',
  };
  let update=false, offline=false;
  await context.route(baseURL+'/**',async route=>{
    if (offline) return route.abort('internetdisconnected');
    const url=new URL(route.request().url());
    const filename=resolve(output,url.pathname==='/'?'index.html':'.'+url.pathname);
    if (!filename.startsWith(output+sep)) return route.fulfill({status:404});
    try {
      const body=filename.endsWith('ignite-sw.js') && update
        ? worker.replace(/const cacheName = prefix \+ "[\w]+";/,'const cacheName = prefix + "qa-shell-update";')
        : await readFile(filename);
      await route.fulfill({body,contentType:contentTypes[extname(filename)]??'application/octet-stream',headers:{'Cache-Control':'no-store'}});
    } catch { await route.fulfill({status:404}); }
  });
  await visit(page);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.getByRole('button',{name:'Start check-in'}).click();
  await page.getByLabel('What’s on your mind?').fill('Fictional draft made before app update');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ignite-veritas-v1')!));
  expect(before.settings.setup).toBe(true);
  update=true;
  await page.evaluate(async()=>{await navigator.serviceWorker.register('./ignite-sw.js?qa=update',{updateViaCache:'none'});});
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.ready).waiting);
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForFunction(async()=>{
    const keys=(await caches.keys()).filter(key=>key.startsWith('ignite-shell-'));
    return !!navigator.serviceWorker.controller && keys.length===1 && keys[0].endsWith('qa-shell-update');
  });
  offline=true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ignite-veritas-v1')!));
  expect(after.settings).toEqual(before.settings);
  expect(after.draft).toEqual(before.draft);
});
