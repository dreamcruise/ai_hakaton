from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class UserIntake(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_intakes', null=True, blank=True)
	username = models.CharField(max_length=64)
	display_name = models.CharField(max_length=128)
	gender = models.CharField(max_length=32)
	age = models.PositiveIntegerField()
	height = models.FloatField()
	weight = models.FloatField()
	goal = models.CharField(max_length=32)
	activity_level = models.CharField(max_length=32)
	dietary_restrictions = models.JSONField(null=True, blank=True)
	allergies = models.JSONField(null=True, blank=True)
	cooking_skill = models.CharField(max_length=32)
	kitchen_equipment = models.JSONField(null=True, blank=True)
	preferred_units = models.CharField(max_length=16)
	created_at = models.DateTimeField(auto_now_add=True)

	# Daily targets
	target_calories = models.FloatField(null=True, blank=True)
	target_proteins = models.FloatField(null=True, blank=True)
	target_carbohydrates = models.FloatField(null=True, blank=True)
	target_fats = models.FloatField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		indexes = [models.Index(fields=["username"])]

class Product(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products', null=True, blank=True)
	name = models.CharField(max_length=128)
	calories = models.FloatField()
	type = models.CharField(max_length=32)
	proteins = models.FloatField()
	carbohydrates = models.FloatField()
	fats = models.FloatField()
	weight = models.FloatField()
	created_at = models.DateTimeField(auto_now_add=True)
	
class Meal(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meals', null=True, blank=True)
	name = models.CharField(max_length=128)
	calories = models.FloatField()
	type = models.CharField(max_length=32)
	proteins = models.FloatField()
	carbohydrates = models.FloatField()
	fats = models.FloatField()
	weight = models.FloatField()
	recipe = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

class ProductFavorite(models.Model):
	product = models.ForeignKey(Product, on_delete=models.CASCADE)
	username = models.CharField(max_length=64)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("product", "username")

class MealFavorite(models.Model):
	meal = models.ForeignKey(Meal, on_delete=models.CASCADE)
	username = models.CharField(max_length=64)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("meal", "username")

class ProductReaction(models.Model):
	product = models.ForeignKey(Product, on_delete=models.CASCADE)
	username = models.CharField(max_length=64)
	reaction = models.CharField(max_length=16)  # like/dislike
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("product", "username")

class MealReaction(models.Model):
	meal = models.ForeignKey(Meal, on_delete=models.CASCADE)
	username = models.CharField(max_length=64)
	reaction = models.CharField(max_length=16)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("meal", "username")

class DailyRationPlan(models.Model):
	username = models.CharField(max_length=64)
	model = models.CharField(max_length=64, null=True, blank=True)
	raw_response = models.JSONField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

class DailyRationItem(models.Model):
	plan = models.ForeignKey(DailyRationPlan, on_delete=models.CASCADE)
	position = models.PositiveIntegerField()
	name = models.CharField(max_length=256)
	recipe = models.TextField()
	proteins = models.FloatField()
	carbohydrates = models.FloatField()
	fats = models.FloatField()
	fiber = models.FloatField()
	eaten = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)