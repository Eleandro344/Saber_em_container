import os
from dotenv import load_dotenv
load_dotenv()
from decouple import config


from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
from decouple import config

SECRET_KEY = config('SECRET_KEY')
# SECURITY WARNING: don't run with debug turned on in production!

# AJUSTE AQUI PARA PRODUÇÃO
DEBUG = False
## AQUI ALTEREI O IP DA MAQUINA LOCAL
ALLOWED_HOSTS = [
    config('DJANGO_ALLOWED_HOST')
]
CORS_ALLOWED_ORIGINS = [
    config("DJANGO_CORS_ORIGIN")
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "https://comece.dev",
]

# DEBUG = True

# ALLOWED_HOSTS = ['*']  # Permite todos os hosts, mas é recomendado restringir em produção

# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:3000"
# ]


from decouple import config

# print('🚀 VARIÁVEL DJANGO_ALLOWED_HOST =>', config('DJANGO_ALLOWED_HOST'))

# print('🚀 VARIÁVEL DJANGO_ALLOWED_HOST =>', config('DATABASE_URL'))

# # Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'rest_framework',
    'core',
    'corsheaders',
    'rest_framework_simplejwt.token_blacklist',  # 👈 adicionado


]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'corsheaders.middleware.CorsMiddleware',
       'django.middleware.common.CommonMiddleware',
 

]

SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True

ROOT_URLCONF = "saber_kanban.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "saber_kanban.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

import pymysql
pymysql.install_as_MySQLdb()

# Resto do seu código anterior...

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
            # Remova configurações SSL anteriores
        },
        # Adicione estas configurações extras
        'CONN_MAX_AGE': 0,  # Desativa conexões persistentes
    }
}

# Logging mais detalhado
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
        },
    },
}



# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=1440),  # ou mais, ex: 1 hora
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,


    "AUTH_HEADER_TYPES": ("Bearer",),
}
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
