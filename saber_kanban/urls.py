from django.contrib import admin
from django.urls import path
from core.views import CustomTokenObtainPairView  #
from rest_framework_simplejwt.views import TokenRefreshView
from django.urls import include  # certifique-se de importar isso também
from core.views import executar_integra_contador
from core.views import CustomTokenObtainPairView
from core import views  # ou apps.core
from core.views import empresas_dctfweb
from core.views import dctfweb_emitir_guias
from core.views import dctfweb_emitir_recibos
from core.views import dctfweb_emitir_declaracoes
from core.views import dctfweb_emitir_xmls
from core.views import dctfweb_consultar_guias
from core.views import dctfweb_emitir_xmls_assinados
from core.views import listar_dividas
from core.views import enviar_email_dividas
from core.views import processar_pdfs
from core.views import cadastrar_empresa
from core.views import EmpresaListView
from core.views import CustomTokenObtainPairView  # ✅ Importe sua view correta
from rest_framework_simplejwt.views import TokenRefreshView
from core.views import pgdas_emitir_recibos
from core.views import das_gerar
from core.views import empresas_contabil


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),  
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('core.urls')), 
    path('api/empresas/', EmpresaListView.as_view(), name='listar_empresas'),
    path('api/empresas/adicionar/', views.adicionar_empresa, name='adicionar_empresa'),
    path('api/empresas/<str:cnpj>/', views.deletar_empresa, name='deletar_empresa'),
    path('api/empresas-dctfweb/', empresas_dctfweb, name='empresas_dctfweb'),
    path('api/dctfweb/', dctfweb_emitir_guias),  
    path('api/dctfweb/recibos/', dctfweb_emitir_recibos),
    path('api/dctfweb/declaracoes/', dctfweb_emitir_declaracoes),
    path('api/dctfweb/xmls/', dctfweb_emitir_xmls),
    path('api/dctfweb/guias-em-andamento/', dctfweb_consultar_guias),
    path('api/dctfweb/xmls-assinados/', dctfweb_emitir_xmls_assinados, name='baixar_xmls_assinados'),
    path('api/dividas/', listar_dividas, name='listar_dividas'),
    path('api/enviar-email-dividas/', enviar_email_dividas, name='enviar_email_dividas'),
    path('api/processar-pdfs/',processar_pdfs, name='processar_pdfs'),
    path('api/atualizar-status-postado/', views.atualizar_status_postado, name='atualizar_status_postado'),
    path('api/cadastrar-empresa/',cadastrar_empresa, name='cadastrar_empresa'),
    path('api/empresas-das/', views.empresas_das, name='empresas_das'),
    path('api/enviar-email-nf/', views.enviar_email_nf, name='enviar_email_nf'),
    path('api/pgdas/recibos/', pgdas_emitir_recibos, name='pgdas_emitir_recibos'),
    path('api/das/gerar/', das_gerar, name='das_gerar'),
    path('api/empresas-contabil/', empresas_contabil, name='empresas_contabil'),   
    path('api/detalhes-empresa/<str:numero_dominio>/', views.detalhes_empresa, name='detalhes_empresa'),
    
]
# 




