# Django imports
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import base64
import json
import os
import tempfile
import zipfile
import re
import pandas as pd
from io import BytesIO
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from sqlalchemy import create_engine, text
from requests_pkcs12 import post
import pycurl
from PyPDF2 import PdfReader
from datetime import datetime
import urllib.parse
import pymysql
import traceback
import ssl
import cryptography
from cryptography.hazmat.primitives.serialization import pkcs12
from urllib.parse import quote_plus
# Django REST Framework
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets
from rest_framework_simplejwt.views import TokenObtainPairView

# App imports
from .models import Quadro, Tarefa
from .serializers import QuadroSerializer, TarefaSerializer, CustomTokenObtainPairSerializer

# Python standard libs
import os
import json
import base64
import tempfile
import zipfile
import shutil
import time
import re
import smtplib
import traceback
from datetime import datetime
from io import BytesIO
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

# External packages
import pandas as pd
from decouple import config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from requests_pkcs12 import post
import pycurl
import PyPDF2
from rest_framework_simplejwt.authentication import JWTAuthentication  # ✅ CERTO

# Local config
from config_local import pasta_pdfs, pasta_lidos


from dotenv import load_dotenv
import os

load_dotenv()  # Carrega as variáveis do .env

senha = os.getenv("SENHA_CERTIFICADO")


# CLASSES DE VIEWSETS E AUTENTICAÇÃO
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication

class QuadroViewSet(viewsets.ModelViewSet):
    queryset = Quadro.objects.all()
    serializer_class = QuadroSerializer
    permission_classes = [IsAuthenticated]

class TarefaViewSet(viewsets.ModelViewSet):
    queryset = Tarefa.objects.all()
    serializer_class = TarefaSerializer

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from decouple import config
from sqlalchemy import create_engine
import pandas as pd

class EmpresaListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            engine = create_engine(config('DATABASE_URL'))
            df = pd.read_sql("SELECT razaosocial, cnpj FROM empresas", con=engine)
            return Response(df.to_dict(orient='records'))
        except Exception as e:
            return Response({'erro': str(e)}, status=500)




@csrf_exempt
def executar_integra_contador(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        cnpjs = json.loads(request.POST.get('cnpjs', '[]'))

        if not cnpjs:
            return JsonResponse({'mensagem': 'Nenhuma empresa selecionada'}, status=400)

        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        def autenticar(ck, cs, cert, pw):
            headers = {
                "Authorization": "Basic " + converter_base64(ck + ":" + cs),
                "role-type": "TERCEIROS",
                "content-type": "application/x-www-form-urlencoded"
            }
            body = {'grant_type': 'client_credentials'}
            return post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body,
                headers=headers,
                verify=True,
                pkcs12_filename=cert,
                pkcs12_password=pw
            )

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não está definido nas variáveis de ambiente'}, status=500)

        # Cria um arquivo temporário com o conteúdo do .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            # Faz a autenticação com o arquivo temporário
            response = autenticar(
                "QQzNZnYfhaMRRxJELAtHEd6CNXwa",
                "8DfDDQYme4MfWpKYy1E4EgmSzkMa",
                temp_cert_path,
                senha
            )
        finally:
            # Apaga o certificado temporário após uso
            os.remove(temp_cert_path)

        if response.status_code != 200:
            return JsonResponse({'mensagem': f'Falha na autenticação Serpro: {response.status_code}'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        engine = create_engine(config('DATABASE_URL'))  
        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM empresas WHERE cnpj IN ({cnpjs_str})"
        df_empresas = pd.read_sql(query, con=engine)
        dados_empresas = df_empresas.to_dict(orient='records')

        falhas = []

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'relatorios.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for empresa in dados_empresas:
                    cnpj = empresa['cnpj']
                    razao = empresa['razaosocial'].replace(' ', '_').replace('/', '_')

                    try:
                        dados_pedido = {
                            "contratante": {"numero": "90878448000103", "tipo": 2},
                            "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                            "contribuinte": {"numero": cnpj, "tipo": 2},
                            "pedidoDados": {
                                "idSistema": "SITFIS",
                                "idServico": "SOLICITARPROTOCOLO91",
                                "versaoSistema": "2.0",
                                "dados": ""
                            }
                        }

                        headers = [
                            'jwt_token:' + jwt_token,
                            'Authorization: Bearer ' + token,
                            'Content-Type: application/json',
                            'Accept: text/plain'
                        ]

                        post_data = json.dumps(dados_pedido)
                        buffer = BytesIO()

                        c = pycurl.Curl()
                        c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Apoiar')
                        c.setopt(c.POSTFIELDS, post_data)
                        c.setopt(c.HTTPHEADER, headers)
                        c.setopt(c.WRITEDATA, buffer)
                        c.perform()
                        c.close()

                        resposta = json.loads(buffer.getvalue().decode())
                        dados_str = resposta.get('dados')

                        if not dados_str:
                            raise Exception("Resposta da API vazia (protocolo)")

                        dados = json.loads(dados_str)
                        protocolo = dados['protocoloRelatorio']
                        time.sleep(dados['tempoEspera'] / 1000)

                        dados_emitir = {
                            "contratante": {"numero": "90878448000103", "tipo": 2},
                            "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                            "contribuinte": {"numero": cnpj, "tipo": 2},
                            "pedidoDados": {
                                "idSistema": "SITFIS",
                                "idServico": "RELATORIOSITFIS92",
                                "versaoSistema": "2.0",
                                "dados": json.dumps({"protocoloRelatorio": protocolo})
                            }
                        }

                        buffer = BytesIO()
                        c = pycurl.Curl()
                        c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir')
                        c.setopt(c.POSTFIELDS, json.dumps(dados_emitir))
                        c.setopt(c.HTTPHEADER, headers)
                        c.setopt(c.WRITEDATA, buffer)
                        c.perform()
                        c.close()

                        resposta_emitir = json.loads(buffer.getvalue().decode())
                        dados_emitir_str = resposta_emitir.get('dados')

                        if not dados_emitir_str:
                            raise Exception("Resposta da API vazia (emitir)")

                        dadosEmitir = json.loads(dados_emitir_str)
                        pdf_base64 = dadosEmitir['pdf']
                        pdf_bin = base64.b64decode(pdf_base64)

                        pdf_filename = f"{razao}_{cnpj}.pdf"
                        pdf_path = os.path.join(temp_dir, pdf_filename)
                        with open(pdf_path, 'wb') as f:
                            f.write(pdf_bin)

                        zipf.write(pdf_path, arcname=pdf_filename)

                    except Exception as e:
                        erro_str = f"{cnpj} - {empresa['razaosocial']}: {str(e)}"
                        print("❌", erro_str)
                        traceback.print_exc()
                        falhas.append(erro_str)

                if falhas:
                    falhas_txt = os.path.join(temp_dir, 'falhas.txt')
                    with open(falhas_txt, 'w', encoding='utf-8') as f:
                        f.write("CNPJs com erro na execução:\n\n")
                        f.write('\n'.join(falhas))
                    zipf.write(falhas_txt, arcname='falhas.txt')
            with open(zip_path, 'rb') as f:
                zip_bytes = f.read()

            # Junta o zip e a lista de falhas em uma resposta JSON + arquivo
            response = HttpResponse(zip_bytes, content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="relatorios.zip"'
            response['X-Falhas'] = json.dumps(falhas[:50])  # retorna no header até 50 falhas
            return response

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'mensagem': f'Erro: {str(e)}'}, status=500)


# DELETAR UM CNPJ

@csrf_exempt
@require_http_methods(["DELETE"])
def deletar_empresa(request, cnpj):
    try:
        engine = create_engine(config('DATABASE_URL'))
        with engine.begin() as connection:
            result = connection.execute(text("""
                DELETE FROM empresas
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = :cnpj
            """), {"cnpj": cnpj})

        if result.rowcount == 0:
            return JsonResponse({'mensagem': f'Nenhuma empresa com CNPJ {cnpj} foi encontrada.'}, status=404)

        return JsonResponse({'mensagem': f'CNPJ {cnpj} deletado com sucesso.'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=500)


# CRIAR UMA NOVA EMPRESA


from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["POST"])
def adicionar_empresa(request):
    try:
        data = json.loads(request.body)
        razao = data.get("razaosocial")
        cnpj = data.get("cnpj")

        if not razao or not cnpj:
            return JsonResponse({"erro": "Razão social e CNPJ são obrigatórios"}, status=400)

        engine = create_engine(config('DATABASE_URL'))
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO empresas (razaosocial, cnpj) VALUES (:razao, :cnpj)"), {
                "razao": razao,
                "cnpj": cnpj
            })

        return JsonResponse({"mensagem": "Empresa adicionada com sucesso"})
    except Exception as e:
        return JsonResponse({"erro": str(e)}, status=500)

# -----------------------------
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from sqlalchemy import create_engine
import pandas as pd
import base64, json, os, time, zipfile, tempfile, pycurl
from io import BytesIO
from requests_pkcs12 import post

