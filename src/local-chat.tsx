import {useEffect,useSyncExternalStore} from 'react';

type Status = { phase:'off'|'checking'|'downloading'|'preparing'|'ready'|'error'; loaded?:number; total?:number };
const key = 'ignite-local-chat-enabled-v1';
let state:Status = {phase:'off'};
let loading:Promise<void> | undefined;
const subscribers = new Set<()=>void>();
const snapshot = () => state;
const subscribe = (callback:()=>void) => {subscribers.add(callback);return ()=>{subscribers.delete(callback);};};
const subscribeOnline = (callback:()=>void) => {
  window.addEventListener('online',callback);
  window.addEventListener('offline',callback);
  return ()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback);};
};
const online = ()=>navigator.onLine;
function update(next:Status) {state=next;subscribers.forEach(callback=>callback());}
function remember(enabled:boolean) {
  try { if(enabled)localStorage.setItem(key,'true'); else localStorage.removeItem(key); }
  catch { /* The in-memory chat remains usable. */ }
}
function initialize(restore:boolean) {
  if (loading || state.phase === 'ready') return;
  update({phase:restore?'checking':'downloading'});
  loading = (async()=>{
    try {
      const model = await import('./chat-client');
      if (restore && !await model.hasCachedChat()) {remember(false);update({phase:'off'});return;}
      if (restore) update({phase:'preparing'});
      await model.prepareChat(event=>{
        if (restore || !('file' in event) || !event.file.endsWith('model_quantized.onnx')) return;
        if (event.status === 'progress') update({phase:'downloading',loaded:event.loaded,total:event.total>0?event.total:undefined});
        if (event.status === 'done') update({phase:'preparing'});
      });
      remember(true);update({phase:'ready'});
    } catch {update({phase:'error'});}
    finally {loading=undefined;}
  })();
}
export function useLocalChat() { return useSyncExternalStore(subscribe,snapshot); }
export function ChatSetup({manage=false}:{manage?:boolean}) {
  const status = useLocalChat();
  const isOnline = useSyncExternalStore(subscribeOnline,online);
  useEffect(()=>{
    try {if(state.phase==='off' && localStorage.getItem(key)==='true') initialize(true);}catch { /* User can enable manually. */ }
  },[]);
  if (status.phase==='ready') return <div><p className="hint" role="status">Local chat ready · SmolLM2 135M</p>{manage && <button onClick={()=>{remember(false);update({phase:'off'});}}>Turn off local chat</button>}</div>;
  if (status.phase==='checking' || status.phase==='preparing') return <p className="hint" role="status">Preparing local chat…</p>;
  if (status.phase==='downloading') return <div role="status"><p>Downloading model…</p><progress aria-label="Model download" value={status.total ? status.loaded ?? 0 : undefined} max={status.total ?? 1}/>{status.loaded!==undefined && <span> {(status.loaded/1e6).toFixed(1)} MB{status.total ? ` / ${(status.total/1e6).toFixed(1)} MB · ${Math.round(status.loaded/status.total*100)}%` : ''}</span>}</div>;
  if (!isOnline) return <p className="hint" role="status">Model download needs a connection. Guided replies are available offline.</p>;
  return <div className="chat-setup"><p className="hint">{status.phase==='error' ? 'Local chat could not initialize. Guided replies are available.' : 'SmolLM2 135M · about 136 MB of model weights from Hugging Face.'}</p><button onClick={()=>initialize(false)}>{status.phase==='error'?'Retry local chat':'Enable local chat'}</button></div>;
}
