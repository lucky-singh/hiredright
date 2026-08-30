"""Custom user model — email as the unique identifier.

Supports the three candidate entry paths (email magic link, mobile OTP,
LinkedIn OIDC) while keeping a single canonical identity keyed by verified
email, so a candidate who starts with one method and later uses another lands
in the same profile.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Manager for a User with no username field."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The email must be set.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Email-first user. `username` is retained for Django internals but unused."""

    username = None
    email = models.EmailField("email address", unique=True)
    phone_number = models.CharField(
        max_length=32,
        blank=True,
        help_text="E.164 format, e.g. +14155552671. Used for mobile OTP login.",
    )
    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self) -> str:
        return self.email

    @property
    def display_name(self) -> str:
        if self.first_name or self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.email.split("@")[0]

    def mark_email_verified(self) -> None:
        if not self.email_verified:
            self.email_verified = True
            self.save(update_fields=["email_verified"])

    def mark_phone_verified(self) -> None:
        if not self.phone_verified:
            self.phone_verified = True
            self.save(update_fields=["phone_verified"])

    def touch_last_login(self) -> None:
        self.last_login = timezone.now()
        self.save(update_fields=["last_login"])