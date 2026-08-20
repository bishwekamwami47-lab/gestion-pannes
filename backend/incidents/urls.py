from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import SiteViewSet, PanneViewSet, HistoriquePanneViewSet, UserProfileView, UserViewSet
from .serializers import CustomTokenObtainPairSerializer

router = DefaultRouter()
router.register(r'sites', SiteViewSet)
router.register(r'pannes', PanneViewSet, basename='panne')
router.register(r'historique', HistoriquePanneViewSet, basename='historique')
router.register(r'utilisateurs', UserViewSet, basename='utilisateurs')

urlpatterns = [
    # Authentification JWT
    path('auth/login/', TokenObtainPairView.as_view(serializer_class=CustomTokenObtainPairSerializer), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', UserProfileView.as_view({'get': 'me'}), name='user_me'),

    # Endpoints de l'API REST
    path('', include(router.urls)),
]
