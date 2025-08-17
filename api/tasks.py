from environs import Env
import json
from celery import shared_task
from django.db import transaction
from api.models import UserIntake
from openai import OpenAI 

env = Env()
env.read_env()

@shared_task
def compute_daily_targets_for_user(username: str) -> dict:
	from openai import OpenAI  # local import to avoid import at worker boot if missing
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
			"target_calories": "number (kcal)",
			"target_proteins_g": "number (grams)",
			"target_carbohydrates_g": "number (grams)",
			"target_fats_g": "number (grams)",
		},
		"requirements": [
			"Return only valid JSON.",
			"Use standard equations (e.g., Mifflin-St Jeor) as guidance; adjust for goal/activity.",
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
	try:
		data = json.loads(content)
	except json.JSONDecodeError:
		return {"raw": content}

	with transaction.atomic():
		# Refresh the same row to avoid races
		row = UserIntake.objects.select_for_update().get(pk=intake.pk)
		row.target_calories = float(data.get('target_calories', 0) or 0)
		row.target_proteins = float(data.get('target_proteins_g', 0) or 0)
		row.target_carbohydrates = float(data.get('target_carbohydrates_g', 0) or 0)
		row.target_fats = float(data.get('target_fats_g', 0) or 0)
		row.save(update_fields=['target_calories','target_proteins','target_carbohydrates','target_fats'])
	return {
		"saved": True,
		"targets": {
			"calories": row.target_calories,
			"proteins_g": row.target_proteins,
			"carbohydrates_g": row.target_carbohydrates,
			"fats_g": row.target_fats,
		}
	}