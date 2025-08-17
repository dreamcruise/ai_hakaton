from django.urls import path
from . import views


urlpatterns = [
    path('', views.index, name='home'),
    path('register/', views.register, name='register'),
	path('login/', views.login_view, name='login'),
	path('logout/', views.logout_view, name='logout'),
	path('intake/', views.intake_wizard, name='intake'),
	path('profile/<str:username>/', views.profile, name='profile'),
    path('profile/<str:username>/generate/', views.generate_daily_ration, name='generate_daily_ration'),
	path('profile/<str:username>/update/', views.update_daily_ration, name='update_daily_ration'),
    path('products/new/', views.product_new, name='product_new'),
	path('meals/new/', views.meal_new, name='meal_new'),
	path('meals/<int:pk>/favorite/', views.meal_favorite, name='meal_favorite'),
	path('meals/<int:pk>/reaction/', views.meal_reaction, name='meal_reaction'),
]