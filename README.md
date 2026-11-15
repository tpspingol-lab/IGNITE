# IGNITE

## Publication review build

From this repository run `npm run dev -- --port 4176 --strictPort` and open http://127.0.0.1:4176/. Run `npm ci` first if dependencies are missing. Use the same URL and browser profile to retain local entries. This build starts with empty logs.

Try Today → Evening ratings → Progress. One complete check-in unlocks the weekly stage. All-skipped submissions count as participation. Comparisons need three rated days per pillar in each period and align elapsed weekdays in a partial week. Saved dates and time zones stay fixed after a schedule change.

Lantern defaults to guided replies. It can request permission to use a specific summary to answer a question about records. App code produces those facts without passing them to the chat model. The optional local model handles general questions. Hugging Face supplies public weights for chat and photo identification. Journal text, photos, chats and summaries remain in browser memory or browser storage. Model fetches can disclose ordinary connection information, such as the device IP address. The app has no account storage, analytics, tracking cookies, or cloud recovery. Privacy and Terms copy is pending review. Before a multi-user release, authenticate accounts and test server-enforced ownership and cross-account isolation.

### Model checks for Set 2

SmolLM2-135M-Instruct ONNX uses q8 weights (revision `b8a5c0f`) and WASM. In a fresh Chrome session on the development machine, the 135,658,354-byte weights download took 9.6 seconds and initialization completed at 12.3 seconds. Four raw prompts took 1.1–9.5 seconds each. It echoed a wind-down question verbatim, gave breakfast advice after “then suggest,” and advised setting a goal in the app in response to a confidence question. The shipped guided confidence flow gives a one-sentence practice exercise and a follow-up example. The default remains guided and the model is opt-in. Qwen q4f16 is listed at 1.22 GB. Qwen, full browser process memory, and tablet performance remain unmeasured. To compare model behavior locally, run `await (await import('/src/chat-benchmark.ts')).benchmark('qwen')` or use `'smol'` in the development browser console.

In a separate production Chrome run, the optional chat worker reached Ready in 10.1 seconds, reopened from the browser cache with Hugging Face requests blocked, and restored the draft after Stop. A subsequent wind-down question received a guided fallback. These timings are from one development machine and network.

The pinned Swin Food-101 q8 integration returned pancakes first for a pancake photo, chicken curry first for [Filipino chicken adobo with rice](https://commons.wikimedia.org/wiki/File:Filipino_Chicken_Adobo_with_rice.jpg) (Obsidian Soul, CC BY-SA 3.0), bruschetta first for a [mixed breakfast plate](https://commons.wikimedia.org/wiki/File:English_breakfast_01.JPG) (SpaceMonkey), and beef tartare first for the IGNITE logo. Single images are smoke tests. The classifier always chooses among its trained labels, including for non-food images. Users review the candidate and confirm the portion or enter their own meal. Real camera capture and Filipino-English emotion tagging still need evaluation. Emotion suggestions are optional and excluded from pillar scoring.

For QA with installed Google Chrome, build first, set `IGNITE_CHROME=1`, and run `npm test`. For offline-shell QA, set `IGNITE_TEST_STATIC=1` to serve the real `dist/` files when the sandbox blocks sockets. For direct score tests run `node --test tests/pillars.test.mjs`.

The final production bundle passed 90 Chrome cases at 1440×900, 1920×1080, and 390×844, plus eight unit tests. At Chrome’s native 125% zoom, Today and Progress fit the viewport in both themes. The offline tests exercised the production service worker and a simulated cache update. The Dubai date regression and AI tests use controlled fixtures. The preview starts with empty history in a fresh profile.

Use the production preview for installation and offline use. After opening it online and letting the service worker cache the shell, reopen it offline to use check-ins, manual logs, Plan, and history. Settings offers a versioned backup with a preview before replacement. Configure the production build with `VITE_PUBLIC_APP_URL` to include an HTTPS app address in the calendar download. Calendar alerts follow the calendar app’s local time and settings.

In the final SmolLM2 benchmark, the 135,658,354-byte download completed in 7.8 seconds and the model initialized in 10.6 seconds. Raw confidence and overwhelm replies took 12.3 and 15.1 seconds, the water prompt took 4.1 seconds and the missing-sleep prompt took 2.5 seconds. The model invented a 12-hour sleep value. The app uses confirmed records and deterministic summaries for log answers. Guided UI responses in a separate Chrome run took 215 ms, 30 ms, 26 ms, and 25 ms respectively.

A browser-based Veritas AI + Health prototype for finding one manageable next step after a difficult day. The entry follows a fictional high-school student who keeps replaying a presentation.

## Run the production build

Requires Node.js 24. Run `npm ci`, `npm run build`, and `npm run preview`. For browser tests, run `npx playwright install chromium` once, then `npm test` after the build. Tests use local production assets at desktop and mobile-sized viewports.

Open Today, enter a fictional note, request an emotion tag, correct it to Disappointed, and save the step. Close and reopen the tab. Select How did it go?, then Skipped and Too big. The next day, the smaller option drops the writing requirement. Keep original step restores the previous choice.

## Reproduce the benchmark

1. Use Python 3.12. Install `pip install -r requirements.txt`.
2. Download [train.tsv](https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data/train.tsv), [dev.tsv](https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data/dev.tsv), and [test.tsv](https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data/test.tsv) into `data/`. Keep the official split assignments.
3. Run `python train.py` and `node parity.mjs` from the repo root.

The model classifies five supported emotions. All splits use the same inclusion rule: exactly one annotation in the supported label set, excluding unsupported and multi-label rows. The training rows fit the vocabulary, IDF, and classifier. The dev split provides class counts. The most-common-label baseline uses the training label frequencies. The test split measures both systems against the same 1,939 eligible examples. The parity script compares labels and decision scores with the same TypeScript module the app uses. Tests also call the shipped model in Chromium. Raw GoEmotions comments and parity fixtures are excluded from app assets.

## Meal identification and nutrition

On request, Transformers.js downloads the pinned quantized Food-101 model and runs inference using ONNX Runtime Web. The photo stays on the device. Predictions are editable and may be wrong, especially for unfamiliar or mixed dishes. A confirmed dish plus a gram amount can yield a USDA estimate for a matching catalog entry. Other entries can be saved without an estimate. Use `python catalog.py path/to/FoodData_Central_survey_food_json_2024-10-31.zip` to rebuild the bundled catalog.

One fresh Chromium session produced pancakes as the top suggestion for a pancake photo in approximately 15 seconds including loading the page and downloading the model. The q8 weights are 93,297,500 bytes. This smoke test measures one successful inference. Recognition accuracy, real-phone camera capture and Safari performance still need testing.

## Submission files

- [One-page write-up](WRITEUP.md)
- [Evaluation output](evaluation.json)
- [Two-minute demo script](DEMO.md)
- [Source credits](CREDITS.md)

This project is a prototype and is not medical advice.
