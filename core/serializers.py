from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Quadro, Tarefa
from rest_framework import serializers
from .models import Quadro
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['first_name'] = user.first_name
        return token
    


class QuadroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quadro
        fields = '__all__'

# core/serializers.py

class TarefaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tarefa
        fields = '__all__'
