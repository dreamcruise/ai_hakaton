from environs import Env
from celery import shared_task
from typing import Any, Dict, List
import os, json
from api.models import UserIntake, Product, Meal, DailyRationPlan, DailyRationItem
from django.db import transaction
from django.db.models import F
import logging

env = Env()
env.read_env()



@shared_task
def _to_float(x):
    try:
        return float(str(x).strip().lower().replace('kcal','').replace('g','').strip())
    except Exception:
        return 0.0

@shared_task
def compute_daily_targets_for_user(username: str) -> dict:
    from openai import OpenAI
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY is not set"}

    intake = UserIntake.objects.filter(username=username).order_by('-created_at').first()
    if not intake:
        return {"error": "No intake found"}

    prompt = {
        "task": "Compute realistic daily macro targets based on the user's profile.",
        "user_profile": {
            "gender": intake.gender,
            "age": intake.age,
            "height_cm": intake.height,
            "weight_kg": intake.weight,
            "goal": intake.goal,
            "activity_level": intake.activity_level,
            "dietary_restrictions": intake.dietary_restrictions or [],
            "allergies": intake.allergies or [],
        },
        "output_schema": {
            "protein_g_per_day": "number",
            "carbohydrates_g_per_day": "number",
            "fats_g_per_day": "number",
            "calories_kcal_per_day": "number (optional)",
        },
        "requirements": [
            "Return only valid JSON (no commentary).",
            "Values should be daily totals, in grams for macros, kcal for calories.",
            "Use standard equations; adjust for goal and activity.",
        ]
    }

    client = OpenAI(api_key=api_key)
    completion = client.chat.completions.create(
        model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
        messages=[
            {"role": "system", "content": "You are a nutrition calculator."},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content or "{}"
    logging.getLogger(__name__).info("GPT raw targets for %s: %s", username, content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {"raw": content}

    prot = (data.get('protein_g_per_day')
            or data.get('target_proteins_g') or data.get('proteins_g') or data.get('target_proteins'))
    carb = (data.get('carbohydrates_g_per_day')
            or data.get('target_carbohydrates_g') or data.get('carbohydrates_g') or data.get('target_carbohydrates'))
    fat  = (data.get('fats_g_per_day')
            or data.get('target_fats_g') or data.get('fats_g') or data.get('target_fats'))
    cal  = (data.get('calories_kcal_per_day')
            or data.get('target_calories') or data.get('calories'))

    prot_f = _to_float(prot)
    carb_f = _to_float(carb)
    fat_f  = _to_float(fat)
    cal_f  = _to_float(cal) if cal is not None else None

    updates = {
        "target_proteins": prot_f,
        "target_carbohydrates": carb_f,
        "target_fats": fat_f,
    }
    if cal is not None:
        updates["target_calories"] = cal_f

    UserIntake.objects.filter(pk=intake.pk).update(**updates)

    # Return current values for convenience
    refreshed = UserIntake.objects.get(pk=intake.pk)
    return {
        "saved": True,
        "targets": {
            "calories": refreshed.target_calories,
            "proteins_g": refreshed.target_proteins,
            "carbohydrates_g": refreshed.target_carbohydrates,
            "fats_g": refreshed.target_fats,
        }
    }