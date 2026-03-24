from .base import *  # noqa: F401, F403
import os

SECRET_KEY = "dev-secret-key-change-in-production"

DEBUG = True

ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

MEDIA_ROOT = BASE_DIR / "media"  # noqa: F405

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
