
# Create your models here.
from django.db import models

class Quadro(models.Model):
    SITUACOES = [
        ('PROJETO NA FILA', 'PROJETO NA FILA'),
        ('EM NEGOCIAÇÃO', 'EM NEGOCIAÇÃO'),
        ('EXECUÇÃO DO TIME', 'EXECUÇÃO DO TIME'),
        ('APRESENTAÇÃO AO CLIENTE', 'APRESENTAÇÃO AO CLIENTE'),
        ('VALORES', 'VALORES'),
        ('ENTREGA AO CLIENTE', 'ENTREGA AO CLIENTE'),
    ]
    empresa = models.CharField(max_length=100, blank=True, null=True)
    nome = models.CharField(max_length=100)
    responsavel = models.CharField(max_length=100)
    ativo = models.BooleanField(default=True)
    situacao = models.CharField(max_length=50, choices=SITUACOES, default='PROJETO NA FILA')
    criado_em = models.DateTimeField(auto_now_add=True)  

    def __str__(self):
        return self.nome
class Tarefa(models.Model):
    quadro = models.ForeignKey(Quadro, on_delete=models.CASCADE, related_name='tarefas')
    titulo = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.titulo
from django.db import models

