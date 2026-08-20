"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include  # <-- On ajoute include ici

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('incidents.urls')),  # <-- On ajoute cette ligne pour l'API REST
]