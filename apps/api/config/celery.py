"""Celery application for HireRight.

Tasks (CV parsing, matching, notifications) are queued here. The broker/result
backend come from settings; locally that is Redis via Docker Compose.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("hiredright")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()