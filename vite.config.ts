import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {defineConfig} from 'vite';
import type {Plugin} from 'vite';

const publicShell = ['ignite-logo.png','ignite-icon-192.png','ignite-icon-512.png','manifest.webmanifest'];

function offlineShell():Plugin {
  return {
    name:'ignite-offline-shell',
    apply:'build',
    transformIndexHtml() {
      return [
        {tag:'link',attrs:{rel:'manifest',href:'./manifest.webmanifest'},injectTo:'head'},
        {tag:'link',attrs:{rel:'apple-touch-icon',href:'./ignite-icon-192.png'},injectTo:'head'},
        {
          tag:'script',
          children:`if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./ignite-sw.js', {updateViaCache:'none'}).catch(() => {});
    }, {once:true});
  }`,
          injectTo:'body',
        },
      ];
    },
    generateBundle(_options,bundle) {
      const output = Object.values(bundle).filter(asset=>/\.(?:html|css|js)$/.test(asset.fileName));
      const digest = createHash('sha256').update('ignite-shell-v1');
      for (const source of ['./index.html','./vite.config.ts']) digest.update(readFileSync(new URL(source,import.meta.url)));
      for (const file of publicShell) digest.update(readFileSync(new URL('./public/'+file,import.meta.url)));
      for (const asset of output) digest.update(asset.type==='chunk' ? asset.code : asset.source);
      const assets = [...new Set(['index.html',...output.map(asset=>asset.fileName),...publicShell])].sort();
      this.emitFile({type:'asset',fileName:'ignite-sw.js',source:workerSource(digest.digest('hex').slice(0,16),assets)});
    },
  };
}

function workerSource(version:string, assets:string[]) {
  return `const scope = self.registration.scope;
const prefix = 'ignite-shell-' + encodeURIComponent(scope) + '-';
const cacheName = prefix + ${JSON.stringify(version)};
const html = new URL('index.html',scope).href;
const assets = new Set(${JSON.stringify(assets)}.map(file=>new URL(file,scope).href));

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map(url=>new Request(url,{cache:'reload'})));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name!==cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request = event.request;
  if (request.method!=='GET') return;
  const url = new URL(request.url);
  if (request.mode==='navigate' && (url.pathname===new URL(scope).pathname || url.pathname===new URL(html).pathname)) {
    if (url.origin!==self.location.origin) return;
    event.respondWith(caches.open(cacheName).then(cache=>cache.match(html)).then(response=>response || fetch(request)));
  } else if (assets.has(url.href)) {
    // The build's static assets have identical bytes for every Origin header.
    event.respondWith(caches.open(cacheName).then(cache=>cache.match(request,{ignoreVary:true})).then(response=>response || fetch(request)));
  }
});
`;
}

export default defineConfig({plugins:[offlineShell()]});
