from django.urls import path
from . import views

urlpatterns = [
    path('', views.index),
    path('joan/', views.joan_index),
    path('joan/calc/', views.joan_calc),
]
