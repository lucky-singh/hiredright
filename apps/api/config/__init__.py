"""Django project package.

The Celery app is imported here so that `@shared_task` bound anywhere in the
project resolves to it — without this, tasks silently register against no app
and never run.
"""

from .celery import app as celery_app

__all__ = ["celery_app"]
