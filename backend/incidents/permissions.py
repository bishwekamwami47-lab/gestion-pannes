from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminGeneral(BasePermission):
    """Accès réservé aux administrateurs généraux (et superusers)."""

    message = 'Réservé aux administrateurs généraux.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL'


class IsAdminGeneralOrReadOnly(BasePermission):
    """Lecture pour tout utilisateur authentifié, écriture réservée aux admins."""

    message = 'Réservé aux administrateurs généraux.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL'
