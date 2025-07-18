from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import QuadroViewSet
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import QuadroViewSet, TarefaViewSet
from .views import executar_integra_contador


router = DefaultRouter()
router.register(r'quadros', QuadroViewSet)
router.register(r'tarefas', TarefaViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('executar-integra/', executar_integra_contador, name='executar_integra'),

]