# --------------------------
# 1. VIEW: LISTAR EMPRESAS POR COMPETÊNCIA
# --------------------------
from datetime import datetime
import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from sqlalchemy import create_engine
from decouple import config

@csrf_exempt
def empresas_dctfweb(request):
    if request.method != 'GET':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        engine = create_engine(config('DATABASE_URL'))

        query = """
            SELECT cod, razaosocial, operador, situacao, pagamento, data_vencimento, valor, cnpj, data_geracao, postado    
            FROM departamento_pessoal
        """
        df = pd.read_sql(query, con=engine)

        # Garantir CNPJ com 14 dígitos
        df['cnpj'] = df['cnpj'].apply(lambda x: str(int(float(x))).zfill(14))

        # Tratar valores nulos
        df['situacao'] = df['situacao'].fillna('Não gerado')
        df['pagamento'] = df['pagamento'].fillna('')
        df['data_vencimento'] = df['data_vencimento'].fillna('')
        df['valor'] = df['valor'].fillna('R$ 0,00')
        df['data_geracao'] = df['data_geracao'].fillna('')
        df['postado'] = df['postado'].fillna('Não postado')

        # Obter mês e ano atuais
        hoje = datetime.today()
        mes_atual = hoje.month
        ano_atual = hoje.year

        # Converter data_vencimento para datetime (quando possível)
        df['data_vencimento'] = pd.to_datetime(df['data_vencimento'], errors='coerce')

        # Criar uma máscara de datas no mês atual
        vencimentos_mes_atual = (df['data_vencimento'].dt.month == mes_atual) & \
                                (df['data_vencimento'].dt.year == ano_atual)

        # Para linhas que NÃO são do mês atual, sobrescrever colunas
        df.loc[~vencimentos_mes_atual, ['pagamento', 'data_vencimento', 'valor']] = ['Não gerado', 'Não gerado', 'Não gerado']

        # Converter data_vencimento de volta para string (ou manter como está se for serializável)
        df['data_vencimento'] = df['data_vencimento'].astype(str)

        return JsonResponse(df.to_dict(orient='records'), safe=False)

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao buscar empresas: {str(e)}'}, status=500)




# --------------------------
# 2. VIEW: GERAR GUIAS DCTFWEB
# --------------------------
import base64
import json
import os
import tempfile
import zipfile
import re
import pandas as pd
from io import BytesIO
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from sqlalchemy import create_engine
from requests_pkcs12 import post
import pycurl
#ESTE É O CERTO
# --------------------------
# 2. VIEW: GERAR GUIAS DCTFWEB
# --------------------------
import base64
import json
import os
import tempfile
import zipfile
import re
import pandas as pd
from io import BytesIO
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from sqlalchemy import create_engine
from requests_pkcs12 import post
import pycurl
from PyPDF2 import PdfReader
from datetime import datetime
import urllib.parse
import pymysql
import traceback
import ssl
import cryptography
from cryptography.hazmat.primitives.serialization import pkcs12
from urllib.parse import quote_plus
import os
from dotenv import load_dotenv
# Configurações de Credenciais
SERPRO_CONSUMER_KEY = "QQzNZnYfhaMRRxJELAtHEd6CNXwa"
SERPRO_CONSUMER_SECRET = "8DfDDQYme4MfWpKYy1E4EgmSzkMa"

# Use as variáveis de ambiente para certificado e senha
CERTIFICADO_BASE64 = os.getenv('CERTIFICADO_BASE64', '')
CERTIFICADO_SENHA = os.getenv('SENHA_CERTIFICADO', '')
from urllib.parse import quote_plus

# Configurações de Banco de Dados
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = quote_plus(os.getenv('DB_PASSWORD', ''))
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_NAME = os.getenv('DB_NAME', 'Comece')

# Função auxiliar para carregar o certificado
def carregar_certificado(certificado_base64, senha):
    try:
        # Decodificar o certificado base64
        certificado_bytes = base64.b64decode(certificado_base64)
        
        # Tentar carregar o certificado
        private_key, cert, ca_certs = pkcs12.load_key_and_certificates(
            certificado_bytes, 
            senha.encode('utf-8') if senha else None
        )
        
        # Criar arquivo temporário para o certificado
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(certificado_bytes)
            temp_cert_path = temp_cert_file.name
        
        return temp_cert_path
    except Exception as e:
        print(f"Erro ao carregar certificado: {e}")
        traceback.print_exc()
        return None

def extrair_informacoes_pdf(pdf_bytes):
    try:
        print("Extraindo informações do PDF...")
        
        # Ler o PDF
        pdf_stream = BytesIO(pdf_bytes)
        pdf_reader = PdfReader(pdf_stream)
        
        # Extrair texto
        texto_completo = ""
        for pagina in pdf_reader.pages:
            texto_completo += pagina.extract_text()
         #   
        # Buscar data de pagamento usando expressões regulares
        data_pagamento = None
        padrao_data = r"Pagar este documento até\s*(\d{2}/\d{2}/\d{4})"
        match_data = re.search(padrao_data, texto_completo)
        if match_data:
            data_pagamento = match_data.group(1)
            
        # Buscar valor total do documento
        valor_documento = None
        padrao_valor = r"Valor Total do Documento\s*([0-9.,]+)"
        match_valor = re.search(padrao_valor, texto_completo)
        if match_valor:
            valor_documento = match_valor.group(1)
            
        # Se não encontrar com o padrão acima, tenta outro formato
        if not valor_documento:
            padrao_valor_alt = r"(\d{1,3}(?:\.\d{3})*,\d{2})\s*$"
            linhas = texto_completo.split("\n")
            for linha_texto in linhas:
                if "Valor Total do Documento" in linha_texto:
                    match_valor_alt = re.search(padrao_valor_alt, linha_texto)
                    if match_valor_alt:
                        valor_documento = match_valor_alt.group(1)
                        break
        
        print(f"Dados extraídos:")
        print(f"- Data de pagamento: {data_pagamento or 'Não encontrada'}")
        print(f"- Valor total: {valor_documento or 'Não encontrado'}")
        
        return {
            'data_pagamento': data_pagamento,
            'valor_documento': valor_documento
        }
    except Exception as e:
        print(f"Erro ao extrair informações do PDF: {str(e)}")
        traceback.print_exc()
        return None

def converter_data(data_str):
    if data_str:
        try:
            data_obj = datetime.strptime(data_str, '%d/%m/%Y')
            return data_obj.strftime('%Y-%m-%d')
        except ValueError:
            return None
    return None

def formatar_valor(valor_str):
    if valor_str:
        try:
            valor_limpo = valor_str.replace('.', '').replace(',', '.')
            return float(valor_limpo)
        except ValueError:
            return None
    return None
# --------------------------
# 2. VIEW: GERAR GUIAS DCTFWEB
# --------------------------


# Configurações de Credenciais


# Função auxiliar para carregar o certificado
def carregar_certificado(certificado_base64, senha):
    try:
        # Decodificar o certificado base64
        certificado_bytes = base64.b64decode(certificado_base64)
        
        # Tentar carregar o certificado
        private_key, cert, ca_certs = pkcs12.load_key_and_certificates(
            certificado_bytes, 
            senha.encode('utf-8') if senha else None
        )
        
        # Criar arquivo temporário para o certificado
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(certificado_bytes)
            temp_cert_path = temp_cert_file.name
        
        return temp_cert_path
    except Exception as e:
        print(f"Erro ao carregar certificado: {e}")
        traceback.print_exc()
        return None

def extrair_informacoes_pdf(pdf_bytes):
    try:
        print("Extraindo informações do PDF...")
        
        # Ler o PDF
        pdf_stream = BytesIO(pdf_bytes)
        pdf_reader = PdfReader(pdf_stream)
        
        # Extrair texto
        texto_completo = ""
        for pagina in pdf_reader.pages:
            texto_completo += pagina.extract_text()
            
        # Buscar data de pagamento usando expressões regulares
        data_pagamento = None
        padrao_data = r"Pagar este documento até\s*(\d{2}/\d{2}/\d{4})"
        match_data = re.search(padrao_data, texto_completo)
        if match_data:
            data_pagamento = match_data.group(1)
            
        # Buscar valor total do documento
        valor_documento = None
        padrao_valor = r"Valor Total do Documento\s*([0-9.,]+)"
        match_valor = re.search(padrao_valor, texto_completo)
        if match_valor:
            valor_documento = match_valor.group(1)
            
        # Se não encontrar com o padrão acima, tenta outro formato
        if not valor_documento:
            padrao_valor_alt = r"(\d{1,3}(?:\.\d{3})*,\d{2})\s*$"
            linhas = texto_completo.split("\n")
            for linha_texto in linhas:
                if "Valor Total do Documento" in linha_texto:
                    match_valor_alt = re.search(padrao_valor_alt, linha_texto)
                    if match_valor_alt:
                        valor_documento = match_valor_alt.group(1)
                        break
        
        print(f"Dados extraídos:")
        print(f"- Data de pagamento: {data_pagamento or 'Não encontrada'}")
        print(f"- Valor total: {valor_documento or 'Não encontrado'}")
        
        return {
            'data_pagamento': data_pagamento,
            'valor_documento': valor_documento
        }
    except Exception as e:
        print(f"Erro ao extrair informações do PDF: {str(e)}")
        traceback.print_exc()
        return None

