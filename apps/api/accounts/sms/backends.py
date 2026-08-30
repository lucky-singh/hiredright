"""Pluggable SMS backends for mobile OTP login.

The console backend is used in development; a real provider (Twilio, etc.) is a
drop-in replacement implementing the same `send_otp` interface. Kept behind an
abstraction so the auth flow is testable without credentials and cloud-agnostic.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class BaseSMSBackend:
    """Interface every SMS backend implements."""

    def send_otp(self, phone_number: str, code: str) -> None:
        raise NotImplementedError


class ConsoleSMSBackend(BaseSMSBackend):
    """Print the OTP to the console — development only."""

    def send_otp(self, phone_number: str, code: str) -> None:
        logger.info("[HireRight SMS] OTP for %s: %s", phone_number, code)
        print(f"\n[HireRight SMS] OTP for {phone_number}: {code}\n")


def get_sms_backend() -> BaseSMSBackend:
    """Resolve the configured SMS backend by dotted path."""
    path = getattr(settings, "SMS_BACKEND", "accounts.sms.ConsoleSMSBackend")
    module_name, _, class_name = path.rpartition(".")
    module = __import__(module_name, fromlist=[class_name])
    return getattr(module, class_name)()