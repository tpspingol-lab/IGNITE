import { env, InterruptableStoppingCriteria, pipeline } from '@huggingface/transformers';
import type { ProgressCallback } from '@huggingface/transformers';

export const candidates = {
  qwen: { id: 'onnx-community/Qwen2.5-1.5B-Instruct', revision: '9f9c976', dtype: 'q4f16' },
  smol: { id: 'onnx-community/SmolLM2-135M-Instruct-ONNX', revision: 'b8a5c0f', dtype: 'q8' },
} as const;
env.allowLocalModels = false;

export const companionPrompt = 'You are Lantern, a wellbeing companion. Answer the question directly in 2 to 4 short sentences. Give one specific, practical action they can try today. Avoid medical advice, diagnosis and claims about the user’s records. Only suggest reversible actions and never say that you changed anything in the app.';

export function loadChat(candidate: keyof typeof candidates, progress_callback?:ProgressCallback) {
  const {id, revision, dtype} = candidates[candidate];
  return pipeline('text-generation', id, {revision, dtype, device:'wasm', progress_callback});
}

let running: ReturnType<typeof loadChat> | undefined;
export function prepareChat(progress?:ProgressCallback) {
  running ??= loadChat('smol',progress).catch(error=>{running=undefined;throw error;});
  return running;
}
export async function hasCachedChat() {
  const {id,revision} = candidates.smol;
  try {
    const cache = await caches.open('transformers-cache');
    const files = await Promise.all(['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'].map(file=>cache.match(`https://huggingface.co/${id}/resolve/${revision}/${file}`)));
    return files.every(response=>response?.ok);
  } catch { return false; }
}
export async function askLocal(question: string, signal:AbortSignal) {
  if (!running || signal.aborted) return;
  const model = await running;
  if (signal.aborted) return;
  const stop = new InterruptableStoppingCriteria();
  const interrupt = () => stop.interrupt();
  signal.addEventListener('abort',interrupt,{once:true});
  const options = {max_new_tokens:/\b(detail|expand|explain more)\b/i.test(question)?150:95,do_sample:false,return_full_text:false,stopping_criteria:stop};
  try {
    const result = await model([
      {role:'system',content:companionPrompt},
      {role:'user',content:question}
    ],options);
    if (signal.aborted) return;
    const item = result.flat()[0]?.generated_text;
    return typeof item === 'string' ? item.trim() : item?.at(-1)?.content?.trim();
  } finally {signal.removeEventListener('abort',interrupt);}
}
