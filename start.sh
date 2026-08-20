#!/usr/bin/env bash
set -e
python backend/manage.py migrate --noinput
gunicorn config.wsgi --chdir backend --bind 0.0.0.0:$PORT