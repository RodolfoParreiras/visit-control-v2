#!/bin/bash
# migrate.sh — Aplica as migrações do Drizzle ao banco de dados
# Uso: ./scripts/migrate.sh
#
# Requer que o banco de dados esteja em execução e DATABASE_URL esteja configurado.

set -euo pipefail

# Carrega variáveis de ambiente do .env se existir
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL não configurado. Configure o arquivo .env primeiro."
  exit 1
fi

echo "🗄️  Aplicando migrações do banco de dados..."
pnpm --filter @visit-control/db run push
echo "✅ Migrações aplicadas com sucesso!"
