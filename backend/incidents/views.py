from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.decorators import action

from .models import Site, Panne, HistoriquePanne
from .serializers import (
    SiteSerializer,
    PanneSerializer,
    HistoriquePanneSerializer,
    UserSerializer,
    UserCreateSerializer,
)
from .permissions import IsAdminGeneralOrReadOnly

User = get_user_model()


def _appliquer_date_resolution(panne):
    """Met à jour date_resolution selon le statut de la panne."""
    if panne.statut == Panne.Statut.RESOLU and not panne.date_resolution:
        panne.date_resolution = timezone.now()
        panne.save(update_fields=['date_resolution'])
    elif panne.statut != Panne.Statut.RESOLU and panne.date_resolution:
        panne.date_resolution = None
        panne.save(update_fields=['date_resolution'])


# Vue pour les Sites (lecture pour tous, écriture réservée aux admins)
class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all().order_by('id')
    serializer_class = SiteSerializer
    permission_classes = [IsAdminGeneralOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        is_admin = user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL'
        if self.request.query_params.get('archives'):
            if not is_admin:
                return Site.objects.none()
            base = Site.objects.filter(archive=True).order_by('id')
            annotations = {
                'nb_pannes': Count('pannes'),
                'nb_informaticiens': Count('informaticiens'),
            }
        elif is_admin:
            base = Site.objects.filter(archive=False).order_by('id')
            annotations = {
                'nb_pannes': Count('pannes'),
                'nb_informaticiens': Count('informaticiens'),
            }
        elif getattr(user, 'role', None) == 'INFORMATICIEN' and getattr(user, 'site_id', None):
            base = Site.objects.filter(pk=user.site_id, archive=False).order_by('id')
            annotations = {
                'nb_pannes': Count('pannes', filter=Q(pannes__responsable=user)),
                'nb_informaticiens': Count('informaticiens', filter=Q(informaticiens=user)),
            }
        else:
            return Site.objects.none()
        return base.annotate(**annotations).prefetch_related('informaticiens')

    def destroy(self, request, *args, **kwargs):
        # Supprimer un site actif = l'archiver (corbeille)
        try:
            instance = Site.objects.get(pk=kwargs['pk'])
        except Site.DoesNotExist:
            raise ValidationError({'detail': 'Site introuvable.'})
        if not instance.archive:
            instance.archive = True
            instance.save(update_fields=['archive'])
            return Response(status=status.HTTP_204_NO_CONTENT)
        # Déjà archivé : suppression définitive (pannes + historiques supprimés)
        nb_infos = instance.informaticiens.count()
        if nb_infos:
            return Response(
                {'detail': f'Suppression définitive impossible : {nb_infos} informaticien(s) sont rattaché(s) à ce site.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def restaurer(self, request, pk=None):
        try:
            instance = Site.objects.get(pk=pk)
        except Site.DoesNotExist:
            raise ValidationError({'detail': 'Site introuvable.'})
        if not instance.archive:
            return Response({'detail': 'Ce site n’est pas archivé.'}, status=status.HTTP_400_BAD_REQUEST)
        instance.archive = False
        instance.save(update_fields=['archive'])
        return Response({'detail': 'Site restauré.'})


# Vue pour les Pannes (filtrage selon le rôle + historique des statuts)
class PanneViewSet(viewsets.ModelViewSet):
    serializer_class = PanneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL':
            qs = Panne.objects.all()
        elif getattr(user, 'role', None) == 'INFORMATICIEN':
            # Chaque informaticien ne voit que SES propres pannes, même dans le même site
            qs = Panne.objects.filter(responsable=user)
        else:
            return Panne.objects.none()

        qs = qs.select_related('site', 'responsable').prefetch_related('historique__auteur')

        # Filtres par query params
        statut = self.request.query_params.get('statut')
        site_id = self.request.query_params.get('site')
        titre = self.request.query_params.get('titre')
        responsable = self.request.query_params.get('responsable')
        if statut:
            qs = qs.filter(statut=statut)
        if site_id:
            qs = qs.filter(site_id=site_id)
        if titre:
            qs = qs.filter(titre__icontains=titre)
        if responsable == 'me':
            qs = qs.filter(responsable=user)
        elif responsable:
            # Seul l'admin peut consulter les pannes d'un informaticien précis
            if user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL':
                qs = qs.filter(responsable_id=responsable)
            else:
                qs = Panne.objects.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL':
            site = serializer.validated_data.get('site')
            if not site:
                raise ValidationError({'site': "L'administrateur doit préciser le site de la panne."})
        else:
            site = getattr(user, 'site', None)
            if not site:
                raise ValidationError({'site': 'Informaticien non rattaché à un site.'})
        instance = serializer.save(responsable=user, site=site)
        if instance.statut == Panne.Statut.RESOLU:
            instance.date_resolution = timezone.now()
            instance.save(update_fields=['date_resolution'])

    def perform_update(self, serializer):
        panne = self.get_object()
        ancien_statut = panne.statut
        nouveau_statut = serializer.validated_data.get('statut', ancien_statut)

        if nouveau_statut != ancien_statut and not panne.can_transition_to(nouveau_statut):
            raise ValidationError({
                'statut': f'Transition non autorisée : {ancien_statut} → {nouveau_statut}.'
            })

        instance = serializer.save()

        if nouveau_statut != ancien_statut:
            commentaire = self.request.data.get('commentaire', '')
            HistoriquePanne.objects.create(
                panne=instance,
                auteur=self.request.user,
                ancien_statut=ancien_statut,
                nouveau_statut=nouveau_statut,
                commentaire=commentaire,
            )
            _appliquer_date_resolution(instance)

    @action(detail=True, methods=['post'])
    def changer_statut(self, request, pk=None):
        """Change le statut d'une panne et journalise l'historique."""
        panne = self.get_object()
        statut = request.data.get('statut')

        if statut not in Panne.Statut.values:
            raise ValidationError({'statut': 'Statut invalide.'})
        if statut == panne.statut:
            raise ValidationError({'statut': 'La panne a déjà ce statut.'})
        if not panne.can_transition_to(statut):
            raise ValidationError({
                'statut': f'Transition non autorisée : {panne.statut} → {statut}.'
            })

        ancien_statut = panne.statut
        panne.statut = statut
        panne.save(update_fields=['statut'])
        _appliquer_date_resolution(panne)

        HistoriquePanne.objects.create(
            panne=panne,
            auteur=request.user,
            ancien_statut=ancien_statut,
            nouveau_statut=statut,
            commentaire=request.data.get('commentaire', ''),
        )

        # Invalider le cache de prefetch pour renvoyer l'historique à jour
        panne._prefetched_objects_cache = {}
        serializer = self.get_serializer(panne)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques sur le périmètre de l'utilisateur connecté (+ ses propres pannes)."""
        user = request.user
        qs = self.get_queryset()
        par_statut = qs.values('statut').annotate(total=Count('id')).order_by('statut')
        # Répartition par site : toujours tous les sites visibles (même sans pannes)
        is_admin = user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL'
        if is_admin:
            sites = Site.objects.filter(archive=False)
        else:
            sites = Site.objects.filter(pk=user.site_id, archive=False)
        counts = {
            item['site_id']: item['total']
            for item in qs.values('site_id').annotate(total=Count('id'))
        }
        par_site = [{'id': s.pk, 'site__nom': s.nom, 'total': counts.get(s.pk, 0)} for s in sites]
        par_site.sort(key=lambda x: -x['total'])
        mes = qs.filter(responsable=user)
        return Response({
            'total': qs.count(),
            'en_cours': qs.filter(statut=Panne.Statut.EN_COURS).count(),
            'resolues': qs.filter(statut=Panne.Statut.RESOLU).count(),
            'a_transferer': qs.filter(statut=Panne.Statut.TRANSFERT_EXTERNE).count(),
            'par_statut': list(par_statut),
            'par_site': list(par_site),
            'mes_total': mes.count(),
            'mes_en_cours': mes.filter(statut=Panne.Statut.EN_COURS).count(),
            'mes_resolues': mes.filter(statut=Panne.Statut.RESOLU).count(),
            'mes_a_transferer': mes.filter(statut=Panne.Statut.TRANSFERT_EXTERNE).count(),
        })


# Vue pour l'Historique
class HistoriquePanneViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = HistoriquePanneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL':
            return HistoriquePanne.objects.all().select_related('panne', 'auteur')
        if getattr(user, 'role', None) == 'INFORMATICIEN':
            return HistoriquePanne.objects.filter(panne__responsable=user).select_related('panne', 'auteur')
        return HistoriquePanne.objects.none()


# Gestion des utilisateurs (lecture pour tous, écriture réservée aux admins)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related('site').order_by('username')
    permission_classes = [IsAdminGeneralOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related('site').order_by('username')
        if user.is_superuser or getattr(user, 'role', None) == 'ADMIN_GENERAL':
            return qs
        if getattr(user, 'role', None) == 'INFORMATICIEN':
            # Chaque informaticien ne voit que son propre profil
            return qs.filter(pk=user.pk)
        return qs.none()


# Vue pour récupérer le profil de l'utilisateur connecté
class UserProfileView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
