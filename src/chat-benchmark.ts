import { candidates, companionPrompt, loadChat } from './chat-model';
import { confidenceReply, guidedReply } from './lantern-replies';

const reportedHeap = () => (performance as Performance & {memory?: {usedJSHeapSize:number}}).memory?.usedJSHeapSize ?? null;
const prompts = [
  {question:'How can I build confidence before speaking in class?',summary:null},
  {question:'I feel overwhelmed with schoolwork. What can I do right now?',summary:null},
  {question:'How much water did I log today?',summary:'Water: 1275 mL recorded today.'},
  {question:'How much did I sleep today?',summary:'No sleep entries recorded today.'},
];

export async function benchmark(candidate: 'qwen' | 'smol') {
  const {id, revision, dtype} = candidates[candidate];
  const start = performance.now();
  const beforeHeap = reportedHeap();
  const downloads: Record<string,{bytes?:number; completedMs?:number}> = {};
  const run = await loadChat(candidate,event=>{
    if (!('file' in event) || !event.file.endsWith('.onnx')) return;
    const file = downloads[event.file] ??= {};
    if (event.status==='progress') file.bytes=event.loaded;
    if (event.status==='done') file.completedMs=Math.round(performance.now()-start);
  });
  const loadMs = Math.round(performance.now() - start);
  try {
    const checks = [];
    for (const {question,summary} of prompts) {
      const before = performance.now();
      const result = await run([
        {role:'system',content:summary ? 'Give a short answer using only this fictional test fact: '+summary : companionPrompt},
        {role:'user',content:question},
      ],{max_new_tokens:95,do_sample:false,return_full_text:false});
      const generated = result.flat()[0]?.generated_text;
      const answer = typeof generated === 'string' ? generated.trim() : generated?.at(-1)?.content?.trim();
      const ms = Math.round(performance.now()-before);
      const guideStart = performance.now();
      const guided = summary ?? confidenceReply(question,[]) ?? guidedReply(question);
      checks.push({question,answer,ms,guided,guidedMs:performance.now()-guideStart});
    }
    return {id,revision,dtype,loadMs,downloads,checks,jsHeapBefore:beforeHeap,jsHeapAfter:reportedHeap()};
  } finally { await run.dispose(); }
}
