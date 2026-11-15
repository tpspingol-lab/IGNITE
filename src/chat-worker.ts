import { askLocal, hasCachedChat, prepareChat } from './chat-model';

type Command =
  | { id:number; action:'cached'|'prepare'|'stop' }
  | { id:number; action:'ask'; text:string };
const requests = new Map<number,AbortController>();
let generation = Promise.resolve();

self.onmessage = async ({data}:MessageEvent<Command>)=>{
  const {id,action} = data;
  if (action === 'stop') {
    requests.get(id)?.abort();
    return;
  }
  try {
    let result;
    if (action === 'cached') result = await hasCachedChat();
    if (action === 'prepare') await prepareChat(progress=>self.postMessage({id,progress}));
    if (data.action === 'ask') {
      const controller = new AbortController();
      requests.set(id,controller);
      const reply = generation.then(()=>askLocal(data.text,controller.signal));
      generation = reply.then(()=>{},()=>{});
      result = await reply;
    }
    self.postMessage({id,result});
  } catch {
    self.postMessage({id,failed:true});
  } finally {
    requests.delete(id);
  }
};
