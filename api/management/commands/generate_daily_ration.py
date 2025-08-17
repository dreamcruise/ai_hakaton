import os
import sys
import json
import argparse
from typing import Any, Dict, List, Optional

# Bootstrap Django
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nutrition.settings")
import django  # noqa: E402

django.setup()

from api.models import (  # noqa: E402
    UserIntake,
    Product,
    Meal,
    DailyRationPlan,
    DailyRationItem,
)

def build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 5-meal daily ration using ChatGPT.")
    parser.add_argument("--username", type=str, help="Username to load profile from DB")

    # Optional overrides if username not provided or to override
    parser.add_argument("--display-name", type=str)
    parser.add_argument("--gender", type=str, choices=["male", "female", "prefer_not_to_say"])
    parser.add_argument("--age", type=int)
    parser.add_argument("--height", type=float, help="cm")
    parser.add_argument("--weight", type=float, help="kg")
    parser.add_argument("--goal", type=str, choices=["lose_weight", "maintain_weight", "gain_weight"])
    parser.add_argument("--activity-level", type=str, choices=["low", "medium", "high"])
    parser.add_argument("--dietary-restrictions", type=str, help="Comma-separated list (e.g. vegetarian,vegan,...) or 'none'")
    parser.add_argument("--allergies", type=str, help="Comma-separated list of allergies")
    parser.add_argument("--cooking-skill", type=str, choices=["beginner", "intermediate", "advanced"])
    parser.add_argument(
        "--kitchen-equipment",
        type=str,
        help="Comma-separated list (e.g. oven,microwave,stovetop,...)",
    )
    parser.add_argument("--preferred-units", type=str, choices=["metric", "imperial"], default="metric")

    parser.add_argument("--max-products", type=int, default=100)
    parser.add_argument("--max-meals", type=int, default=100)
    parser.add_argument("--model", type=str, default=os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    parser.add_argument("--output", type=str, help="Path to write JSON output; defaults to stdout")
    return parser.parse_args()


def _split_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def load_profile(username: str) -> Optional[Dict[str, Any]]:
    rec = (
        UserIntake.objects.filter(username=username)
        .order_by("-created_at")
        .first()
    )
    if rec is None:
        return None
    return {
        "username": rec.username,
        "display_name": rec.display_name,
        "gender": rec.gender,
        "age": rec.age,
        "height_cm": rec.height,
        "weight_kg": rec.weight,
        "goal": rec.goal,
        "activity_level": rec.activity_level,
        "dietary_restrictions": rec.dietary_restrictions or [],
        "allergies": rec.allergies or [],
        "cooking_skill": rec.cooking_skill,
        "kitchen_equipment": rec.kitchen_equipment or [],
        "preferred_units": rec.preferred_units,
    }

def build_profile_from_args(args: argparse.Namespace) -> Dict[str, Any]:
    dr = _split_list(args.dietary_restrictions)
    if dr == ["none"]:
        dr = []
    return {
        "username": args.username or "unknown",
        "display_name": args.display_name or "User",
        "gender": args.gender or "prefer_not_to_say",
        "age": args.age or 25,
        "height_cm": args.height or 175.0,
        "weight_kg": args.weight or 70.0,
        "goal": args.goal or "maintain_weight",
        "activity_level": args.activity_level or "medium",
        "dietary_restrictions": dr,
        "allergies": _split_list(args.allergies),
        "cooking_skill": args.cooking_skill or "beginner",
        "kitchen_equipment": _split_list(args.kitchen_equipment),
        "preferred_units": args.preferred_units,
    }


def load_catalog(max_products: int, max_meals: int) -> Dict[str, Any]:
    products = list(Product.objects.order_by("id")[: max_products or 100])
    meals = list(Meal.objects.order_by("id")[: max_meals or 100])

    def product_to_dict(p: Product) -> Dict[str, Any]:
        return {
            "id": p.id,
            "name": p.name,
            "calories": p.calories,
            "proteins": p.proteins,
            "carbohydrates": p.carbohydrates,
            "fats": p.fats,
            "type": p.type,
        }

    def meal_to_dict(m: Meal) -> Dict[str, Any]:
        return {
            "id": m.id,
            "name": m.name,
            "calories": m.calories,
            "proteins": m.proteins,
            "carbohydrates": m.carbohydrates,
            "fats": m.fats,
            "type": m.type,
            "recipe": m.recipe,
        }

    return {
        "products": [product_to_dict(p) for p in products],
        "meals": [meal_to_dict(m) for m in meals],
    }

def build_prompt(profile: Dict[str, Any], catalog: Dict[str, Any]) -> List[Dict[str, str]]:
    system = (
        "You are a nutrition assistant. Create a practical daily meal plan using ONLY the provided meals/products. "
        "Respect the user's allergies, dietary restrictions, goal, and available kitchen equipment. "
        "Daily ration must have exactly 5 meals. Keep recipes feasible for the user's cooking skill. "
        "Return only valid JSON that conforms to the specified schema."
    )

    user = {
        "task": "Generate a 5-meal daily ration.",
        "constraints": {
            "use_only_from_catalog": True,
            "avoid_allergens": profile.get("allergies", []),
            "dietary_restrictions": profile.get("dietary_restrictions", []),
            "kitchen_equipment": profile.get("kitchen_equipment", []),
            "preferred_units": profile.get("preferred_units", "metric"),
        },
        "user_profile": profile,
        "catalog": catalog,
        "output_schema": {
            "daily_ration": [
                {
                    "name": "string",
                    "recipe": "string",
                    "proteins_g": "number",
                    "carbohydrates_g": "number",
                    "fats_g": "number",
                    "fiber_g": "number",
                }
            ],
        },
        "requirements": [
            "Exactly 5 items in daily_ration.",
            "Each item must specify name, recipe, proteins_g, carbohydrates_g, fats_g, fiber_g.",
            "Prefer existing meals; if needed, compose simple meals from products.",
            "Macros should be realistic and sum up consistent with goal and activity.",
            "Exclude any item violating allergies or dietary restrictions.",
        ],
    }

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ]

def main() -> None:
    # Lazy import to avoid dependency if not used
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("The 'openai' package is required. Install with: pip install openai") from e

    args = build_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    if args.username:
        profile = load_profile(args.username)
    else:
        profile = None
    if profile is None:
        profile = build_profile_from_args(args)

    catalog = load_catalog(args.max_products, args.max_meals)

    messages = build_prompt(profile, catalog)

    client = OpenAI(api_key=api_key)
    completion = client.chat.completions.create(
        model=args.model,
        messages=messages,
        temperature=0.6,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
        # Optional persistence
        if args.username and isinstance(data, dict) and isinstance(data.get("daily_ration"), list):
            plan = DailyRationPlan.objects.create(
                username=args.username,
                model=args.model,
                raw_response=data,
            )
            items: List[dict] = data.get("daily_ration", [])
            bulk = []
            for idx, item in enumerate(items, start=1):
                bulk.append(
                    DailyRationItem(
                        plan=plan,
                        position=idx,
                        name=str(item.get("name", ""))[:256],
                        recipe=str(item.get("recipe", "")),
                        proteins=float(item.get("proteins_g", 0) or 0),
                        carbohydrates=float(item.get("carbohydrates_g", 0) or 0),
                        fats=float(item.get("fats_g", 0) or 0),
                        fiber=float(item.get("fiber_g", 0) or 0),
                        eaten=False,
                    )
                )
            if bulk:
                DailyRationItem.objects.bulk_create(bulk)
        # Output
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            print(json.dumps(data, ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        # Fallback: return raw string if not valid JSON
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            print(content)


if __name__ == "__main__":
    main()