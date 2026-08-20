from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Site, Panne, HistoriquePanne

User = get_user_model()

SEUIL_CONNEXION = timedelta(minutes=15)


def _est_connecte(utilisateur):
    """Un utilisateur est considéré connecté s'il s'est connecté récemment."""
    if not utilisateur.last_login:
        return False
    return timezone.now() - utilisateur.last_login < SEUIL_CONNEXION


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Met à jour last_login à chaque connexion réussie (JWT)."""

    def validate(self, attrs):
        data = super().validate(attrs)
        self.user.last_login = timezone.now()
        self.user.save(update_fields=['last_login'])
        return data


# Sérialiseur Utilisateur
class UserSerializer(serializers.ModelSerializer):
    site_nom = serializers.ReadOnlyField(source='site.nom', default=None)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    derniere_connexion = serializers.DateTimeField(source='last_login', read_only=True)
    connecte = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'site', 'site_nom', 'specialite', 'password', 'derniere_connexion', 'connecte']
        read_only_fields = ['id']

    def get_connecte(self, obj):
        return _est_connecte(obj)

    def validate(self, attrs):
        if attrs.get('role') == User.Role.INFORMATICIEN and not attrs.get('site'):
            raise serializers.ValidationError({'site': 'Un informaticien doit être rattaché à un site.'})
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])
        return instance

# Sérialiseur de création d'utilisateur (réservé à l'admin)
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    site_nom = serializers.ReadOnlyField(source='site.nom', default=None)
    derniere_connexion = serializers.DateTimeField(source='last_login', read_only=True)
    connecte = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'site', 'site_nom', 'specialite', 'password', 'derniere_connexion', 'connecte']
        read_only_fields = ['id']

    def get_connecte(self, obj):
        return _est_connecte(obj)

    def validate(self, attrs):
        # Un informaticien doit être rattaché à un site
        if attrs.get('role') == User.Role.INFORMATICIEN and not attrs.get('site'):
            raise serializers.ValidationError({'site': 'Un informaticien doit être rattaché à un site.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

# Sérialiseur Site
class SiteSerializer(serializers.ModelSerializer):
    nb_pannes = serializers.IntegerField(read_only=True)
    nb_informaticiens = serializers.IntegerField(read_only=True)
    informaticiens = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = '__all__'

    def get_informaticiens(self, obj):
        user = self.context['request'].user
        qs = obj.informaticiens.all()
        if getattr(user, 'role', None) == 'INFORMATICIEN':
            # Un informaticien ne voit que son propre profil, même sur son site
            qs = qs.filter(pk=user.pk)
        return [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'specialite': u.specialite,
                'connecte': _est_connecte(u),
                'derniere_connexion': u.last_login,
            }
            for u in qs
        ]

# Sérialiseur Historique
class HistoriquePanneSerializer(serializers.ModelSerializer):
    auteur_username = serializers.ReadOnlyField(source='auteur.username')

    class Meta:
        model = HistoriquePanne
        fields = '__all__'

# Sérialiseur Panne
class PanneSerializer(serializers.ModelSerializer):
    site_nom = serializers.ReadOnlyField(source='site.nom')
    responsable_username = serializers.ReadOnlyField(source='responsable.username')
    historique = HistoriquePanneSerializer(many=True, read_only=True)
    site = serializers.PrimaryKeyRelatedField(queryset=Site.objects.all(), required=False)

    class Meta:
        model = Panne
        fields = '__all__'
        read_only_fields = ['responsable', 'date_declaration', 'date_resolution']
