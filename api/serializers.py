from rest_framework import serializers
from . import models

class UserIntakeSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.UserIntake
		fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Product
		fields = '__all__'

class MealSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Meal
		fields = '__all__'

class FavoriteSerializer(serializers.Serializer):
	username = serializers.CharField(max_length=64)

class ReactionSerializer(serializers.Serializer):
	username = serializers.CharField(max_length=64)
	reaction = serializers.ChoiceField(choices=[('like','like'),('dislike','dislike')])