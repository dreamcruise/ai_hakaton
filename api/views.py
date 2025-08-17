from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.core import management
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required

from .models import UserIntake, Product, Meal, MealFavorite, MealReaction
from .tasks import compute_daily_targets_for_user

from api.services.ration_generator import generate_ration
import subprocess
import sys
import os

def index(request):
	return render(request, 'index.html')

@require_http_methods(["GET", "POST"])
def register(request):
	if request.method == 'POST':
		username = (request.POST.get('username') or '').strip()
		password = (request.POST.get('password') or '').strip()
		if not username or not password:
			messages.error(request, 'Username and password are required')
			return render(request, 'register.html')
		if User.objects.filter(username=username).exists():
			messages.error(request, 'User with this login already exists')
			return render(request, 'register.html')
		User.objects.create_user(username=username, password=password)
		messages.success(request, 'Registration successful. Please log in.')
		return redirect('login')
	return render(request, 'register.html')


@require_http_methods(["GET", "POST"])
def login_view(request):
	if request.method == 'POST':
		username = (request.POST.get('username') or '').strip()
		password = (request.POST.get('password') or '').strip()
		user = authenticate(request, username=username, password=password)
		if user is not None:
			login(request, user)
			return redirect('intake')
		messages.error(request, 'Invalid login or password')
	return render(request, 'login.html')

@login_required
def logout_view(request):
	logout(request)
	messages.success(request, 'You have been logged out')
	return redirect('home')

@login_required
@require_http_methods(["GET", "POST"])
def intake_wizard(request):
	if request.method == 'POST':
		data = request.POST
		username = data.get('username','').strip()
		display_name = data.get('display_name','').strip()
		gender = data.get('gender')
		age = int(data.get('age') or 0)
		height = float(data.get('height') or 0)
		weight = float(data.get('weight') or 0)
		goal = data.get('goal')
		activity_level = data.get('activity_level')
		dietary_restrictions = request.POST.getlist('dietary_restrictions') or []
		allergies = [a.strip() for a in (data.get('allergies','').split(',') if data.get('allergies') else []) if a.strip()]
		cooking_skill = data.get('cooking_skill')
		kitchen_equipment = request.POST.getlist('kitchen_equipment') or []
		preferred_units = data.get('preferred_units')

		if not username or not display_name or age < 13 or age > 120 or height < 100 or height > 250 or weight < 30 or weight > 300:
			messages.error(request, 'Please correct the fields and try again.')
		else:
			UserIntake.objects.create(
				username=username,
				display_name=display_name,
				gender=gender,
				age=age,
				height=height,
				weight=weight,
				goal=goal,
				activity_level=activity_level,
				dietary_restrictions=dietary_restrictions,
				allergies=allergies,
				cooking_skill=cooking_skill,
				kitchen_equipment=kitchen_equipment,
				preferred_units=preferred_units,
			)
			# Kick off background computation of daily targets
			compute_daily_targets_for_user.delay(username)
			messages.info(request, 'Profile saved. Daily targets are being computed in the background.')
			return redirect('profile', username=username)

	context = {
		'genders': ['male','female','prefer_not_to_say'],
		'goals': ['lose_weight','maintain_weight','gain_weight'],
		'activities': ['low','medium','high'],
		'restrictions': ['vegetarian','vegan','halal','kosher','lactose_free','gluten_free','none'],
		'cooking_skills': ['beginner','intermediate','advanced'],
		'equipments': ['oven','microwave','stovetop','blender','food_processor','stand_mixer','air_fryer','slow_cooker','pressure_cooker','grill','toaster','rice_cooker','juicer','kitchen_scale','immersion_blender','mandoline'],
		'units': ['metric','imperial'],
	}
	return render(request, 'intake_wizard.html', context)

@login_required
def profile(request, username: str):
	latest = UserIntake.objects.filter(username=username).order_by('-created_at').first()
	return render(request, 'profile.html', { 'username': username, 'profile': latest })

@login_required
@require_http_methods(["GET", "POST"])
def product_new(request):
	if request.method == 'POST':
		p = Product(
			name=request.POST.get('name','').strip(),
			calories=float(request.POST.get('calories') or 0),
			type=request.POST.get('type'),
			proteins=float(request.POST.get('proteins') or 0),
			carbohydrates=float(request.POST.get('carbohydrates') or 0),
			fats=float(request.POST.get('fats') or 0),
		)
		p.save()
		messages.success(request, 'Product created')
		return redirect('home')
	return render(request, 'product_new.html', { 'types': ['proteins','carbohydrates','fats','fiber'] })

@login_required
@require_http_methods(["GET", "POST"])
def meal_new(request):
	if request.method == 'POST':
		m = Meal(
			name=request.POST.get('name','').strip(),
			calories=float(request.POST.get('calories') or 0),
			type=request.POST.get('type'),
			recipe=request.POST.get('recipe','').strip(),
			proteins=float(request.POST.get('proteins') or 0),
			carbohydrates=float(request.POST.get('carbohydrates') or 0),
			fats=float(request.POST.get('fats') or 0),
		)
		m.save()
		messages.success(request, 'Meal created')
		return redirect('home')
	return render(request, 'meal_new.html', { 'types': ['proteins','carbohydrates','fats','fiber'] })

@login_required
@require_http_methods(["POST"])
def meal_favorite(request, pk: int):
	meal = get_object_or_404(Meal, pk=pk)
	username = request.POST.get('username')
	MealFavorite.objects.get_or_create(meal=meal, username=username)
	messages.success(request, 'Favorited meal')
	return redirect('home')

@login_required
@require_http_methods(["POST"])
def meal_reaction(request, pk: int):
	meal = get_object_or_404(Meal, pk=pk)
	username = request.POST.get('username')
	reaction = request.POST.get('reaction')
	MealReaction.objects.update_or_create(meal=meal, username=username, defaults={'reaction': reaction})
	messages.success(request, f'Reaction set: {reaction}')
	return redirect('home')

def _run_script(module_path: str, args: list[str]) -> tuple[int, str]:
	py = sys.executable
	cmd = [py, module_path, *args]
	env = os.environ.copy()
	proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
	return proc.returncode, proc.stdout.decode('utf-8', errors='replace')

@login_required
@require_http_methods(["POST"])
def generate_daily_ration(request, username: str):
    if request.method == "POST":
        data = generate_ration(username='vosh') #request.user.username
        # Можно показать результат на отдельной странице
        return render(request, "ration_result.html", {"ration": data})
    return redirect("profile", username='vosh') #username

@login_required
@require_http_methods(["POST"])
def update_daily_ration(request, username: str):
	try:
		management.call_command('update_daily_ration', username=username)
		messages.success(request, 'Daily ration updated.')
	except Exception as e:
		messages.error(request, f'Update failed: {e}')
	return redirect('profile', username=username)