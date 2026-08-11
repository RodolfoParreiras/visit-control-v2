#!/usr/bin/env sh
set -eu

docker compose up -d --wait db
docker compose build

# Verifica se já existe um usuário e, apenas na primeira execução, solicita
# os dados do administrador no terminal com a senha oculta.
if [ -n "${MSYSTEM:-}" ]; then
  # O Git Bash converte caminhos Unix em caminhos do Windows. Este comando
  # precisa preservar /app, pois ele é um caminho interno do container.
  MSYS_NO_PATHCONV=1 docker compose run --rm --no-deps backend \
    node --enable-source-maps /app/dist/setup-admin.mjs
else
  docker compose run --rm --no-deps backend \
    node --enable-source-maps /app/dist/setup-admin.mjs
fi

docker compose up -d
