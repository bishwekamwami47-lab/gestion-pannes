from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import Site, Utilisateur, Panne, HistoriquePanne


# 1. Formulaire personnalisé pour la CREATION d'un utilisateur
class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = Utilisateur
        fields = ('username', 'role', 'site', 'specialite')


# 2. Formulaire personnalisé pour la MODIFICATION d'un utilisateur
class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = Utilisateur
        fields = '__all__'


# 3. Configuration de l'Admin Utilisateur
@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = Utilisateur

    list_display = ('username', 'email', 'role', 'site', 'specialite', 'is_staff')
    list_filter = ('role', 'site', 'specialite', 'is_staff', 'is_superuser')

    # Champs affichés sur la page de MODIFICATION
    fieldsets = UserAdmin.fieldsets + (
        ('Informations Métier', {'fields': ('role', 'site', 'specialite')}),
    )

    # Champs affichés sur la page de CRÉATION (/add/)
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'role', 'site', 'specialite'),
        }),
    )


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('id', 'nom', 'ville', 'telephone')
    search_fields = ('nom', 'ville')


@admin.register(Panne)
class PanneAdmin(admin.ModelAdmin):
    list_display = ('id', 'titre', 'site', 'service_demandeur', 'statut', 'responsable', 'date_declaration', 'date_resolution')
    list_filter = ('statut', 'site')
    search_fields = ('titre', 'service_demandeur', 'description')


@admin.register(HistoriquePanne)
class HistoriquePanneAdmin(admin.ModelAdmin):
    list_display = ('id', 'panne', 'auteur', 'ancien_statut', 'nouveau_statut', 'cree_le')
    list_filter = ('nouveau_statut',)