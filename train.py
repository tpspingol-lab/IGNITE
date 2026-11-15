"""Train and evaluate IGNITE's single-tag classifier on official GoEmotions splits."""
import csv
import json
import re
from collections import Counter
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, multilabel_confusion_matrix
from sklearn.pipeline import make_pipeline

ROOT = Path(__file__).parent
LABELS = {2: "anger", 9: "disappointment", 19: "nervousness", 25: "sadness", 27: "neutral"}
TOKEN = r"[a-z0-9_]{2,}"


def split(name):
    with (ROOT / "data" / f"{name}.tsv").open(encoding="utf-8", newline="") as file:
        rows = list(csv.reader(file, delimiter="\t", quoting=csv.QUOTE_NONE))
    return [(text, LABELS[int(label)], row_id) for text, label, row_id in rows
            if "," not in label and int(label) in LABELS]


def tokens(text):
    return re.findall(TOKEN, text.translate(str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")))


def main():
    train, dev, test = (split(name) for name in ("train", "dev", "test"))
    counts = {k: dict(Counter(row[1] for row in rows))
              for k, rows in zip(("train", "dev", "test"), (train, dev, test))}
    print("Class counts:", counts, flush=True)
    train_text, train_y, _ = zip(*train)
    test_text, test_y, ids = zip(*test)
    model = make_pipeline(
        TfidfVectorizer(tokenizer=tokens, token_pattern=None, lowercase=False, ngram_range=(1, 2), min_df=2, max_features=12000),
        LogisticRegression(class_weight="balanced", max_iter=600, random_state=0),
    )
    model.fit(train_text, train_y)
    vectorizer, classifier = model.steps[0][1], model.steps[1][1]
    labels = classifier.classes_.tolist()
    prediction = model.predict(test_text)
    majority = Counter(train_y).most_common(1)[0][0]
    baseline = [majority] * len(test_y)

    def evaluate(output):
        matrix = multilabel_confusion_matrix(test_y, output, labels=labels)
        return {"macro_f1": f1_score(test_y, output, labels=labels, average="macro", zero_division=0),
                "by_label": {name: {"fp": int(row[0, 1]), "fn": int(row[1, 0])}
                             for name, row in zip(labels, matrix)}}

    row = next(i for i, actual in enumerate(test_y) if actual != prediction[i])
    results = {"counts": counts, "test_n": len(test), "baseline_label": majority,
               "baseline": evaluate(baseline), "classifier": evaluate(prediction),
               "failure": {"id": ids[row], "actual": test_y[row], "predicted": str(prediction[row]),
                           "text": test_text[row]}}
    (ROOT / "public" / "emotion-model.json").write_text(json.dumps({
        "labels": labels, "vocab": {k: int(v) for k, v in vectorizer.vocabulary_.items()}, "idf": vectorizer.idf_.tolist(),
        "weights": classifier.coef_.tolist(), "bias": classifier.intercept_.tolist()
    }, separators=(",", ":")), encoding="utf-8")
    (ROOT / "data" / "parity.json").write_text(json.dumps([
        [text, str(tag), scores.tolist()]
        for text, tag, scores in zip(test_text, prediction, model.decision_function(test_text))
    ]), encoding="utf-8")
    (ROOT / "evaluation.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
