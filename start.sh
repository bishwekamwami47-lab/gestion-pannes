#!/usr/bin/env bash
set -e
python backend/manage.py migrate --noinput

# Au premier déploiement, crée automatiquement le compte admin si ADMIN_PASSWORD est défini.
if [ -n "$ADMIN_PASSWORD" ]; then
  python backend/manage.py shell -c "
import os
from incidents.models import Utilisateur as U
if not U.objects.filter(is_superuser=True).exists():
    U.objects.create_superuser(
        username='admin',
        email='admin@example.com',
        password=os.environ.get('ADMIN_PASSWORD', ''),
        role=U.Role.ADMIN_GENERAL,
    )
    print('Admin cree (username=admin)')
else:
    print('Admin deja present')
"
fi

gunicorn config.wsgi --chdir backend --bind 0.0.0.0:$PORT