"""
URL configuration for config project.
"""
import os
from pathlib import Path

from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import path, include, re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('incidents.urls')),  # L'API REST
]

# En production (frontend/dist compilé par Vite) : sert l'application React.
# Toute URL hors de /api/ et /admin/ renvoie index.html pour laisser React gérer le routage.
INDEX_HTML = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'dist' / 'index.html'


def spa(request):
    if not INDEX_HTML.exists():
        raise Http404('Frontend non compilé : lancez "npm run build" dans frontend/')
    return FileResponse(open(INDEX_HTML, 'rb'))


if os.environ.get('DJANGO_SERVE_SPA', 'False') == 'True' and INDEX_HTML.exists():
    urlpatterns += [re_path(r'^(?!api/|admin/|static/).*$', spa)]