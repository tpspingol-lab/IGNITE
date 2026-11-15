# IGNITE · Veritas AI + Health

**Our own idea.** A high-school student dealing with recurring school stress can leave a difficult class unsure what to do next. IGNITE helps them reflect and choose one manageable action.

**What we built.** A short journal entry produces a suggested emotion tag the student can correct. Their confirmed tag, time and energy guide an action from a curated library. Today restores the saved action after reopening and offers a lighter version the day after a “Too big” report. Progress uses four self-ratings with separate coverage rules for the first score and weekly comparisons. Confirmed portions can yield USDA estimates when a catalog match exists. Logs, drafts, and Lantern chat stay in the browser. The production app can reopen offline after setup.

**Model and evaluation.** We trained TF-IDF with logistic regression on 15,459 single-label GoEmotions training comments for five labels. We kept official split assignments and applied the same label filter to all splits. Both systems used the same 1,939 eligible held-out examples. Macro-F1 was **0.534** for the classifier and **0.181** for a baseline that always predicted neutral, the most frequent training label. The shipped inference code matched Python on all 1,939 predictions.

| Label | Model false positives | Model false negatives | Baseline false positives | Baseline false negatives |
|---|---:|---:|---:|---:|
| Anger | 79 | 48 | 0 | 131 |
| Disappointment | 124 | 54 | 0 | 88 |
| Nervousness | 8 | 8 | 0 | 12 |
| Neutral | 106 | 234 | 333 | 0 |
| Sadness | 59 | 32 | 0 | 102 |

**An actual error.** The model tagged “You take that back right now! [NAME] does not deserve this.” as anger. GoEmotions labeled it neutral (ed9tl7w). The imperative and exclamation make anger a plausible reading, but the text lacks context. The mismatch illustrates why users can correct the suggestion. Nervousness had only 12 eligible test cases. The benchmark measures performance on English Reddit comments. The fictional school demo is separate, and performance on student journals and across demographic groups remains unmeasured.

**Limits.** Evaluate the tagger on independently labeled student-style check-ins before expanding its labels. Food-101 gives a fixed set of guesses, even for some unfamiliar dishes and non-food images. Lantern uses guided replies by default and offers an optional SmolLM2 download for general questions. Its recorded-data answers come from app calculations after permission.

**Credits.** [GoEmotions](https://github.com/google-research/google-research/tree/master/goemotions), [scikit-learn](https://scikit-learn.org/), [Food-101 ONNX conversion](https://huggingface.co/onnx-community/swin-finetuned-food101-ONNX), [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/), OpenAI ChatGPT and Codex. See [full credits](CREDITS.md).

This project is a prototype and is not medical advice.
