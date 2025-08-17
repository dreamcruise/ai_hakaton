import sys
import json
import argparse
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from environs import Env

from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from back.db import AsyncSessionLocal
from back.models import (
    UserIntakeRecord,
    ProductRecord,
    MealRecord,
    DailyRationPlanRecord,
    DailyRationItemRecord,
    MealReactionRecord,
)

env = Env()
env.read_env()

def build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update today's daily ration by replacing only disliked meals.")
    parser.add_argument("--username", type=str, required=True, help="Username to load plan and profile")
    parser.add_argument("--plan-id", type=int, help="Specific plan id to update; defaults to latest today")
    parser.add_argument("--today-only", action="store_true", default=True, help="Restrict to plans created today")

    # Macro limits (if omitted, approximate from profile)
    parser.add_argument("--calories-limit", type=float)
    parser.add_argument("--proteins-limit-g", type=float)
    parser.add_argument("--carbohydrates-limit-g", type=float)
    parser.add_argument("--fats-limit-g", type=float)

    parser.add_argument("--max-products", type=int, default=100)
    parser.add_argument("--max-meals", type=int, default=200)
    parser.add_argument("--model", type=str, default=os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    parser.add_argument("--save", action="store_true", default=True, help="Persist a new updated plan")
    parser.add_argument("--output", type=str, help="Write updated plan JSON to a file")
    return parser.parse_args()


async def load_latest_plan(session: AsyncSession, username: str, plan_id: Optional[int], today_only: bool) -> Optional[Tuple[DailyRationPlanRecord, List[DailyRationItemRecord]]]:
    q = select(DailyRationPlanRecord).where(DailyRationPlanRecord.username == username)
    if plan_id:
        q = q.where(DailyRationPlanRecord.id == plan_id)
    if today_only and not plan_id:
        start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        q = q.where(DailyRationPlanRecord.created_at >= start_of_day)
    q = q.order_by(desc(DailyRationPlanRecord.created_at)).limit(1)
    row = await session.execute(q)
    plan: Optional[DailyRationPlanRecord] = row.scalar_one_or_none()
    if not plan:
        return None
    items_row = await session.execute(
        select(DailyRationItemRecord).where(DailyRationItemRecord.plan_id == plan.id).order_by(DailyRationItemRecord.position)
    )
    items = items_row.scalars().all()
    return plan, items


async def load_profile(session: AsyncSession, username: str) -> Optional[UserIntakeRecord]:
    row = await session.execute(select(UserIntakeRecord).where(UserIntakeRecord.username == username))
    return row.scalar_one_or_none()


async def load_catalog(session: AsyncSession, max_products: int, max_meals: int) -> Dict[str, Any]:
    prows = await session.execute(select(ProductRecord).order_by(ProductRecord.id).limit(max_products))
    mrows = await session.execute(select(MealRecord).order_by(MealRecord.id).limit(max_meals))
    products = [
        {
            "id": p.id,
            "name": p.name,
            "calories": p.calories,
            "proteins": p.proteins,
            "carbohydrates": p.carbohydrates,
            "fats": p.fats,
            "type": p.type,
        }
        for p in prows.scalars().all()
    ]
    meals = [
        {
            "id": m.id,
            "name": m.name,
            "calories": m.calories,
            "proteins": m.proteins,
            "carbohydrates": m.carbohydrates,
            "fats": m.fats,
            "type": m.type,
            "recipe": m.recipe,
        }
        for m in mrows.scalars().all()
    ]
    return {"products": products, "meals": meals}


async def load_disliked_meal_names(session: AsyncSession, username: str) -> List[str]:
    # Get ids of meals disliked by user
    rows = await session.execute(
        select(MealReactionRecord.meal_id).where(
            MealReactionRecord.username == username,
            MealReactionRecord.reaction == "dislike",
        )
    )
    meal_ids = [mid for (mid,) in rows.all()]
    if not meal_ids:
        return []
    names_row = await session.execute(select(MealRecord.name).where(MealRecord.id.in_(meal_ids)))
    return [name for (name,) in names_row.all()]

def estimate_macros(profile: UserIntakeRecord) -> Tuple[float, float, float, float]:
    # Calories via Mifflin-St Jeor, activity factor + goal adj
    weight = profile.weight
    height = profile.height
    age = profile.age
    gender = profile.gender
    if gender == "male":
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    elif gender == "female":
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age
    af = {"low": 1.2, "medium": 1.55, "high": 1.725}.get(profile.activity_level, 1.4)
    tdee = bmr * af
    adj = {"lose_weight": -500, "maintain_weight": 0, "gain_weight": 500}.get(profile.goal, 0)
    calories = max(1200.0, tdee + adj)
    proteins_g = max(60.0, round(1.6 * weight))
    fats_g = max(40.0, round(0.8 * weight))
    remaining_kcal = calories - proteins_g * 4 - fats_g * 9
    carbs_g = max(0.0, remaining_kcal / 4)
    return calories, proteins_g, carbs_g, fats_g


def sum_macros(items: List[DailyRationItemRecord]) -> Dict[str, float]:
    total = {"proteins": 0.0, "carbohydrates": 0.0, "fats": 0.0, "calories": 0.0}
    for it in items:
        total["proteins"] += it.proteins
        total["carbohydrates"] += it.carbohydrates
        total["fats"] += it.fats
        total["calories"] += it.proteins * 4 + it.carbohydrates * 4 + it.fats * 9
    return total


def build_prompt(profile: Dict[str, Any], catalog: Dict[str, Any], fixed_items: List[Dict[str, Any]], disliked_positions: List[int], limits: Dict[str, float]) -> List[Dict[str, str]]:
    system = (
        "You are a nutrition assistant. Update only the disliked meals in today's plan. "
        "Keep all non-disliked meals unchanged. Use ONLY the provided catalog of meals/products. "
        "Respect allergies, dietary restrictions, kitchen equipment, and macro limits. "
        "Return valid JSON per schema."
    )

    user = {
        "task": "Replace the disliked items only, keeping others unchanged.",
        "limits": limits,
        "fixed_items": fixed_items,
        "replace_positions": disliked_positions,
        "user_profile": profile,
        "catalog": catalog,
        "output_schema": {
            "replacements": [
                {
                    "position": "number 1-5",
                    "name": "string",
                    "recipe": "string",
                    "proteins_g": "number",
                    "carbohydrates_g": "number",
                    "fats_g": "number",
                    "fiber_g": "number",
                }
            ]
        },
        "requirements": [
            "Do NOT modify fixed_items.",
            "Return one replacement per position in replace_positions.",
            "Sum of fixed_items + replacements must not exceed any macro limit.",
            "Prefer existing meals from catalog; compose from products if needed.",
            "Exclude any item violating allergies/dietary restrictions.",
        ],
    }

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ]


