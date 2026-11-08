#!/usr/bin/env bash
# Cópia de segurança diária: base de dados (mysqldump) + fotografias dos membros.
# Uso (cron, todos os dias às 02:30):
#   30 2 * * * /caminho/coral-tocoista/scripts/backup.sh >> /caminho/backups/backup.log 2>&1
#
# Credenciais: NUNCA neste ficheiro. Crie ~/.my.cnf com permissões 600:
#   [mysqldump]
#   user=coral
#   password=********
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BACKUP_DIR:-$HOME/backups/coral}"
DB="${DB_DATABASE:-$(grep -E '^DB_DATABASE=' "$APP_DIR/.env" | cut -d= -f2)}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"
chmod 700 "$DEST"

# --single-transaction: cópia consistente sem bloquear o sistema (InnoDB)
mysqldump --single-transaction --routines --triggers --no-tablespaces "$DB" | gzip -9 > "$DEST/db-$STAMP.sql.gz"
tar -czf "$DEST/fotos-$STAMP.tar.gz" -C "$APP_DIR/storage/app" private

# Verificação mínima: o ficheiro comprimido é legível
gzip -t "$DEST/db-$STAMP.sql.gz"

# Rotação: apaga cópias com mais de KEEP_DAYS dias
find "$DEST" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'fotos-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%d/%m/%Y %H:%M') cópia concluída: $DEST/db-$STAMP.sql.gz"
