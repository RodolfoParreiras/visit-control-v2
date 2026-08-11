$ErrorActionPreference = "Stop"

docker compose up -d --wait db
docker compose build

# O comando verifica se já existe um usuário. Somente na primeira execução
# apresenta as perguntas no próprio terminal, com a senha oculta.
docker compose run --rm --no-deps backend `
  node --enable-source-maps /app/dist/setup-admin.mjs

docker compose up -d
