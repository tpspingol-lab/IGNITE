# Source credits

- [GoEmotions official data and label mapping](https://github.com/google-research/google-research/tree/master/goemotions), Google Research, Apache 2.0. [Dataset card](https://huggingface.co/datasets/google-research-datasets/go_emotions).
- [Food-101](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/), Bossard, Guillaumin and Van Gool. No training images are bundled.
- [Swin Food-101 ONNX](https://huggingface.co/onnx-community/swin-finetuned-food101-ONNX), Apache 2.0 as listed by ONNX Community. Export of [aspis/swin-finetuned-food101](https://huggingface.co/aspis/swin-finetuned-food101). Pinned at e5e50bfc6425aa546f3b4421ca8bd79d0dd610b8. Preprocessing uses the pinned artifact’s 224×224 processor settings and the label IDs in its configuration.
- [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/), FNDDS 2021–2023 October 2024 release. See `src/catalog.json` for food IDs and estimates per 100 grams.
- [NHS stress](https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/stress/), [NHS self-esteem](https://www.nhs.uk/mental-health/self-help/tips-and-support/raise-low-self-esteem/), and [NIDDK habits](https://www.niddk.nih.gov/health-information/diet-nutrition/changing-habits-better-health), summarized in Resources.
- [scikit-learn](https://scikit-learn.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Transformers.js](https://huggingface.co/docs/transformers.js/), [ONNX Runtime](https://onnxruntime.ai/), and [Playwright](https://playwright.dev/).
- OpenAI ChatGPT and Codex assisted with design, implementation, evaluation and documentation. Sage Cutout logo and Publication boards supplied by the team.
- [SmolLM2 Instruct ONNX](https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX) supplies the optional q8 local chat model. [Qwen2.5 Instruct ONNX](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct) was a comparison candidate.
- The pancake photo used for a local smoke test came from [Unsplash](https://images.unsplash.com/photo-1528207776546-365bb710ee93). It is excluded from the app and repository.
