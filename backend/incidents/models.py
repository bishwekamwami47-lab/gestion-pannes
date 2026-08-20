from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Site(models.Model):
    nom = models.CharField(max_length=150, unique=True)
    adresse = models.CharField(max_length=255, blank=True)
    ville = models.CharField(max_length=100, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    archive = models.BooleanField(default=False)

    def __str__(self):
        return self.nom


class Utilisateur(AbstractUser):
    class Role(models.TextChoices):
        ADMIN_GENERAL = 'ADMIN_GENERAL', 'Administrateur général'
        INFORMATICIEN = 'INFORMATICIEN', 'Informaticien de site'

    class Specialite(models.TextChoices):
        RESEAU = 'RESEAU', 'Réseau'
        MATERIEL = 'MATERIEL', 'Matériel'
        LOGICIEL = 'LOGICIEL', 'Logiciel'
        SECURITE = 'SECURITE', 'Sécurité'
        IMPRESSION = 'IMPRESSION', 'Impression'
        AUTRE = 'AUTRE', 'Autre'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.INFORMATICIEN)
    site = models.ForeignKey(Site, null=True, blank=True, on_delete=models.SET_NULL, related_name='informaticiens')
    specialite = models.CharField(max_length=30, choices=Specialite.choices, blank=True)

    def clean(self):
        super().clean()
        if self.role == self.Role.INFORMATICIEN and not self.site_id:
            raise ValidationError({'site': 'Un informaticien doit être rattaché à un site.'})


class Panne(models.Model):
    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours de résolution'
        RESOLU = 'RESOLU', 'Résolu'
        TRANSFERT_EXTERNE = 'TRANSFERT_EXTERNE', 'À transférer à un technicien externe'
        ACHAT_MATERIEL = 'ACHAT_MATERIEL', 'Achat de matériel nécessaire'

    TRANSITIONS = {
        Statut.EN_COURS: {Statut.RESOLU, Statut.TRANSFERT_EXTERNE, Statut.ACHAT_MATERIEL},
        Statut.TRANSFERT_EXTERNE: {Statut.EN_COURS, Statut.RESOLU, Statut.ACHAT_MATERIEL},
        Statut.ACHAT_MATERIEL: {Statut.EN_COURS, Statut.RESOLU, Statut.TRANSFERT_EXTERNE},
        Statut.RESOLU: {Statut.EN_COURS},
    }

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='pannes')
    service_demandeur = models.CharField(max_length=150)
    contact_demandeur = models.CharField(max_length=150, blank=True)
    titre = models.CharField(max_length=200)
    description = models.TextField()
    statut = models.CharField(max_length=25, choices=Statut.choices, default=Statut.EN_COURS)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='pannes_assignees')
    date_declaration = models.DateTimeField(auto_now_add=True)
    date_resolution = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date_declaration']

    def can_transition_to(self, nouveau_statut):
        """Vérifie si le passage vers nouveau_statut est autorisé."""
        if self.statut == nouveau_statut:
            return True
        return nouveau_statut in self.TRANSITIONS.get(self.statut, set())

    def __str__(self):
        return f'#{self.pk} - {self.titre}'


class HistoriquePanne(models.Model):
    panne = models.ForeignKey(Panne, on_delete=models.CASCADE, related_name='historique')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    ancien_statut = models.CharField(max_length=25, blank=True)
    nouveau_statut = models.CharField(max_length=25)
    commentaire = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-cree_le']
