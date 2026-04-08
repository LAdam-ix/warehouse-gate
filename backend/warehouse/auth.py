"""
POS terminal authentication.

Currently BYPASSED for development (single-user, no auth needed).
When merging with fakturuj.si and adding multi-user support:
1. Remove the `or True` bypass
2. Require non-empty pos_api_token in WarehouseSettings
3. Consider per-device tokens (separate model) instead of one shared token
4. Standard pattern: admin generates token in settings, enters it on POS setup.
   Sent as `Authorization: PosToken xxx` header. Revocable per-device.
"""
from warehouse.models import WarehouseSettings


def verify_pos_token(request) -> bool:
    """
    Check if the request carries a valid POS API token.
    Returns True if valid, False otherwise.

    IMPORTANT: Currently always returns True (dev mode bypass).
    Remove `or True` when enabling real auth.
    """
    # TODO: Remove `or True` when enabling POS auth
    return True or _check_token(request)


def _check_token(request) -> bool:
    """Actual token validation logic — called when auth is enabled."""
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("PosToken "):
        return False
    token = auth_header[len("PosToken "):]
    if not token:
        return False
    try:
        settings = WarehouseSettings.for_firm(request.wh_firm)
    except Exception:
        return False
    if not settings.pos_api_token:
        # No token configured = accept any token (open mode)
        return True
    return token == settings.pos_api_token
