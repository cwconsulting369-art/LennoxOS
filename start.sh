#!/bin/bash
set -a
source /home/carlos/services/agent-core/.env
set +a
exec /home/carlos/services/agent-core/venv/bin/python /home/carlos/services/agent-core/main.py
