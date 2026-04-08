"""
Stub User, Firm, and access models — stand-ins until this module is merged into fakturuj si.

DO NOT add new business logic or fields to User, Firm, or UserWarehouseAccess.
These classes exist only to make the warehouse module runnable in isolation.
All warehouse-specific settings and preferences belong in WarehouseSettings below.

If a new warehouse feature genuinely needs something from the core Firm (e.g. a currency
or locale field), add it to WarehouseSettings here — not to Firm. Only in the final merge
into fakturuj si should Firm/User be extended, and even then only if the core team agrees.

Merge checklist:
  - Replace User with core.models.User
  - Replace Firm with core.models.Firm
  - Replace UserWarehouseAccess with core's permission system
  - Move warehouse_mode onto core's Firm model
"""
import uuid
from django.db import models
from .base import AuditModel


class User(AuditModel):
    """
    Stub user — swapped for fakturuj si User on merge. DO NOT EXTEND.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.email

    class Meta:
        db_table = "warehouse_user"


class Firm(AuditModel):
    """
    Stub firm — swapped for fakturuj si Firm on merge. DO NOT EXTEND.
    warehouse_mode is the only field here because it belongs on the core Firm model;
    everything else warehouse-specific goes in WarehouseSettings.
    """
    class WarehouseMode(models.TextChoices):
        STRICT = "strict", "Strict (block negative stock)"
        SOFT = "soft", "Soft (warn but allow negative)"
        DISABLED = "disabled", "Disabled (no warehouse tracking)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    warehouse_mode = models.CharField(
        max_length=20,
        choices=WarehouseMode.choices,
        default=WarehouseMode.SOFT,
    )

    def __str__(self):
        return self.name

    class Meta:
        db_table = "warehouse_firm"


class UserWarehouseAccess(AuditModel):
    """
    Per-user, per-firm warehouse permission level.
    """
    class Level(models.TextChoices):
        NONE = "none", "No Access"
        VIEW = "view", "View Only"
        EDIT = "edit", "Edit"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="warehouse_access")
    firm = models.ForeignKey(Firm, on_delete=models.CASCADE, related_name="warehouse_access")
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.EDIT)

    def __str__(self):
        return f"{self.user.email} @ {self.firm.name} — {self.level}"

    class Meta:
        unique_together = ("user", "firm")
        db_table = "warehouse_user_firm_access"


class WarehouseSettings(models.Model):
    """
    Per-firm warehouse UI / behaviour preferences that belong specifically to
    the warehouse module (not to the core Firm model in fakturuj si).
    Auto-created on first access.
    """
    firm = models.OneToOneField(
        Firm, on_delete=models.CASCADE, related_name="warehouse_settings"
    )
    show_sku = models.BooleanField(
        default=False,
        help_text="Display SKU codes in the catalog and product pages.",
    )
    skip_confirm = models.BooleanField(
        default=False,
        help_text="Skip destructive-action confirmation dialogs (demo / power-user mode).",
    )
    default_energy_rate = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True,
        help_text="Default energy cost per kWh (€). Pre-filled in production cost forms.",
    )
    warehouse_mode = models.CharField(
        max_length=20,
        choices=[("strict", "Strict"), ("soft", "Soft"), ("disabled", "Disabled")],
        default="soft",
        help_text="Stock validation mode: strict blocks negative stock, soft warns, disabled does nothing.",
    )
    color_library = models.JSONField(
        default=list, blank=True,
        help_text='Unified color library. [{name, hex, status: favorite|normal|hidden, isPreset: bool}]',
    )

    # POS terminal auth token — generated once, entered on POS setup screen.
    # When merging with fakturuj.si: replace with proper per-device tokens
    # (separate model, one token per terminal, revocable individually).
    pos_api_token = models.CharField(
        max_length=64, blank=True, default="",
        help_text="API token for POS terminals. Empty = no auth required (dev mode).",
    )

    @classmethod
    def for_firm(cls, firm):
        obj, _ = cls.objects.get_or_create(firm=firm)
        return obj

    class Meta:
        db_table = "warehouse_settings"
