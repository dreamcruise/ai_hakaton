# api/services/ration_generator.py
import os
import json
from typing import Dict, Any, List, Optional
from api.models import UserIntake, Product, Meal, DailyRationPlan, DailyRationItem
from openai import OpenAI

def generate_ration(username: Optional[str] = None, model: str = None) -> Dict[str, Any]:
    # Загружаем профиль
    if username:
        rec = (
            UserIntake.objects.filter(username=username)
            .order_by("-created_at")
            .first()
        )
        if rec:
            profile = {
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
        else:
            raise ValueError(f"No profile found for user {username}")
    else:
        raise ValueError("Username is required")

    # Каталог продуктов/блюд
    products = list(Product.objects.order_by("id")[:100])
    meals = list(Meal.objects.order_by("id")[:100])

    catalog = {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "calories": p.calories,
                "proteins": p.proteins,
                "carbohydrates": p.carbohydrates,
                "fats": p.fats,
                "type": p.type,
            }
            for p in products
        ],
        "meals": [
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
            for m in meals
        ],
    }

    catalog = {
			'products': list(Product.objects.filter(user__username=username).order_by('id').values('id','name','calories','proteins','carbohydrates','fats','weight','type')),
			'meals': list(Meal.objects.filter(user__username=username).order_by('id').values('id','name','calories','proteins','carbohydrates','fats','weight','type','recipe')),
		}

    # prompt
    messages = [
        {"role": "system", "content": "You are a nutrition assistant..."},
        {"role": "user", "content": json.dumps({
            "task": "Generate a 5-meal daily ration.",
            "user_profile": profile,
            "catalog": catalog,
        }, ensure_ascii=False)},
    ]

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    completion = client.chat.completions.create(
        model=model or "gpt-4o-mini",
        messages=messages,
        temperature=0.6,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content or "{}"
    data = json.loads(content)

    # сохраняем план в БД
    plan = DailyRationPlan.objects.create(
        username=username,
        model=model or "gpt-4o-mini",
        raw_response=data,
    )
    bulk = []
    for idx, item in enumerate(data.get("daily_ration", []), start=1):
        bulk.append(
            DailyRationItem(
                plan=plan,
                position=idx,
                name=item.get("name", ""),
                recipe=item.get("recipe", ""),
                proteins=item.get("proteins_g", 0),
                carbohydrates=item.get("carbohydrates_g", 0),
                fats=item.get("fats_g", 0),
                fiber=item.get("fiber_g", 0),
                eaten=False,
            )
        )
    DailyRationItem.objects.bulk_create(bulk)

    return data
