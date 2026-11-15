import { env, pipeline, RawImage } from '@huggingface/transformers';

const revision = 'e5e50bfc6425aa546f3b4421ca8bd79d0dd610b8';
const model = 'onnx-community/swin-finetuned-food101-ONNX';
env.allowLocalModels = false;
function loadModel() {
  return pipeline('image-classification', model, { revision, dtype: 'q8', device: 'wasm' });
}
let classifier: ReturnType<typeof loadModel> | undefined;
export async function identifyPhoto(file: Blob) {
  classifier ??= loadModel().catch(error => { classifier = undefined; throw error; });
  const [run, img] = await Promise.all([classifier, RawImage.fromBlob(file)]);
  const result = await run(img, { top_k: 3 });
  return result.flat().map(match => match.label.replaceAll('_', ' '));
}
