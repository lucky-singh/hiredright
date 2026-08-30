"""SMS delivery for mobile OTP login.

Re-exported here so `SMS_BACKEND` settings can name the short dotted path
``accounts.sms.ConsoleSMSBackend`` rather than reaching into the module.
"""

from .backends import BaseSMSBackend, ConsoleSMSBackend, get_sms_backend

__all__ = ["BaseSMSBackend", "ConsoleSMSBackend", "get_sms_backend"]
