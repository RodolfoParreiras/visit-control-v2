#!/bin/bash
# restore.sh — Restaura o banco de dados a partir de um backup
# Uso: ./scripts/restore.sh <arquivo-backup.sql.gz>
#
# Exemplo:
#   ./scripts/restore.sh ./backups/visit_control_20240101_120000.sql.gz

set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Erro: informe o arquivo de backup."
  echo "   Uso: $0 <arquivo.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  ATENÇÃO: Esta operação irá substituir todos os dados existentes no banco!"
read -rp "   Digite 'sim' para confirmar: " CONFIRM

if [ "$CONFIRM" != "sim" ]; then
  echo "Operação cancelada."
  exit 0
fi

echo "📥 Restaurando backup: $BACKUP_FILE"

gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql \
  -U visit_user \
  -d visit_control \
  --quiet

echo "✅ Restauração concluída com sucesso!"
