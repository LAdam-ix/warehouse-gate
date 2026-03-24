from .base import *  # noqa: F401, F403
import os

SECRET_KEY = "dev-secret-key-change-in-production"

DEBUG = True

ALLOWED_HOSTS = ["*"]

_DB_DIR = os.environ.get("DB_DIR", str(BASE_DIR))  # noqa: F405
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.path.join(_DB_DIR, "db.sqlite3"),
    }
}

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", str(BASE_DIR / "media"))  # noqa: F405

STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405

CORS_ALLOW_ALL_ORIGINS = True

# Dev bypass: always use this user/firm (set to None to require real JWT)
# These are set to the IDs that get created by the dev seed command
DEV_MODE = True
DEV_USER_EMAIL = os.environ.get("DEV_USER_EMAIL", "dev@warehouse.local")
DEV_FIRM_ID = os.environ.get("DEV_FIRM_ID", None)  # populated after first run

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
}
