from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Site, Panne, HistoriquePanne

User = get_user_model()


class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.site_a = Site.objects.create(nom='Site A', ville='Lubumbashi')
        self.site_b = Site.objects.create(nom='Site B', ville='Kinshasa')

        self.admin = User.objects.create_superuser(username='admin', password='adminpass123', role='ADMIN_GENERAL')
        self.info_a = User.objects.create_user(username='info_a', password='infopass123', role='INFORMATICIEN', site=self.site_a)
        self.info_b = User.objects.create_user(username='info_b', password='infopass123', role='INFORMATICIEN', site=self.site_b)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)


class AuthTests(BaseAPITestCase):
    def test_login_retourne_tokens(self):
        res = self.client.post(reverse('token_obtain_pair'), {'username': 'admin', 'password': 'adminpass123'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

    def test_login_incorrect(self):
        res = self.client.post(reverse('token_obtain_pair'), {'username': 'admin', 'password': 'mauvais'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_me(self):
        self.authenticate(self.info_a)
        res = self.client.get(reverse('user_me'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'info_a')
        self.assertEqual(res.data['site_nom'], 'Site A')


class SitesTests(BaseAPITestCase):
    def test_admin_archive_puis_restaure_site(self):
        site_vide = Site.objects.create(nom='Site Vide', ville='Test')
        self.authenticate(self.admin)
        # Archiver (supprimer)
        res = self.client.delete(reverse('site-detail', args=[site_vide.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Site.objects.get(pk=site_vide.pk).archive)
        # Masqué de la liste normale
        res = self.client.get(reverse('site-list'))
        self.assertNotIn('Site Vide', [s['nom'] for s in res.data['results']])
        # Visible dans la corbeille
        res = self.client.get(reverse('site-list'), {'archives': '1'})
        self.assertIn('Site Vide', [s['nom'] for s in res.data['results']])
        # Restaurer
        res = self.client.post(reverse('site-restaurer', args=[site_vide.pk]))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Site.objects.get(pk=site_vide.pk).archive)

    def test_admin_supprime_definitivement_site_archive(self):
        panne = Panne.objects.create(site=self.site_b, service_demandeur='X', titre='Panne A',
                                     responsable=self.info_b)
        histo = HistoriquePanne.objects.create(panne=panne, auteur=self.info_b,
                                              ancien_statut='', nouveau_statut=Panne.Statut.EN_COURS)
        self.info_b.site = None
        self.info_b.save()
        self.authenticate(self.admin)
        # 1er DELETE = archiver
        res = self.client.delete(reverse('site-detail', args=[self.site_b.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        # 2e DELETE = suppression définitive (cascade pannes + historiques)
        res = self.client.delete(reverse('site-detail', args=[self.site_b.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Site.objects.filter(pk=self.site_b.pk).exists())
        self.assertFalse(Panne.objects.filter(pk=panne.pk).exists())
        self.assertFalse(HistoriquePanne.objects.filter(pk=histo.pk).exists())

    def test_suppression_definitive_bloquee_si_informaticiens(self):
        self.authenticate(self.admin)
        # Archiver
        res = self.client.delete(reverse('site-detail', args=[self.site_a.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        # Suppression définitive bloquée (info_a rattaché)
        res = self.client.delete(reverse('site-detail', args=[self.site_a.pk]))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('informaticien', res.data['detail'])
        self.assertTrue(Site.objects.filter(pk=self.site_a.pk).exists())

    def test_informaticien_ne_voit_pas_la_corbeille(self):
        Site.objects.create(nom='Archivé', ville='X', archive=True)
        self.authenticate(self.info_a)
        res = self.client.get(reverse('site-list'), {'archives': '1'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['results'], [])


class PanneTests(BaseAPITestCase):
    def test_informaticien_cree_panne_sur_son_site(self):
        self.authenticate(self.info_a)
        res = self.client.post(reverse('panne-list'), {
            'titre': 'Imprimante en panne',
            'description': 'Ne répond plus',
            'service_demandeur': 'Secrétariat',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        panne = Panne.objects.get(pk=res.data['id'])
        self.assertEqual(panne.site, self.site_a)
        self.assertEqual(panne.responsable, self.info_a)
        self.assertEqual(panne.statut, Panne.Statut.EN_COURS)

    def test_admin_sans_site_est_refuse(self):
        self.authenticate(self.admin)
        res = self.client.post(reverse('panne-list'), {
            'titre': 'Panne sans site',
            'description': 'test',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_peut_choisir_le_site(self):
        self.authenticate(self.admin)
        res = self.client.post(reverse('panne-list'), {
            'titre': 'Panne admin',
            'description': 'test',
            'service_demandeur': 'Direction',
            'site': self.site_b.id,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Panne.objects.get(pk=res.data['id']).site, self.site_b)

    def test_informaticien_ne_voit_que_ses_propres_pannes(self):
        # Même site : chaque informaticien ne voit que SES pannes
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='Panne de info_a',
                             responsable=self.info_a)
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='Panne de info_b',
                             responsable=self.info_b)
        self.authenticate(self.info_a)
        res = self.client.get(reverse('panne-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titres = [p['titre'] for p in res.data['results']]
        self.assertIn('Panne de info_a', titres)
        self.assertNotIn('Panne de info_b', titres)

    def test_informaticien_ne_voit_pas_les_autres_informaticiens(self):
        # Deux informaticiens du même site : chacun ne voit que son profil
        self.authenticate(self.info_a)
        res = self.client.get(reverse('utilisateurs-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        usernames = [u['username'] for u in res.data['results']]
        self.assertIn('info_a', usernames)
        self.assertNotIn('info_b', usernames)

    def test_admin_filtre_pannes_par_informaticien(self):
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='Panne A',
                             responsable=self.info_a)
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='Panne B',
                             responsable=self.info_b)
        self.authenticate(self.admin)
        res = self.client.get(reverse('panne-list'), {'responsable': self.info_a.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titres = [p['titre'] for p in res.data['results']]
        self.assertIn('Panne A', titres)
        self.assertNotIn('Panne B', titres)

    def test_informaticien_ne_peut_pas_filtrer_par_un_autre(self):
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='Panne A',
                             responsable=self.info_a)
        self.authenticate(self.info_b)
        res = self.client.get(reverse('panne-list'), {'responsable': self.info_a.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['results'], [])

    def test_informaticien_voit_son_site_avec_lui_seul(self):
        self.authenticate(self.info_a)
        res = self.client.get(reverse('site-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        sites = res.data['results']
        self.assertEqual(len(sites), 1)
        self.assertEqual(sites[0]['nom'], 'Site A')
        usernames = [i['username'] for i in sites[0]['informaticiens']]
        self.assertIn('info_a', usernames)
        self.assertNotIn('info_b', usernames)


class HistoriqueTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.panne = Panne.objects.create(
            site=self.site_a, service_demandeur='Secrétariat', titre='PC en panne',
            description='Ne démarre pas', responsable=self.info_a,
        )

    def test_changement_statut_creer_historique_et_date_resolution(self):
        self.authenticate(self.info_a)
        res = self.client.patch(reverse('panne-detail', args=[self.panne.pk]),
                                {'statut': Panne.Statut.RESOLU, 'commentaire': 'Réparé'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Panne.objects.get(pk=self.panne.pk).statut, Panne.Statut.RESOLU)
        self.assertIsNotNone(Panne.objects.get(pk=self.panne.pk).date_resolution)
        histo = HistoriquePanne.objects.filter(panne=self.panne).first()
        self.assertIsNotNone(histo)
        self.assertEqual(histo.ancien_statut, Panne.Statut.EN_COURS)
        self.assertEqual(histo.nouveau_statut, Panne.Statut.RESOLU)
        self.assertEqual(histo.auteur, self.info_a)
        self.assertEqual(histo.commentaire, 'Réparé')

    def test_transition_non_autorisee_est_refusee(self):
        self.panne.statut = Panne.Statut.RESOLU
        self.panne.save()
        self.authenticate(self.info_a)
        res = self.client.patch(reverse('panne-detail', args=[self.panne.pk]),
                                {'statut': Panne.Statut.ACHAT_MATERIEL})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reouverture_reset_date_resolution(self):
        self.panne.statut = Panne.Statut.RESOLU
        self.panne.date_resolution = '2026-08-17T10:00:00Z'
        self.panne.save()
        self.authenticate(self.info_a)
        res = self.client.patch(reverse('panne-detail', args=[self.panne.pk]),
                                {'statut': Panne.Statut.EN_COURS})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(Panne.objects.get(pk=self.panne.pk).date_resolution)

    def test_action_changer_statut(self):
        self.authenticate(self.info_a)
        res = self.client.post(reverse('panne-changer-statut', args=[self.panne.pk]),
                               {'statut': Panne.Statut.TRANSFERT_EXTERNE, 'commentaire': 'Confier au prestataire'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Panne.objects.get(pk=self.panne.pk).statut, Panne.Statut.TRANSFERT_EXTERNE)
        self.assertTrue(HistoriquePanne.objects.filter(panne=self.panne).exists())


class PermissionsTests(BaseAPITestCase):
    def test_utilisateurs_lecture_ouverte_ecriture_admin(self):
        # L'informaticien peut consulter la liste (limité à son site) mais pas modifier
        self.authenticate(self.info_a)
        res = self.client.get(reverse('utilisateurs-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        usernames = [u['username'] for u in res.data['results']]
        self.assertIn('info_a', usernames)
        self.assertNotIn('info_b', usernames)

        res = self.client.post(reverse('utilisateurs-list'), {
            'username': 'info_x',
            'password': 'infopass123',
            'role': 'INFORMATICIEN',
            'site': self.site_a.id,
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # L'admin voit tous les utilisateurs
        self.authenticate(self.admin)
        res = self.client.get(reverse('utilisateurs-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        usernames = [u['username'] for u in res.data['results']]
        self.assertIn('info_a', usernames)
        self.assertIn('info_b', usernames)

    def test_admin_peut_creer_utilisateur(self):
        self.authenticate(self.admin)
        res = self.client.post(reverse('utilisateurs-list'), {
            'username': 'info_c',
            'password': 'infopass123',
            'role': 'INFORMATICIEN',
            'site': self.site_b.id,
            'specialite': 'RESEAU',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='info_c')
        self.assertEqual(user.site, self.site_b)
        self.assertEqual(user.specialite, 'RESEAU')
        self.assertTrue(user.check_password('infopass123'))

    def test_creation_informaticien_sans_site_refusee(self):
        self.authenticate(self.admin)
        res = self.client.post(reverse('utilisateurs-list'), {
            'username': 'info_d',
            'password': 'infopass123',
            'role': 'INFORMATICIEN',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sites_ecriture_reservee_aux_admins(self):
        self.authenticate(self.info_a)
        res = self.client.post(reverse('site-list'), {'nom': 'Site C'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_stats_scope_par_site(self):
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A1', responsable=self.info_a)
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A2', responsable=self.info_a)
        Panne.objects.create(site=self.site_b, service_demandeur='X', titre='B1', responsable=self.info_b)
        self.authenticate(self.info_a)
        res = self.client.get(reverse('panne-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total'], 2)

    def test_stats_repartition_inclut_les_sites_sans_pannes(self):
        Site.objects.create(nom='Site Vide', ville='Test')
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A1', responsable=self.info_a)
        self.authenticate(self.admin)
        res = self.client.get(reverse('panne-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        par_site = {s['site__nom']: s['total'] for s in res.data['par_site']}
        self.assertIn('Site A', par_site)
        self.assertIn('Site B', par_site)
        self.assertIn('Site Vide', par_site)
        self.assertEqual(par_site['Site A'], 1)
        self.assertEqual(par_site['Site Vide'], 0)

    def test_stats_mes_pannes(self):
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A1', responsable=self.info_a, statut=Panne.Statut.EN_COURS)
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A2', responsable=self.info_a, statut=Panne.Statut.RESOLU)
        Panne.objects.create(site=self.site_a, service_demandeur='X', titre='A3', responsable=self.info_b, statut=Panne.Statut.EN_COURS)
        self.authenticate(self.info_a)
        res = self.client.get(reverse('panne-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['mes_total'], 2)
        self.assertEqual(res.data['mes_en_cours'], 1)
        self.assertEqual(res.data['mes_resolues'], 1)

        res = self.client.get(reverse('panne-list'), {'responsable': 'me'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titres = [p['titre'] for p in res.data['results']]
        self.assertIn('A1', titres)
        self.assertIn('A2', titres)
        self.assertNotIn('A3', titres)

    def test_creation_avec_statut_resolu_set_date_resolution(self):
        self.authenticate(self.info_a)
        res = self.client.post(reverse('panne-list'), {
            'titre': 'Panne résolue dès le départ',
            'description': 'test',
            'service_demandeur': 'Direction',
            'statut': Panne.Statut.RESOLU,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        panne = Panne.objects.get(pk=res.data['id'])
        self.assertEqual(panne.statut, Panne.Statut.RESOLU)
        self.assertIsNotNone(panne.date_resolution)
