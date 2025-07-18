# Django imports
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings

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

# Local config
from config_local import pasta_pdfs, pasta_lidos


from dotenv import load_dotenv
import os

load_dotenv()  # Carrega as variáveis do .env

senha = os.getenv("SENHA_CERTIFICADO")


# CLASSES DE VIEWSETS E AUTENTICAÇÃO
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class QuadroViewSet(viewsets.ModelViewSet):
    queryset = Quadro.objects.all()
    serializer_class = QuadroSerializer
    permission_classes = [IsAuthenticated]

class TarefaViewSet(viewsets.ModelViewSet):
    queryset = Tarefa.objects.all()
    serializer_class = TarefaSerializer


@csrf_exempt
def listar_empresas(request):
    try:
        engine = create_engine(config('DATABASE_URL'))
        df = pd.read_sql("SELECT razaosocial, cnpj FROM empresas", con=engine)
        return JsonResponse(df.to_dict(orient='records'), safe=False)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=500)




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
@csrf_exempt
def empresas_dctfweb(request):
    if request.method != 'GET':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        engine = create_engine(config('DATABASE_URL'))

        query = "SELECT cod, razaosocial, operador, cnpj FROM departamento_pessoal"
        df = pd.read_sql(query, con=engine)

        # Ajuste no formato do CNPJ (remover notação científica e garantir 14 dígitos)
        df['cnpj'] = df['cnpj'].apply(lambda x: str(int(float(x))).zfill(14))

        # Adicionar colunas fictícias para manter compatibilidade com estrutura da tabela no frontend
        df['situacao'] = 'Não gerado'
        df['pagamento'] = ''
        df['data_vencimento'] = ''
        df['valor'] = 'R$ 0,00'

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

@csrf_exempt
def dctfweb_emitir_guias(request):
    if request.method != 'POST':
        return JsonResponse({'mensagem': 'Método não permitido'}, status=405)

    try:
        body = json.loads(request.body)
        cnpjs = body.get('cnpjs', [])
        competencia = body.get('competencia', '')  # Ex: "04/2025"

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
            zip_path = os.path.join(temp_dir, 'dctfweb_guias.zip')
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for emp in empresas:
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

                    # Log de mensagens da API
                    mensagens = resposta_json.get('mensagens', [])
                    if mensagens:
                        print(f"⚠️ Mensagem(s) da API para {cnpj_original}:")
                        for msg in mensagens:
                            print(f"  - [{msg.get('codigo')}] {msg.get('texto')}")

                    dados = json.loads(resposta_json.get('dados', '{}'))
                    pdf_base64 = dados.get('PDFByteArrayBase64')

                    if not pdf_base64:
                        continue  # Pula se não houver guia

                    pdf_bin = base64.b64decode(pdf_base64)
                    nome_arquivo = f"{razao}_{cnpj}.pdf"
                    caminho_pdf = os.path.join(temp_dir, nome_arquivo)

                    with open(caminho_pdf, 'wb') as f:
                        f.write(pdf_bin)

                    zipf.write(caminho_pdf, arcname=nome_arquivo)

            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = 'attachment; filename="dctfweb_guias.zip"'
                return response

    except Exception as e:
        return JsonResponse({'mensagem': f'Erro ao gerar guias: {str(e)}'}, status=500)





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