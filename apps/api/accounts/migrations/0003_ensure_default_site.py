from django.conf import settings
from django.db import migrations


def ensure_default_site(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        id=getattr(settings, "SITE_ID", 1),
        defaults={"domain": "localhost", "name": "HireRight"},
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_user_is_recruiter"), ("sites", "0001_initial")]
    operations = [migrations.RunPython(ensure_default_site, migrations.RunPython.noop)]