async def main_async(args: argparse.Namespace) -> Dict[str, Any]:
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:
        raise RuntimeError("The 'openai' package is required. Install with: pip install openai") from e

    async with AsyncSessionLocal() as session:  # type: AsyncSession
        plan_items: Optional[Tuple[DailyRationPlanRecord, List[DailyRationItemRecord]]] = await load_latest_plan(
            session, args.username, args.plan_id, args.today_only
        )
        if not plan_items:
            raise RuntimeError("No plan found for user")
        plan, items = plan_items

        profile_rec = await load_profile(session, args.username)
        if not profile_rec:
            raise RuntimeError("User profile not found")

        # Determine limits
        if args.calories_limit and args.proteins_limit_g and args.carbohydrates_limit_g and args.fats_limit_g:
            calories_limit = args.calories_limit
            proteins_limit_g = args.proteins_limit_g
            carbohydrates_limit_g = args.carbohydrates_limit_g
            fats_limit_g = args.fats_limit_g
        else:
            calories_limit, proteins_limit_g, carbohydrates_limit_g, fats_limit_g = estimate_macros(profile_rec)

        limits = {
            "calories_limit": round(calories_limit, 2),
            "proteins_limit_g": round(proteins_limit_g, 2),
            "carbohydrates_limit_g": round(carbohydrates_limit_g, 2),
            "fats_limit_g": round(fats_limit_g, 2),
        }

        # Identify disliked items by name
        disliked_names = set(await load_disliked_meal_names(session, args.username))
        disliked_positions: List[int] = []
        fixed_items: List[Dict[str, Any]] = []
        for it in items:
            it_dict = {
                "position": it.position,
                "name": it.name,
                "recipe": it.recipe,
                "proteins_g": it.proteins,
                "carbohydrates_g": it.carbohydrates,
                "fats_g": it.fats,
                "fiber_g": it.fiber,
            }
            if it.name in disliked_names:
                disliked_positions.append(it.position)
            else:
                         fixed_items.append(it_dict)

        if not disliked_positions:
            return {"message": "No disliked items to replace.", "plan_id": plan.id}

        catalog = await load_catalog(session, args.max_products, args.max_meals)

        profile = {
            "display_name": profile_rec.display_name,
            "gender": profile_rec.gender,
            "age": profile_rec.age,
            "height_cm": profile_rec.height,
            "weight_kg": profile_rec.weight,
            "goal": profile_rec.goal,
            "activity_level": profile_rec.activity_level,
            "dietary_restrictions": profile_rec.dietary_restrictions or [],
            "allergies": profile_rec.allergies or [],
            "cooking_skill": profile_rec.cooking_skill,
            "kitchen_equipment": profile_rec.kitchen_equipment or [],
            "preferred_units": profile_rec.preferred_units,
        }

        messages = build_prompt(profile, catalog, fixed_items, disliked_positions, limits)

        client = OpenAI(api_key=env.str("OPENAI_API_KEY"))
        completion = client.chat.completions.create(
            model=args.model,
            messages=messages,
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            data = {"raw": content}

        # Optionally persist
        if args.save and isinstance(data, dict) and isinstance(data.get("replacements"), list):
            # Build new plan by merging replacements
            repl_by_pos = {int(r.get("position")): r for r in data.get("replacements", [])}
            new_items: List[Dict[str, Any]] = []
            for it in items:
                if it.position in repl_by_pos:
                    r = repl_by_pos[it.position]
                    new_items.append(
                        {
                            "position": it.position,
                            "name": str(r.get("name", ""))[:256],
                            "recipe": str(r.get("recipe", "")),
                            "proteins": float(r.get("proteins_g", 0) or 0),
                            "carbohydrates": float(r.get("carbohydrates_g", 0) or 0),
                            "fats": float(r.get("fats_g", 0) or 0),
                            "fiber": float(r.get("fiber_g", 0) or 0),
                            "eaten": False,
                        }
                    )
                else:
                    new_items.append(
                        {
                            "position": it.position,
                            "name": it.name,
                            "recipe": it.recipe,
                            "proteins": it.proteins,
                            "carbohydrates": it.carbohydrates,
                            "fats": it.fats,
                            "fiber": it.fiber,
                            "eaten": it.eaten,
                        }
                    )
            async with AsyncSessionLocal() as s2:
                plan2 = DailyRationPlanRecord(username=args.username, model=args.model, raw_response=data)
                s2.add(plan2)
                await s2.commit()
                await s2.refresh(plan2)
                for ni in sorted(new_items, key=lambda x: x["position"]):
                    s2.add(
                        DailyRationItemRecord(
                            plan_id=plan2.id,
                            position=ni["position"],
                            name=ni["name"],
                            recipe=ni["recipe"],
                            proteins=ni["proteins"],
                            carbohydrates=ni["carbohydrates"],
                            fats=ni["fats"],
                            fiber=ni["fiber"],
                            eaten=ni["eaten"],
                        )
                    )
                await s2.commit()
            data["new_plan_id"] = plan2.id
        return data


def main() -> None:
    args = build_args()
    result = asyncio.run(main_async(args))
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()