def converter_data(data_str):
    if data_str:
        try:
            data_obj = datetime.strptime(data_str, '%d/%m/%Y')
            return data_obj.strftime('%Y-%m-%d')
        except ValueError:
            return None
    return None

def formatar_valor(valor_str):
    if valor_str:
        try:
            valor_limpo = valor_str.replace('.', '').replace(',', '.')
            return float(valor_limpo)
        except ValueError:
            return None
    return None

@csrf_exempt
def dctfweb_emitir_guias(request):
    temp_cert_path = None
    try:
        # Log inicial para rastrear o início do processamento
        print("Iniciando processamento de emissão de guias DCTFWEB")

        # Captura detalhada do corpo da requisição
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError as json_err:
            print(f"Erro ao decodificar JSON: {json_err}")
            return JsonResponse({
                'mensagem': 'Corpo da requisição inválido',
                'erro_detalhado': str(json_err)
            }, status=400)

        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')  # Ex: "04/2025"

        # Validações iniciais
        if not cnpjs:
            print("Nenhum CNPJ fornecido")
            return JsonResponse({'mensagem': 'Informe pelo menos um CNPJ'}, status=400)

        if not competencia:
            print("Competência não informada")
            return JsonResponse({'mensagem': 'Informe a competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            print(f"Formato de competência inválido: {competencia}")
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)

        # Log de configurações
        print(f"Processando CNPJs: {cnpjs}")
        print(f"Competência: {mes}/{ano}")

        # Carregar certificado
        temp_cert_path = carregar_certificado(CERTIFICADO_BASE64, CERTIFICADO_SENHA)
        if not temp_cert_path:
            return JsonResponse({
                'mensagem': 'Falha ao processar certificado',
            }, status=500)

        # Configurações de autenticação
        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64(f"{SERPRO_CONSUMER_KEY}:{SERPRO_CONSUMER_SECRET}"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }
        body_auth = {'grant_type': 'client_credentials'}

        try:
            # Autenticação SERPRO
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=CERTIFICADO_SENHA
            )
        except Exception as auth_err:
            print(f"Erro durante autenticação: {auth_err}")
            traceback.print_exc()
            return JsonResponse({
                'mensagem': 'Falha na autenticação',
                'erro_detalhado': str(auth_err)
            }, status=500)
        finally:
            # Sempre remover o arquivo temporário, se existir
            if temp_cert_path and os.path.exists(temp_cert_path):
                os.remove(temp_cert_path)

        if response.status_code != 200:
            print(f"Falha na autenticação SERPRO: {response.content}")
            return JsonResponse({'mensagem': 'Falha na autenticação com a SERPRO'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        # Configuração de conexão do banco de dados com tratamento de erros
        try:
            # Usar a URL completa do .env
            engine = create_engine(config('DATABASE_URL'))
            
            # Testar conexão
            with engine.connect() as connection:
                print("Conexão bem-sucedida!")
                
        except Exception as e:
            print(f"Erro de conexão: {e}")
            raise

        # Obter lista de empresas
        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM departamento_pessoal WHERE cnpj IN ({cnpjs_str})"
        
        try:
            df = pd.read_sql(query, con=engine)
            empresas = df.to_dict(orient='records')
        except Exception as query_err:
            print(f"Erro ao executar consulta de empresas: {query_err}")
            return JsonResponse({
                'mensagem': 'Falha ao consultar empresas',
                'erro_detalhado': str(query_err)
            }, status=500)

        # Processamento de guias
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'dctfweb_guias.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
                    try:
                        cnpj_original = emp['cnpj']
                        cnpj = re.sub(r'\D', '', cnpj_original)  # Limpar pontuação
                        razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                        dados_pedido = {
                            "contratante": {"numero": "90878448000103", "tipo": 2},
                            "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                            "contribuinte": {"numero": cnpj, "tipo": 2},
                            "pedidoDados": {
                                "idSistema": "DCTFWEB",
                                "idServico": "GERARGUIA31",
                                "versaoSistema": "1.0",
                                "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                            }
                        }

                        headers = [
                            'jwt_token:' + jwt_token,
                            'Authorization: Bearer ' + token,
                            'Content-Type: application/json',
                            'Accept: text/plain'
                        ]

                        buffer = BytesIO()
                        c = pycurl.Curl()
                        c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir')
                        c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                        c.setopt(c.HTTPHEADER, headers)
                        c.setopt(c.WRITEDATA, buffer)
                        c.perform()
                        c.close()

                        resposta_json = json.loads(buffer.getvalue().decode())

                        # Processamento de mensagens da API
                        mensagens = resposta_json.get('mensagens', [])
                        if mensagens:
                            print(f"Mensagens para {cnpj_original}:")
                            for msg in mensagens:
                                print(f"  - [{msg.get('codigo')}] {msg.get('texto')}")

                        dados = json.loads(resposta_json.get('dados', '{}'))
                        pdf_base64 = dados.get('PDFByteArrayBase64')

                        if not pdf_base64:
                            print(f"Nenhum PDF encontrado para {cnpj_original}")
                            continue

                        pdf_bin = base64.b64decode(pdf_base64)
                        data_geracao = datetime.today().strftime('%Y-%m-%d')  # Ajuste o formato se necessário

                        # Extrair informações do PDF
                        dados_pdf = extrair_informacoes_pdf(pdf_bin)
                        if dados_pdf:
                            # Preparar dados para inserção/atualização
                            data_vencimento = converter_data(dados_pdf['data_pagamento'])
                            valor = formatar_valor(dados_pdf['valor_documento'])
                            situacao = "GERADO"
                            pagamento = "LANÇADO"
                            
                            try:
                                with engine.connect() as conn:
                                    # Verificar se já existe registro
                                    select_query = text("SELECT * FROM departamento_pessoal WHERE cnpj = :cnpj")
                                    resultado = conn.execute(select_query, {'cnpj': cnpj_original})
                                    
                                    if resultado.rowcount > 0:
                                        # Atualizar registro existente
                                        update_query = text("""
                                        UPDATE departamento_pessoal 
                                        SET data_vencimento = :data_vencimento, 
                                            situacao = :situacao, 
                                            valor = :valor, 
                                            pagamento = :pagamento
                                        WHERE cnpj = :cnpj
                                        """)
                                        
                                        conn.execute(update_query, {
                                            'data_vencimento': data_vencimento,
                                            'situacao': situacao,
                                            'valor': valor,
                                            'pagamento': pagamento,
                                            'cnpj': cnpj_original
                                        })
                                        print(f"Registro atualizado para {cnpj_original}")
                                    else:
                                        # Inserir novo registro
                                        insert_query = text("""
                                        INSERT INTO departamento_pessoal 
                                        (razaosocial, cnpj, data_vencimento, situacao, valor, pagamento)
                                        VALUES 
                                        (:razaosocial, :cnpj, :data_vencimento, :situacao, :valor, :pagamento)
                                        """)
                                        
                                        conn.execute(insert_query, {
                                            'razaosocial': razao.replace('_', ' '),
                                            'cnpj': cnpj_original,
                                            'data_vencimento': data_vencimento,
                                            'situacao': situacao,
                                            'valor': valor,
                                            'pagamento': pagamento
                                        })
                                        print(f"Novo registro inserido para {cnpj_original}")
                                    
                                    # Commit da transação
                                    conn.commit()
                            except Exception as db_insert_err:
                                print(f"Erro ao salvar dados no banco para {cnpj_original}: {db_insert_err}")
                                traceback.print_exc()

                        # Salvar PDF
                        nome_arquivo = f"{razao}_{cnpj}.pdf"
                        caminho_pdf = os.path.join(temp_dir, nome_arquivo)

                        with open(caminho_pdf, 'wb') as f:
                            f.write(pdf_bin)

                        zipf.write(caminho_pdf, arcname=nome_arquivo)

                    except Exception as erro_processamento:
                        print(f"Erro no processamento de {cnpj_original}: {erro_processamento}")
                        traceback.print_exc()
                        continue

            # Retornar arquivo ZIP
            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="dctfweb_guias.zip"'
                return response

    except Exception as erro_geral:
        # Log de erro detalhado
        print("Erro crítico no processamento:")
        print(traceback.format_exc())
        
        # Remover arquivo temporário, se existir
        if temp_cert_path and os.path.exists(temp_cert_path):
            os.remove(temp_cert_path)
        
        return JsonResponse({
            'mensagem': 'Erro interno no processamento',
            'erro_detalhado': str(erro_geral)
        }, status=500)
@csrf_exempt
def atualizar_status_postado(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)
    
    try:
        body = json.loads(request.body)
        cnpj = body.get('cnpj')
        postado = body.get('postado')

        if not cnpj or postado is None:
            return JsonResponse({'mensagem': 'CNPJ e status de postado são obrigatórios'}, status=400)

        # Conectar ao banco de dados
        engine = create_engine(f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:3306/{DB_NAME}")
        
        with engine.connect() as conn:
            # Atualizar o status de postado para o CNPJ específico
            update_query = text("""
            UPDATE departamento_pessoal 
            SET postado = :postado
            WHERE cnpj = :cnpj
            """)
            
            result = conn.execute(update_query, {
                'postado': 'Sim' if postado else 'Não',
                'cnpj': cnpj
            })
            
            # Commit da transação
            conn.commit()

            if result.rowcount > 0:
                return JsonResponse({
                    'mensagem': 'Status atualizado com sucesso',
                    'postado': 'Sim' if postado else 'Não'
                })
            else:
                return JsonResponse({
                    'mensagem': 'Nenhum registro encontrado para atualização',
                    'status': 404
                }, status=404)

    except Exception as e:
        print(f"Erro ao atualizar status postado: {str(e)}")
        return JsonResponse({
            'mensagem': 'Erro interno ao atualizar status',
            'erro_detalhado': str(e)
        }, status=500)
@csrf_exempt
def cadastrar_empresa(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)
    
    try:
        body = json.loads(request.body)
        cod = body.get('cod')
        razaosocial = body.get('razaosocial')
        operador = body.get('operador')
        cnpj = body.get('cnpj')
        
        # Validação básica
        if not cod or not razaosocial or not cnpj:
            return JsonResponse({'mensagem': 'Código, Razão Social e CNPJ são obrigatórios'}, status=400)
        
        # Garantir que o CNPJ tenha apenas números
        cnpj_limpo = re.sub(r'\D', '', cnpj)
        if len(cnpj_limpo) != 14:
            return JsonResponse({'mensagem': 'CNPJ deve conter 14 dígitos'}, status=400)
        
        # NÃO formatar o CNPJ, usar apenas os números
        # Remova ou comente esta linha:
        # cnpj_formatado = f"{cnpj_limpo[:2]}.{cnpj_limpo[2:5]}.{cnpj_limpo[5:8]}/{cnpj_limpo[8:12]}-{cnpj_limpo[12:]}"
        
        # Conectar ao banco de dados
        engine = create_engine(f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:3306/{DB_NAME}")
        
        with engine.connect() as conn:
            # Verificar se o CNPJ já existe
            select_query = text("SELECT cnpj FROM departamento_pessoal WHERE cnpj = :cnpj")
            result = conn.execute(select_query, {'cnpj': cnpj_limpo})
            
            if result.fetchone():
                return JsonResponse({'mensagem': 'Empresa com este CNPJ já existe'}, status=400)
            
            # Inserir nova empresa
            insert_query = text("""
            INSERT INTO departamento_pessoal (cod, razaosocial, operador, cnpj)
            VALUES (:cod, :razaosocial, :operador, :cnpj)
            """)
            
            conn.execute(insert_query, {
                'cod': cod,
                'razaosocial': razaosocial,
                'operador': operador or None,  # Permite valor nulo
                'cnpj': cnpj_limpo  # Usar apenas os números do CNPJ
            })
            
            # Commit da transação
            conn.commit()
            
            return JsonResponse({
                'mensagem': 'Empresa cadastrada com sucesso',
                'empresa': {
                    'cod': cod,
                    'razaosocial': razaosocial,
                    'operador': operador,
                    'cnpj': cnpj_limpo  # Retornar o CNPJ sem formatação
                }
            })
            
    except Exception as e:
        print(f"Erro ao cadastrar empresa: {str(e)}")
        return JsonResponse({
            'mensagem': 'Erro interno ao cadastrar empresa',
            'erro_detalhado': str(e)
        }, status=500)
#GERAR RECIBO DE TRANSMISSÃO
# 3. VIEW: GERAR RECIBOS DCTFWEB
@csrf_exempt
def dctfweb_emitir_recibos(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')

        if not cnpjs or not competencia:
            return JsonResponse({'mensagem': 'Informe CNPJs e competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)


        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64("QQzNZnYfhaMRRxJELAtHEd6CNXwa:8DfDDQYme4MfWpKYy1E4EgmSzkMa"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }
        body_auth = {'grant_type': 'client_credentials'}

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Cria arquivo temporário .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=senha
            )
        finally:
            # Apaga o .pfx temporário após a requisição
            os.remove(temp_cert_path)


        if response.status_code != 200:
            return JsonResponse({'mensagem': 'Falha na autenticação com a SERPRO'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        engine = create_engine(config('DATABASE_URL'))

        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM departamento_pessoal WHERE cnpj IN ({cnpjs_str})"
        df = pd.read_sql(query, con=engine)
        empresas = df.to_dict(orient='records')

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'dctfweb_recibos.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
                    cnpj = emp['cnpj']
                    razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                    dados_pedido = {
                        "contratante": {"numero": "90878448000103", "tipo": 2},
                        "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                        "contribuinte": {"numero": cnpj, "tipo": 2},
                        "pedidoDados": {
                            "idSistema": "DCTFWEB",
                            "idServico": "CONSRECIBO32",
                            "versaoSistema": "1.0",
                            "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                        }
                    }

                    headers = [
                        'jwt_token:' + jwt_token,
                        'Authorization: Bearer ' + token,
                        'Content-Type: application/json',
                        'Accept: text/plain'
                    ]

                    buffer = BytesIO()
                    c = pycurl.Curl()
                    c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar')
                    c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                    c.setopt(c.HTTPHEADER, headers)
                    c.setopt(c.WRITEDATA, buffer)
                    c.perform()
                    c.close()

                    resposta = json.loads(buffer.getvalue().decode())
                    dados = json.loads(resposta.get('dados', '{}'))
                    pdf_base64 = dados.get('PDFByteArrayBase64')

                    if not pdf_base64:
                        continue

                    pdf_bin = base64.b64decode(pdf_base64)
                    nome_arquivo = f"recibo_{razao}_{cnpj}.pdf"
                    caminho_pdf = os.path.join(temp_dir, nome_arquivo)

                    with open(caminho_pdf, 'wb') as f:
                        f.write(pdf_bin)

                    zipf.write(caminho_pdf, arcname=nome_arquivo)

            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="dctfweb_recibos.zip"'
                return response

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao gerar recibos: {str(e)}'}, status=500)


# BAIXAR DECLARAÇÃO COMPLETA
# 4. VIEW: GERAR DECLARAÇÕES DCTFWEB
@csrf_exempt
def dctfweb_emitir_declaracoes(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')

        if not cnpjs or not competencia:
            return JsonResponse({'mensagem': 'Informe CNPJs e competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)



        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64("QQzNZnYfhaMRRxJELAtHEd6CNXwa:8DfDDQYme4MfWpKYy1E4EgmSzkMa"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }
        body_auth = {'grant_type': 'client_credentials'}

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Cria arquivo temporário .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=senha
            )
        finally:
            # Apaga o .pfx temporário após a requisição
            os.remove(temp_cert_path)


        if response.status_code != 200:
            return JsonResponse({'mensagem': 'Falha na autenticação com a SERPRO'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        engine = create_engine(config('DATABASE_URL'))
        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM departamento_pessoal WHERE cnpj IN ({cnpjs_str})"
        df = pd.read_sql(query, con=engine)
        empresas = df.to_dict(orient='records')

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'dctfweb_declaracoes.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
                    cnpj = emp['cnpj']
                    razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                    dados_pedido = {
                        "contratante": {"numero": "90878448000103", "tipo": 2},
                        "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                        "contribuinte": {"numero": cnpj, "tipo": 2},
                        "pedidoDados": {
                            "idSistema": "DCTFWEB",
                            "idServico": "CONSDECCOMPLETA33",
                            "versaoSistema": "1.0",
                            "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                        }
                    }

                    headers = [
                        'jwt_token:' + jwt_token,
                        'Authorization: Bearer ' + token,
                        'Content-Type: application/json',
                        'Accept: text/plain'
                    ]

                    buffer = BytesIO()
                    c = pycurl.Curl()
                    c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar')
                    c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                    c.setopt(c.HTTPHEADER, headers)
                    c.setopt(c.WRITEDATA, buffer)
                    c.perform()
                    c.close()

                    resposta = json.loads(buffer.getvalue().decode())
                    dados = json.loads(resposta.get('dados', '{}'))
                    pdf_base64 = dados.get('PDFByteArrayBase64')

                    if not pdf_base64:
                        continue

                    pdf_bin = base64.b64decode(pdf_base64)
                    nome_arquivo = f"declaracao_{razao}_{cnpj}.pdf"
                    caminho_pdf = os.path.join(temp_dir, nome_arquivo)

                    with open(caminho_pdf, 'wb') as f:
                        f.write(pdf_bin)

                    zipf.write(caminho_pdf, arcname=nome_arquivo)

            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="dctfweb_declaracoes.zip"'
                return response

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao gerar declarações: {str(e)}'}, status=500)

# BAIXAR XML
# 5. VIEW: GERAR XMLs DCTFWEB
@csrf_exempt
def dctfweb_emitir_xmls(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')

        if not cnpjs or not competencia:
            return JsonResponse({'mensagem': 'Informe CNPJs e competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)


        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64("QQzNZnYfhaMRRxJELAtHEd6CNXwa:8DfDDQYme4MfWpKYy1E4EgmSzkMa"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }
        body_auth = {'grant_type': 'client_credentials'}

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Cria arquivo temporário .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=senha
            )
        finally:
            # Apaga o .pfx temporário após a requisição
            os.remove(temp_cert_path)


        if response.status_code != 200:
            return JsonResponse({'mensagem': 'Falha na autenticação com a SERPRO'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']

        jwt_token = tokens['jwt_token']
        engine = create_engine(config('DATABASE_URL'))
        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM dctfweb WHERE cnpj IN ({cnpjs_str})"
        df = pd.read_sql(query, con=engine)
        empresas = df.to_dict(orient='records')

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'dctfweb_xmls.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
                    cnpj = emp['cnpj']
                    razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                    dados_pedido = {
                        "contratante": {"numero": "90878448000103", "tipo": 2},
                        "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                        "contribuinte": {"numero": cnpj, "tipo": 2},
                        "pedidoDados": {
                            "idSistema": "DCTFWEB",
                            "idServico": "CONSXMLDECLARACAO38",
                            "versaoSistema": "1.0",
                            "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                        }
                    }

                    headers = [
                        'jwt_token:' + jwt_token,
                        'Authorization: Bearer ' + token,
                        'Content-Type: application/json',
                        'Accept: text/plain'
                    ]

                    buffer = BytesIO()
                    c = pycurl.Curl()
                    c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar')
                    c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                    c.setopt(c.HTTPHEADER, headers)
                    c.setopt(c.WRITEDATA, buffer)
                    c.perform()
                    c.close()

                    resposta = json.loads(buffer.getvalue().decode())
                    dados = json.loads(resposta.get('dados', '{}'))
                    xml_base64 = dados.get('XMLStringBase64')

                    if not xml_base64:
                        continue

                    xml_bin = base64.b64decode(xml_base64)

                    nome_arquivo = f"xml_{razao}_{cnpj}.xml"
                    caminho_xml = os.path.join(temp_dir, nome_arquivo)

                    with open(caminho_xml, 'wb') as f:
                        f.write(xml_bin)

                    zipf.write(caminho_xml, arcname=nome_arquivo)

            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="dctfweb_xmls.zip"'
                return response

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao gerar XMLs: {str(e)}'}, status=500)

# TESTE
import os
import base64
import json
import zipfile
import tempfile
import pandas as pd
from io import BytesIO
import pycurl
from django.http import JsonResponse, HttpResponse
from sqlalchemy import create_engine
from django.views.decorators.csrf import csrf_exempt
from requests_pkcs12 import post
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.backends import default_backend
from signxml import XMLSigner, SignatureConstructionMethod
from lxml import etree

@csrf_exempt
def dctfweb_emitir_xmls_assinados(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')

        if not cnpjs or not competencia:
            return JsonResponse({'mensagem': 'Informe CNPJs e competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)

        consumer_key = "QQzNZnYfhaMRRxJELAtHEd6CNXwa"
        consumer_secret = "8DfDDQYme4MfWpKYy1E4EgmSzkMa"

        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64(f"{consumer_key}:{consumer_secret}"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }

        body_auth = {'grant_type': 'client_credentials'}
        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Cria arquivo temporário .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=senha
            )
        finally:
            # Apaga o .pfx temporário após a requisição
            os.remove(temp_cert_path)


        if response.status_code != 200:
            return JsonResponse({'mensagem': 'Erro ao autenticar com o Serpro'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        engine = create_engine(config('DATABASE_URL'))
        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM departamento_pessoal WHERE cnpj IN ({cnpjs_str})"
        df = pd.read_sql(query, con=engine)
        empresas = df.to_dict(orient='records')
        from cryptography.hazmat.primitives.serialization import pkcs12
        from cryptography.hazmat.backends import default_backend

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Decodifica o base64 para obter os bytes do .pfx
        pfx_data = base64.b64decode(certificado_base64)

        # Carrega a chave privada e o certificado
        private_key, certificate, _ = pkcs12.load_key_and_certificates(
            pfx_data,
            senha.encode(),
            backend=default_backend()
)

        def assinar_xml(xml_bytes, output_path):
            xml = etree.fromstring(xml_bytes)
            signer = XMLSigner(method=SignatureConstructionMethod.enveloped, digest_algorithm="sha256")
            signed_xml = signer.sign(xml, key=private_key, cert=[certificate])
            etree.ElementTree(signed_xml).write(output_path, pretty_print=True, xml_declaration=True, encoding="utf-8")

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zipf:
                for emp in empresas:
                    cnpj = emp['cnpj']
                    razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                    dados_pedido = {
                        "contratante": {"numero": "90878448000103", "tipo": 2},
                        "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                        "contribuinte": {"numero": cnpj, "tipo": 2},
                        "pedidoDados": {
                            "idSistema": "DCTFWEB",
                            "idServico": "CONSXMLDECLARACAO38",
                            "versaoSistema": "1.0",
                            "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                        }
                    }

                    headers = [
                        'jwt_token:' + jwt_token,
                        'Authorization: Bearer ' + token,
                        'Content-Type: application/json',
                        'Accept: application/json'
                    ]

                    buffer = BytesIO()
                    c = pycurl.Curl()
                    c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar')
                    c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                    c.setopt(c.HTTPHEADER, headers)
                    c.setopt(c.WRITEDATA, buffer)
                    c.perform()
                    c.close()

                    resposta = json.loads(buffer.getvalue().decode())
                    dados = json.loads(resposta.get('dados', '{}'))
                    xml_base64 = dados.get('XMLStringBase64')

                    if not xml_base64:
                        continue

                    xml_bytes = base64.b64decode(xml_base64)
                    xml_filename = f'{cnpj}_{razao}_assinado.xml'
                    xml_path = os.path.join(temp_dir, xml_filename)
                    assinar_xml(xml_bytes, xml_path)
                    zipf.write(xml_path, arcname=xml_filename)

            zip_buffer.seek(0)
            response = HttpResponse(zip_buffer.read(), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="dctfweb_xmls_assinados.zip"'
            return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'mensagem': 'Erro interno: ' + str(e)}, status=500)






# 6. VIEW: CONSULTAR GUIAS EM ANDAMENTO DCTFWEB
@csrf_exempt
def dctfweb_consultar_guias(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')

        if not cnpjs or not competencia:
            return JsonResponse({'mensagem': 'Informe CNPJs e competência'}, status=400)

        try:
            mes, ano = competencia.split('/')
        except ValueError:
            return JsonResponse({'mensagem': 'Competência inválida. Use o formato MM/AAAA'}, status=400)



        def converter_base64(credenciais):
            return base64.b64encode(credenciais.encode("utf8")).decode("utf8")

        headers_auth = {
            "Authorization": "Basic " + converter_base64("QQzNZnYfhaMRRxJELAtHEd6CNXwa:8DfDDQYme4MfWpKYy1E4EgmSzkMa"),
            "role-type": "TERCEIROS",
            "content-type": "application/x-www-form-urlencoded"
        }
        body_auth = {'grant_type': 'client_credentials'}

        certificado_base64 = os.getenv("CERTIFICADO_BASE64")
        if not certificado_base64:
            return JsonResponse({'mensagem': 'CERTIFICADO_BASE64 não definido'}, status=500)

        # Cria arquivo temporário .pfx
        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as temp_cert_file:
            temp_cert_file.write(base64.b64decode(certificado_base64))
            temp_cert_path = temp_cert_file.name

        try:
            response = post(
                "https://autenticacao.sapi.serpro.gov.br/authenticate",
                data=body_auth,
                headers=headers_auth,
                verify=True,
                pkcs12_filename=temp_cert_path,
                pkcs12_password=senha
            )
        finally:
            # Apaga o .pfx temporário após a requisição
            os.remove(temp_cert_path)

        if response.status_code != 200:
            return JsonResponse({'mensagem': 'Falha na autenticação com a SERPRO'}, status=500)

        tokens = json.loads(response.content.decode())
        token = tokens['access_token']
        jwt_token = tokens['jwt_token']

        engine = create_engine(config('DATABASE_URL'))

        cnpjs_str = ",".join(f"'{cnpj}'" for cnpj in cnpjs)
        query = f"SELECT cnpj, razaosocial FROM dctfweb WHERE cnpj IN ({cnpjs_str})"
        df = pd.read_sql(query, con=engine)
        empresas = df.to_dict(orient='records')

        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'guias_em_andamento.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
                    cnpj = emp['cnpj']
                    razao = emp['razaosocial'].replace(' ', '_').replace('/', '_')

                    dados_pedido = {
                        "contratante": {"numero": "90878448000103", "tipo": 2},
                        "autorPedidoDados": {"numero": "90878448000103", "tipo": 2},
                        "contribuinte": {"numero": cnpj, "tipo": 2},
                        "pedidoDados": {
                            "idSistema": "DCTFWEB",
                            "idServico": "GERARGUIAANDAMENTO313",
                            "versaoSistema": "1.0",
                            "dados": json.dumps({"categoria": 40, "anoPA": ano, "mesPA": mes})
                        }
                    }

                    headers = [
                        'jwt_token:' + jwt_token,
                        'Authorization: Bearer ' + token,
                        'Content-Type: application/json',
                        'Accept: text/plain'
                    ]

                    buffer = BytesIO()
                    c = pycurl.Curl()
                    c.setopt(c.URL, 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir')
                    c.setopt(c.POSTFIELDS, json.dumps(dados_pedido))
                    c.setopt(c.HTTPHEADER, headers)
                    c.setopt(c.WRITEDATA, buffer)
                    c.perform()
                    c.close()

                    resposta = json.loads(buffer.getvalue().decode())
                    dados = resposta.get("dados")

                    if not dados:
                        continue

                    dadosEmitir = json.loads(dados)
                    pdf_base64 = dadosEmitir.get("PDFByteArrayBase64")
                    if not pdf_base64:
                        continue

                    pdf_bin = base64.b64decode(pdf_base64)
                    nome_arquivo = f"guia_andamento_{razao}_{cnpj}.pdf"
                    caminho_pdf = os.path.join(temp_dir, nome_arquivo)

                    with open(caminho_pdf, 'wb') as f:
                        f.write(pdf_bin)

                    zipf.write(caminho_pdf, arcname=nome_arquivo)

            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="guias_em_andamento.zip"'
                return response

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao consultar guias em andamento: {str(e)}'}, status=500)

# ----------------PENDENCIAS FISCAIS----------------
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from sqlalchemy import create_engine, text
import pandas as pd

@csrf_exempt
def listar_dividas(request):
    try:
        # Crie a conexão com o bancoengine = create_engine(config('DATABASE_URL'))
        engine = create_engine(config('DATABASE_URL'))

        # Execute a consulta
        with engine.connect() as connection:
            query = text("SELECT * FROM dividas_fiscais")
            result = connection.execute(query)

            # Converta para DataFrame
            df = pd.DataFrame(result.fetchall(), columns=result.keys())

            # Converte 'data_consulta' para datetime.date antes de filtrar
            df['data_consulta'] = pd.to_datetime(df['data_consulta'], errors='coerce').dt.date
            ultima_data_consulta = df['data_consulta'].max()

            # Filtra as linhas com a última data da consulta
            dados_ultima_consulta = df[df['data_consulta'] == ultima_data_consulta].copy()

            # Lista de colunas de data
            colunas_data = [
                'data_validade', 
                'data_emissao', 
                'vencimento',
                'data_consulta',
                'data_registro',
            ]
            
            # Converte para datetime (com horário, se houver)
            for coluna in colunas_data:
                if coluna in dados_ultima_consulta.columns:
                    dados_ultima_consulta[coluna] = pd.to_datetime(dados_ultima_consulta[coluna], errors='coerce')

            # Pega a data de registro mais recente
            data_mais_recente = None
            if 'data_registro' in dados_ultima_consulta.columns:
                data_valida = dados_ultima_consulta['data_registro'].dropna()
                if not data_valida.empty:
                    data_mais_recente = data_valida.max().strftime('%d/%m/%Y')

            # Formata todas as colunas de data para string
            for coluna in colunas_data:
                if coluna in dados_ultima_consulta.columns:
                    dados_ultima_consulta[coluna] = dados_ultima_consulta[coluna].dt.strftime('%d/%m/%Y')

            # Preenche valores nulos
            dados_ultima_consulta = dados_ultima_consulta.fillna('')

            # Converte para dicionário
            data = dados_ultima_consulta.to_dict(orient='records')

            return JsonResponse({
                'success': True,
                'data_mais_recente': data_mais_recente,
                'ultima_data_consulta': ultima_data_consulta.strftime('%d/%m/%Y'),
                'dividas': data
            }, safe=False)

    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': str(e)
        }, status=500)


    


@csrf_exempt
def enviar_email_dividas(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método não permitido'}, status=405)
    
    try:
        # Obtém os dados
        data = json.loads(request.body)
        destinatario = data.get('destinatario')
        email_copia = data.get('email_copia')  # Obter o email em cópia
        assunto = data.get('assunto', 'DIVIDAS PENDENTES')
        corpo_html = data.get('corpo_html')
        
        # Validações básicas
        if not destinatario:
            return JsonResponse({'success': False, 'error': 'Destinatário é obrigatório'}, status=400)
        
        # Configurações diretas de e-mail
        remetente = 'thiago.souza@gerencialconsultoria.com.br'
        senhaemail = 'updzyurhfcphtmpe'
        import base64

        # Faça isso uma vez para gerar o código Base64 da imagem
        with open(r'C:\Users\elean\app_comece\frontend\src\assets\logoemail.png', 'rb') as f:
            img_data = f.read()
            base64_encoded = base64.b64encode(img_data).decode('utf-8')
            print(f"data:image/png;base64,{base64_encoded}")

        try:
            # Configuração do servidor SMTP
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.ehlo()
            server.starttls()
            server.login(remetente, senhaemail)
            
            # Criar a mensagem
            msg = MIMEMultipart('related')
            msg['Subject'] = assunto
            msg['From'] = remetente
            msg['To'] = destinatario
            
            # Adicionar o email em cópia se fornecido
            if email_copia:
                msg['Cc'] = email_copia
                # Importante: destinatários devem incluir tanto 'To' quanto 'Cc'
                destinatarios = [destinatario, email_copia]
            else:
                destinatarios = [destinatario]
            
            # Parte HTML
            html_part = MIMEMultipart('alternative')
            html_content = MIMEText(corpo_html, 'html')
            html_part.attach(html_content)
            msg.attach(html_part)
            
            # LOGO EMBUTIDO DIRETAMENTE - VERSÃO SIMPLES SEM ARQUIVO
            # Usar um logo embutido diretamente como string base64
            logo_raw = base64_encoded
        
            # Remova cabeçalhos/rodapés e espaços em branco            
            # Decodificar base64 para binário
            import base64
            img_data = base64.b64decode(logo_raw)
            
            # Anexar imagem
            img = MIMEImage(img_data)
            img.add_header('Content-ID', '<logo2>')
            img.add_header('Content-Disposition', 'inline', filename='logoemail.png')
            msg.attach(img)
            
            # Enviar e-mail para todos os destinatários (incluindo em cópia)
            server.sendmail(remetente, destinatarios, msg.as_string())
            server.quit()
            
            # Registrar informações
            cc_info = f" (CC: {email_copia})" if email_copia else ""
            print(f"E-mail enviado com sucesso para {destinatario}{cc_info}")
            
            return JsonResponse({
                'success': True,
                'message': f'E-mail enviado com sucesso para {destinatario}{cc_info}'
            })
            
        except Exception as smtp_error:
            print(f"Erro SMTP: {str(smtp_error)}")
            return JsonResponse({'success': False, 'error': str(smtp_error)}, status=500)
        
    except Exception as e:
        print(f"Erro geral: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
# Atualizar Dados
@csrf_exempt
def processar_pdfs(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método não permitido'}, status=405)
    
    try:

        def converter_data(data_str):
            try:
                if not data_str or not isinstance(data_str, str):
                    return None
                return datetime.strptime(data_str, '%d/%m/%Y').date()
            except Exception as e:
                print(f"Erro ao converter data '{data_str}': {e}")
                return None
        
        def extrair_informacoes_pdf(caminho_pdf):
            try:
                with open(caminho_pdf, 'rb') as arquivo:
                    leitor = PyPDF2.PdfReader(arquivo)
                    
                    # Extrair texto completo
                    texto_completo = ""
                    for pagina in leitor.pages:
                        texto_completo += pagina.extract_text()
                    
                    # Extrair CNPJ
                    cnpj_match = re.search(r'CNPJ:\s*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', texto_completo)
                    cnpj = cnpj_match.group(1) if cnpj_match else "CNPJ não encontrado"
                    
                    # Extrair nome da empresa
                    nome_empresa_match = re.search(r'(\d{2}\.\d{3}\.\d{3})\s*-\s*([^\n]+)', texto_completo)
                    nome_empresa = nome_empresa_match.group(2).strip() if nome_empresa_match else "Nome não encontrado"
                    
                    # Extrair datas de emissão e validade
                    data_emissao_match = re.search(r'Emissão:\s*(\d{2}/\d{2}/\d{4})', texto_completo)
                    data_validade_match = re.search(r'Data de Validade:\s*(\d{2}/\d{2}/\d{4})', texto_completo)
                    
                    data_emissao = data_emissao_match.group(1) if data_emissao_match else None
                    data_validade = data_validade_match.group(1) if data_validade_match else None
                    
                    # Extrair dívidas
                    dividas = []
                    
                    # Verificar se a seção de Pendência - Débito existe no texto
                    if "Pendência - Débito" in texto_completo:
                        secao_fiscal = texto_completo.split("Pendência - Débito")[-1]
                        if "Diagnóstico Fiscal na Procuradoria-Geral" in secao_fiscal:
                            secao_fiscal = secao_fiscal.split("Diagnóstico Fiscal na Procuradoria-Geral")[0]
                        
                        print("===== SEÇÃO DE PENDÊNCIA - DÉBITO =====")
                        print(secao_fiscal)
                        print("=======================================")
                        
                        # Procurar por linhas com "DEVEDOR" - esta é a abordagem mais direta
                        # Dividir o texto em linhas
                        linhas = secao_fiscal.replace('\n', ' ').split('DEVEDOR')
                        
                        # Para cada parte (exceto a última que não tem "DEVEDOR")
                        for i, parte in enumerate(linhas[:-1]):
                            print(f"Analisando parte {i+1}:")
                            print(parte)
                            
                            # Buscar código da receita
                            codigo_match = re.search(r'(\d{4}-\d{2}\s*-\s*[A-Z]+)', parte)
                            codigo = codigo_match.group(1).strip() if codigo_match else "Código não identificado"
                            
                            # Buscar valores numéricos (usando vírgula como decimal)
                            valores_match = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', parte)
                            valores = [v.replace('.', '').replace(',', '.') for v in valores_match]
                            
                            print(f"Código: {codigo}")
                            print(f"Valores encontrados: {valores}")
                            
                            if len(valores) >= 5:
                                # Em geral, o formato é:
                                # [0] = Valor Original
                                # [1] = Saldo Devedor
                                # [2] = Multa
                                # [3] = Juros
                                # [4] = Saldo Devedor Consolidado
                                
                                valor_original = valores[0]
                                saldo_devedor = valores[4]  # Saldo Devedor Consolidado
                                
                                # Buscar data de vencimento
                                data_vcto = re.search(r'(\d{2}/\d{2}/\d{4})', parte)
                                vcto = data_vcto.group(1) if data_vcto else "Data não encontrada"
                                
                                # Buscar período
                                periodo_match = re.search(r'((?:\d{1,2}º|\d{1})(?:\s*TRIM|\s*TRIM/)(?:\d{4}|\s+\d{4}))', parte)
                                periodo = periodo_match.group(1).strip() if periodo_match else "Período não encontrado"
                                
                                divida = {
                                    'cnpj': cnpj,
                                    'empresa': nome_empresa,
                                    'codigo': codigo,
                                    'periodo': periodo,
                                    'vencimento': vcto,
                                    'valor_original': valor_original,
                                    'saldo_devedor': saldo_devedor,
                                    'situacao': "DEVEDOR",
                                    'data_emissao': data_emissao,
                                    'data_validade': data_validade
                                }
                                dividas.append(divida)
                                print(f"Dívida DEVEDOR encontrada: {codigo} - Valor Original: R${valor_original} - Saldo Devedor: R${saldo_devedor}")
                        
                        # Se nenhuma dívida foi encontrada com a abordagem anterior, tentar busca baseada em padrões específicos
                        if not dividas and "DEVEDOR" in secao_fiscal:
                            # Buscar código + valores + DEVEDOR - padrão mais específico
                            padrao_completo = re.compile(
                                r'(\d{4}-\d{2}\s*-\s*[A-Z]+)[^\d]+((?:\d{1,2}º\s*TRIM|\d{1}\s*TRIM)[^\d]*\d{4})[^\d]*(\d{2}/\d{2}/\d{4})\s+' + 
                                r'(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+DEVEDOR'
                            )
                            
                            for match in padrao_completo.finditer(secao_fiscal.replace('\n', ' ')):
                                divida = {
                                    'cnpj': cnpj,
                                    'empresa': nome_empresa,
                                    'codigo': match.group(1).strip(),
                                    'periodo': match.group(2).strip(),
                                    'vencimento': match.group(3).strip(),
                                    'valor_original': match.group(4).replace('.', '').replace(',', '.'),
                                    'saldo_devedor': match.group(8).replace('.', '').replace(',', '.'),  # Sdo. Dev. Cons.
                                    'situacao': "DEVEDOR",
                                    'data_emissao': data_emissao,
                                    'data_validade': data_validade
                                }
                                dividas.append(divida)
                                print(f"Dívida DEVEDOR encontrada (padrão completo): {divida['codigo']} - R${divida['saldo_devedor']}")
                    
                    # Verificar também pendências no formato A ANALISAR-A VENCER
                    secao_fiscal = texto_completo.split("Diagnóstico Fiscal na Receita Federal")[-1]
                    if "Diagnóstico Fiscal na Procuradoria-Geral" in secao_fiscal:
                        secao_fiscal = secao_fiscal.split("Diagnóstico Fiscal na Procuradoria-Geral")[0]
                        
                    padrao_analisar = r'(\d{4}-\d{2}\s*-\s*[A-Za-z\s-]+)\s+(\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+([\d\.,]+)\s+([\d\.,]+)\s+(A ANALISAR-A VENCER)'
                    for match in re.finditer(padrao_analisar, secao_fiscal):
                        divida = {
                            'cnpj': cnpj,
                            'empresa': nome_empresa,
                            'codigo': match.group(1).strip(),
                            'periodo': match.group(2).strip(),
                            'vencimento': match.group(3).strip(),
                            'valor_original': match.group(4).replace('.', '').replace(',', '.'),
                            'saldo_devedor': match.group(5).replace('.', '').replace(',', '.'),
                            'situacao': 'A ANALISAR-A VENCER',
                            'data_emissao': data_emissao,
                            'data_validade': data_validade
                        }
                        dividas.append(divida)
                        print(f"Dívida A ANALISAR-A VENCER encontrada: {divida['codigo']} - R${divida['saldo_devedor']}")
                    
                    # Se não houver dívidas, criar um registro especial
                    if not dividas:
                        dividas.append({
                            'cnpj': cnpj,
                            'empresa': nome_empresa,
                            'codigo': 'SEM CODIGO',
                            'periodo': 'SEM PERIODO',
                            'vencimento': data_validade,
                            'valor_original': '0',
                            'saldo_devedor': '0',
                            'situacao': 'SEM DIVIDA PENDENTE',
                            'data_emissao': data_emissao,
                            'data_validade': data_validade
                        })
                        print("Sem dívidas encontradas")
                    
                    # Calcular o valor total das dívidas
                    total_dividas = sum(float(d['saldo_devedor']) for d in dividas)
                    print(f"Total de dívidas encontradas: {len(dividas)}, Valor total: R${total_dividas:.2f}")
                    
                    return {
                        'dividas': dividas,
                        'total_dividas': total_dividas,
                        'cnpj': cnpj,
                        'nome_empresa': nome_empresa,
                        'data_emissao': data_emissao,
                        'data_validade': data_validade
                    }
                    
            except Exception as e:
                print(f"Erro ao processar o PDF: {str(e)}")
                traceback.print_exc()
                return None
                
        def adicionar_coluna_data_consulta(engine):
            """Adiciona a coluna data_consulta à tabela dividas_fiscais se ela não existir."""
            try:
                # Criar sessão
                Session = sessionmaker(bind=engine)
                session = Session()
                
                # Verificar se a coluna existe
                try:
                    session.execute(text("SELECT data_consulta FROM dividas_fiscais LIMIT 1"))
                    print("Coluna data_consulta já existe na tabela.")
                    coluna_existe = True
                except Exception:
                    coluna_existe = False
                
                # Adicionar coluna se não existir
                if not coluna_existe:
                    session.execute(text("ALTER TABLE dividas_fiscais ADD COLUMN data_consulta DATE"))
                    session.commit()
                    print("Coluna data_consulta adicionada com sucesso!")
                
                return True
            except Exception as e:
                print(f"Erro ao adicionar coluna data_consulta: {str(e)}")
                traceback.print_exc()
                return False
            finally:
                session.close()

        def salvar_dividas_no_banco(caminho_pdf, engine):
            # Extrair informações do PDF
            resultado = extrair_informacoes_pdf(caminho_pdf)
            
            if not resultado:
                print("Não foi possível extrair informações do PDF.")
                return False
            
            # Definir limites de tamanho para cada campo
            limites = {
                'cnpj': 18,
                'empresa': 255,
                'codigo': 50,
                'periodo': 20,
                'situacao': 100
            }
            
            # Data da consulta (hoje)
            data_consulta = datetime.now().date()
            
            # Preparar os dados para inserção
            dados_para_inserir = []
            
            for divida in resultado['dividas']:
                # Função para limitar tamanho de string
                def limitar_texto(texto, limite):
                    if texto and isinstance(texto, str) and len(texto) > limite:
                        return texto[:limite]
                    return texto
                
                dados = {
                    'cnpj': limitar_texto(divida['cnpj'], limites['cnpj']),
                    'empresa': limitar_texto(divida['empresa'], limites['empresa']),
                    'codigo': limitar_texto(divida['codigo'], limites['codigo']),
                    'periodo': limitar_texto(divida['periodo'], limites['periodo']),
                    'vencimento': converter_data(divida['vencimento']),
                    'valor_original': float(divida['valor_original']),
                    'saldo_devedor': float(divida['saldo_devedor']),
                    'situacao': limitar_texto(divida['situacao'], limites['situacao']),
                    'data_emissao': converter_data(divida['data_emissao']),
                    'data_validade': converter_data(divida['data_validade']),
                    'total_dividas': resultado['total_dividas'],
                    'data_consulta': data_consulta  # Adicionar data da consulta
                }
                
                dados_para_inserir.append(dados)
            
            # Criar sessão
            Session = sessionmaker(bind=engine)
            session = Session()
            
            try:
                # Tentar inserir com data_consulta
                query_com_data = text("""
                INSERT INTO dividas_fiscais 
                (cnpj, empresa, codigo, periodo, vencimento, valor_original, 
                saldo_devedor, situacao, data_emissao, data_validade, total_dividas, data_consulta)
                VALUES 
                (:cnpj, :empresa, :codigo, :periodo, :vencimento, :valor_original, 
                :saldo_devedor, :situacao, :data_emissao, :data_validade, :total_dividas, :data_consulta)
                """)
                
                query_sem_data = text("""
                INSERT INTO dividas_fiscais 
                (cnpj, empresa, codigo, periodo, vencimento, valor_original, 
                saldo_devedor, situacao, data_emissao, data_validade, total_dividas)
                VALUES 
                (:cnpj, :empresa, :codigo, :periodo, :vencimento, :valor_original, 
                :saldo_devedor, :situacao, :data_emissao, :data_validade, :total_dividas)
                """)
                
                for item in dados_para_inserir:
                    try:
                        session.execute(query_com_data, item)
                        print(f"Registro inserido com data_consulta: {item['codigo']} - {item['saldo_devedor']}")
                    except Exception as e:
                        # Se falhar, pode ser porque a coluna data_consulta não existe
                        if "Unknown column 'data_consulta'" in str(e):
                            print("Tentando inserir sem a coluna data_consulta...")
                            item_sem_data = item.copy()
                            item_sem_data.pop('data_consulta')
                            session.execute(query_sem_data, item_sem_data)
                            print(f"Registro inserido sem data_consulta: {item['codigo']} - {item['saldo_devedor']}")
                        else:
                            print(f"Erro ao inserir registro: {e}")
                            print(f"Dados problemáticos: {item}")
                            session.rollback()
                            raise
                
                session.commit()
                print(f"Dados salvos com sucesso! Total de dívidas: {len(dados_para_inserir)}")
                
                # Mostrar informação sobre situação
                for divida in resultado['dividas']:
                    print(f"CNPJ: {divida['cnpj']} - Situação: {divida['situacao']}")
                
                return True
            
            except Exception as e:
                session.rollback()
                print(f"Erro ao salvar dados no banco: {str(e)}")
                traceback.print_exc()
                return False
            
            finally:
                session.close()

        def registrar_resumo_processamento(engine, total_processados, sem_divida, com_divida, com_erro):
            # Criar sessão
            Session = sessionmaker(bind=engine)
            session = Session()
            
            try:
                # Verificar se a tabela existe
                try:
                    session.execute(text("SELECT * FROM consultas_fiscais LIMIT 1"))
                except Exception:
                    # Criar tabela se não existir
                    session.execute(text("""
                    CREATE TABLE IF NOT EXISTS consultas_fiscais (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        data_consulta DATETIME DEFAULT CURRENT_TIMESTAMP,
                        total_pdfs_processados INT,
                        pdfs_sem_divida INT,
                        pdfs_com_divida INT,
                        pdfs_com_erro INT,
                        observacoes TEXT
                    )
                    """))
                    session.commit()
                
                # Inserir registro de resumo
                query = text("""
                INSERT INTO consultas_fiscais 
                (data_consulta, total_pdfs_processados, pdfs_sem_divida, pdfs_com_divida, pdfs_com_erro, observacoes)
                VALUES 
                (NOW(), :total_processados, :sem_divida, :com_divida, :com_erro, :observacoes)
                """)
                
                observacoes = f"Processamento de PDFs fiscais realizado em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
                
                session.execute(query, {
                    'total_processados': total_processados,
                    'sem_divida': sem_divida,
                    'com_divida': com_divida,
                    'com_erro': com_erro,
                    'observacoes': observacoes
                })
                
                session.commit()
                print("Resumo do processamento salvo no banco de dados.")
            
            except Exception as e:
                session.rollback()
                print(f"Erro ao salvar resumo do processamento: {str(e)}")
                traceback.print_exc()
            
            finally:
                session.close()

        def processar_pdfs_na_pasta(pasta, pasta_lidos, engine):
            # Contador de PDFs processados
            pdfs_processados = 0
            pdfs_com_erro = 0
            pdfs_sem_divida = 0
            pdfs_com_divida = 0

            # Tentar adicionar a coluna data_consulta
            adicionar_coluna_data_consulta(engine)
            
            # Iterar sobre todos os arquivos na pasta
            for arquivo in os.listdir(pasta):
                # Verificar se é um arquivo PDF e não está em subpasta
                caminho_completo = os.path.join(pasta, arquivo)
                if arquivo.lower().endswith('.pdf') and os.path.isfile(caminho_completo):
                    try:
                        print(f"\n--- Processando PDF: {arquivo} ---")
                        
                        # Extrair informações para verificar a situação
                        info = extrair_informacoes_pdf(caminho_completo)
                        
                        if info:
                            situacao = info['dividas'][0]['situacao']
                            if "SEM DIVIDA" in situacao:
                                pdfs_sem_divida += 1
                                print(f"PDF sem dívidas: {arquivo}")
                            else:
                                pdfs_com_divida += 1
                                print(f"PDF com dívidas: {arquivo}")
                        
                        # Salvar dívidas no banco
                        resultado = salvar_dividas_no_banco(caminho_completo, engine)
                        
                        # Se processou com sucesso, mover para pasta de lidos
                        if resultado:
                            caminho_destino = os.path.join(pasta_lidos, arquivo)
                            shutil.move(caminho_completo, caminho_destino)
                            print(f"PDF movido para: {caminho_destino}")
                            pdfs_processados += 1
                        else:
                            pdfs_com_erro += 1
                        
                    except Exception as e:
                        print(f"Erro ao processar {arquivo}: {str(e)}")
                        traceback.print_exc()
                        pdfs_com_erro += 1
            
            # Relatório final
            print("\n===== RELATÓRIO DE PROCESSAMENTO =====")
            print(f"Total de PDFs processados: {pdfs_processados}")
            print(f"PDFs sem dívidas: {pdfs_sem_divida}")
            print(f"PDFs com dívidas: {pdfs_com_divida}")
            print(f"PDFs com erro: {pdfs_com_erro}")
            
            # Registrar resumo no banco de dados
            registrar_resumo_processamento(
                engine,
                pdfs_processados,
                pdfs_sem_divida,
                pdfs_com_divida,
                pdfs_com_erro
            )
            
            return pdfs_processados, pdfs_sem_divida, pdfs_com_divida, pdfs_com_erro
        
        # Código principal da view
        # Definir pastas


        # Garantir que a pasta de lidos exista
        os.makedirs(pasta_lidos, exist_ok=True)

        # Configurar conexão com o banco
        engine = create_engine(config('DATABASE_URL'))

        # Processamento de PDFs
        total_processados, sem_divida, com_divida, com_erro = processar_pdfs_na_pasta(pasta_pdfs, pasta_lidos, engine)
        
        # Retornar resposta JSON
        return JsonResponse({
            'success': True,
            'total_processados': total_processados,
            'pdfs_sem_divida': sem_divida,
            'pdfs_com_divida': com_divida,
            'pdfs_com_erro': com_erro
        })
            
    except Exception as e:
        print(f"Erro ao processar PDFs: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            'success': False, 
            'error': str(e)
        }, status=500)