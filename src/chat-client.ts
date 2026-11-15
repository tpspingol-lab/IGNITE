import type { ProgressCallback } from '@huggingface/transformers';

type Reply = { id:number; progress?:Parameters<ProgressCallback>[0]; failed?:boolean; result?:unknown };
type Command =
  | { action:'cached'|'prepare' }
  | { action:'ask'; text:string };

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number,(message:Reply)=>void>();

function getWorker() {
  if (worker) return worker;
  const current = new Worker(new URL('./chat-worker.ts',import.meta.url),{type:'module'});
  current.onmessage = ({data}:MessageEvent<Reply>) => pending.get(data.id)?.(data);
  current.onerror = ()=>{
    current.terminate();
    worker=undefined;
    for (const [id,receive] of pending) receive({id,failed:true});
  };
  worker=current;
  return current;
}

function send(command:Command, progress?:ProgressCallback, signal?:AbortSignal) {
  if (signal?.aborted) return Promise.resolve(undefined);
  const instance = getWorker();
  const id = ++nextId;
  return new Promise<unknown>((resolve,reject)=>{
    const stop = ()=>{
      instance.postMessage({id,action:'stop'});
      pending.delete(id);
      resolve(undefined);
    };
    signal?.addEventListener('abort',stop,{once:true});
    pending.set(id,message=>{
      if (message.progress) {
        progress?.(message.progress);
        return;
      }
      pending.delete(id);
      signal?.removeEventListener('abort',stop);
      if (message.failed) reject(new Error('Local chat could not finish.'));
      else resolve(message.result);
    });
    instance.postMessage({...command,id});
  });
}

export async function hasCachedChat() { return await send({action:'cached'}) === true; }
export async function prepareChat(progress:ProgressCallback) { await send({action:'prepare'},progress); }
export async function askLocal(text:string,signal:AbortSignal) {
  const result = await send({action:'ask',text},undefined,signal);
  return typeof result === 'string' ? result : undefined;
}
