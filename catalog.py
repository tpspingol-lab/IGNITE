"""Extract the bundled estimates per 100 g from USDA FNDDS 2021–2023."""
import json
import sys
import zipfile
from pathlib import Path

patterns = {
    "apple": "Apple, raw", "banana": "Banana, raw", "pancakes": "Pancakes, plain",
    "ice cream": "Ice cream, vanilla",
}
with zipfile.ZipFile(sys.argv[1]) as archive:
    rows = json.load(archive.open("surveyDownload.json"))["SurveyFoods"]
catalog = {}
for label, description in patterns.items():
    food = next(row for row in rows if row["description"] == description and row["foodNutrients"])
    nutrients = {n["nutrient"]["id"]: n["amount"] for n in food["foodNutrients"]}
    catalog[label] = {"id": food["fdcId"], "kcal": nutrients[1008],
                      "protein": nutrients[1003], "carbs": nutrients[1005], "fat": nutrients[1004]}
(Path(__file__).parent / "src" / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
