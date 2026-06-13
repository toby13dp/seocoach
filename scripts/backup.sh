#!/usr/bin/env bash
# ============================================================================
# SEOCoach — Backup Script (BACKUP-001)
# ============================================================================
# Maakt een volledige backup van de SEOCoach installatie:
#   - PostgreSQL database (pg_dump, custom format, compressed)
#   - SQLite database (indien gebruikt)
#   - Ollama modellen lijst
#   - .env configuratie (met permissie-waarschuwing)
#   - Manifest met checksums en metadata
#
# Gebruik:
#   ./scripts/backup.sh [OUTPUT_DIR]
#   ./scripts/backup.sh              # Standaard: ./backups/
#   ./scripts/backup.sh /mnt/backup  # Aangepaste output map
#
# Cron voorbeeld (dagelijks om 02:00):
#   0 2 * * * /path/to/seocoach/scripts/backup.sh >> /var/log/seocoach-backup.log 2>&1
# ============================================================================

set -euo pipefail

# ──────────────────────────────────────────────
# Configuratie
# ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_DIR="${PROJECT_DIR}/backups"
OUTPUT_DIR="${1:-${DEFAULT_OUTPUT_DIR}}"
RETENTION_DAYS=30
TIMESTAMP="$(date +%Y%m%d_%H%M%S})"
BACKUP_DIR="${OUTPUT_DIR}/${TIMESTAMP}"
APP_VERSION="${APP_VERSION:-1.0.0}"
LOG_FILE="${OUTPUT_DIR}/backup.log"

# PostgreSQL configuratie (uit omgevingsvariabelen of defaults)
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-seocoach}"
POSTGRES_USER="${POSTGRES_USER:-seocoach}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-seocoach_password}"

# SQLite pad
SQLITE_DB_PATH="${PROJECT_DIR}/db/custom.db"

# Docker compose project naam
COMPOSE_PROJECT="${COMPOSE_PROJECT:-seocoach}"

# ──────────────────────────────────────────────
# Hulpfuncties
# ──────────────────────────────────────────────

log() {
  local level="${1}"
  local message="${2}"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info()  { log "INFO"  "${1}"; }
warn()  { log "WARN"  "${1}"; }
error() { log "ERROR" "${1}"; }

# Bereken SHA256 checksum van een bestand
sha256_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "${1}" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "${1}" | cut -d' ' -f1
  else
    echo "checksum_unavailable"
  fi
}

# Controleer of een commando beschikbaar is
require_cmd() {
  if ! command -v "${1}" &>/dev/null; then
    error "Vereist commando niet gevonden: ${1}"
    error "Installeer het en probeer opnieuw."
    exit 1
  fi
}

# ──────────────────────────────────────────────
# Pre-checks
# ──────────────────────────────────────────────

info "=========================================="
info "SEOCoach Backup — Gestart"
info "=========================================="
info "Output directory: ${OUTPUT_DIR}"
info "Backup directory: ${BACKUP_DIR}"
info "Timestamp: ${TIMESTAMP}"

# Maak output directories aan
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${BACKUP_DIR}"

# Logbestand initialiseren
touch "${LOG_FILE}"

# Controleer vereiste commando's
require_cmd docker

# Bepaal het type database dat in gebruik is
DB_TYPE="unknown"
if docker compose ps postgres 2>/dev/null | grep -q "running\|Up"; then
  DB_TYPE="postgresql"
  info "PostgreSQL service gedetecteerd (Docker)"
elif docker ps --filter "name=postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  DB_TYPE="postgresql"
  info "PostgreSQL container gedetecteerd (standalone Docker)"
elif [ -f "${SQLITE_DB_PATH}" ]; then
  DB_TYPE="sqlite"
  info "SQLite database gedetecteerd: ${SQLITE_DB_PATH}"
else
  warn "Geen database gevonden! Controleer de configuratie."
fi

# ──────────────────────────────────────────────
# Backup: PostgreSQL
# ──────────────────────────────────────────────

if [ "${DB_TYPE}" = "postgresql" ]; then
  info "PostgreSQL backup starten..."

  PG_BACKUP_FILE="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"

  # Bepaal hoe we pg_dump kunnen uitvoeren
  if docker compose ps postgres 2>/dev/null | grep -q "running\|Up"; then
    # PostgreSQL draait in Docker Compose
    info "pg_dump via Docker Compose uitvoeren..."
    PGPASSWORD="${POSTGRES_PASSWORD}" docker compose exec -T postgres \
      pg_dump \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -h localhost \
        --format=custom \
        --compress=9 \
        --verbose \
        > "${PG_BACKUP_FILE}" 2>>"${LOG_FILE}"
  else
    # PostgreSQL draait standalone — probeer lokaal pg_dump
    require_cmd pg_dump
    info "pg_dump lokaal uitvoeren..."
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
      -U "${POSTGRES_USER}" \
      -d "${POSTGRES_DB}" \
      -h "${POSTGRES_HOST}" \
      -p "${POSTGRES_PORT}" \
      --format=custom \
      --compress=9 \
      --verbose \
      > "${PG_BACKUP_FILE}" 2>>"${LOG_FILE}"
  fi

  if [ -f "${PG_BACKUP_FILE}" ] && [ -s "${PG_BACKUP_FILE}" ]; then
    PG_SIZE=$(du -h "${PG_BACKUP_FILE}" | cut -f1)
    PG_SHA256=$(sha256_file "${PG_BACKUP_FILE}")
    info "PostgreSQL backup voltooid: ${PG_BACKUP_FILE} (${PG_SIZE})"
    info "SHA256: ${PG_SHA256}"
  else
    error "PostgreSQL backup MISLUKT — bestand is leeg of ontbreekt"
  fi
fi

# ──────────────────────────────────────────────
# Backup: SQLite
# ──────────────────────────────────────────────

if [ "${DB_TYPE}" = "sqlite" ]; then
  info "SQLite backup starten..."

  SQLITE_BACKUP_FILE="${BACKUP_DIR}/sqlite_${TIMESTAMP}.db"

  # Gebruik sqlite3 .backup voor consistente backup
  if command -v sqlite3 &>/dev/null; then
    info "sqlite3 .backup uitvoeren..."
    sqlite3 "${SQLITE_DB_PATH}" ".backup '${SQLITE_BACKUP_FILE}'" 2>>"${LOG_FILE}"
  else
    warn "sqlite3 niet gevonden — fallback naar bestandskopie"
    cp "${SQLITE_DB_PATH}" "${SQLITE_BACKUP_FILE}"
  fi

  if [ -f "${SQLITE_BACKUP_FILE}" ] && [ -s "${SQLITE_BACKUP_FILE}" ]; then
    SQLITE_SIZE=$(du -h "${SQLITE_BACKUP_FILE}" | cut -f1)
    SQLITE_SHA256=$(sha256_file "${SQLITE_BACKUP_FILE}")
    info "SQLite backup voltooid: ${SQLITE_BACKUP_FILE} (${SQLITE_SIZE})"
    info "SHA256: ${SQLITE_SHA256}"
  else
    error "SQLite backup MISLUKT — bestand is leeg of ontbreekt"
  fi
fi

# ──────────────────────────────────────────────
# Backup: Ollama modellen lijst
# ──────────────────────────────────────────────

info "Ollama modellen lijst backup starten..."

OLLAMA_BACKUP_FILE="${BACKUP_DIR}/ollama_models_${TIMESTAMP}.txt"

# Probeer Ollama modellen op te vragen
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
if curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | python3 -m json.tool 2>/dev/null > "${OLLAMA_BACKUP_FILE}"; then
  OLLAMA_SIZE=$(du -h "${OLLAMA_BACKUP_FILE}" | cut -f1)
  OLLAMA_SHA256=$(sha256_file "${OLLAMA_BACKUP_FILE}")
  info "Ollama modellen opgevraagd: ${OLLAMA_BACKUP_FILE} (${OLLAMA_SIZE})"
elif docker compose ps ollama 2>/dev/null | grep -q "running\|Up"; then
  # Probeer via Docker
  docker compose exec -T ollama ollama list > "${OLLAMA_BACKUP_FILE}" 2>>"${LOG_FILE}" || true
  OLLAMA_SHA256=$(sha256_file "${OLLAMA_BACKUP_FILE}")
  info "Ollama modellen via Docker opgevraagd"
else
  echo '{"error": "Ollama niet beschikbaar"}' > "${OLLAMA_BACKUP_FILE}"
  warn "Ollama service niet beschikbaar — lege modellenlijst opgeslagen"
fi

# ──────────────────────────────────────────────
# Backup: .env configuratie
# ──────────────────────────────────────────────

info ".env configuratie backup starten..."

ENV_BACKUP_FILE="${BACKUP_DIR}/env_${TIMESTAMP}.backup"

if [ -f "${PROJECT_DIR}/.env" ]; then
  cp "${PROJECT_DIR}/.env" "${ENV_BACKUP_FILE}"
  # Beperk permissies — bevat geheimen
  chmod 600 "${ENV_BACKUP_FILE}"
  ENV_SHA256=$(sha256_file "${ENV_BACKUP_FILE}")
  warn ".env bevat GEHEIMEN — bestand heeft chmod 600, bewaar het veilig!"
  info ".env backup voltooid: ${ENV_BACKUP_FILE}"
else
  warn ".env bestand niet gevonden op ${PROJECT_DIR}/.env"
  echo "# .env niet gevonden tijdens backup" > "${ENV_BACKUP_FILE}"
fi

# ──────────────────────────────────────────────
# Manifest aanmaken
# ──────────────────────────────────────────────

info "Manifest aanmaken..."

MANIFEST_FILE="${BACKUP_DIR}/manifest.json"

# Bouw het manifest op met alle backup-bestanden en hun metadata
MANIFEST_ENTRIES=""

add_manifest_entry() {
  local file_path="${1}"
  local file_type="${2}"
  local file_name
  file_name="$(basename "${file_path}")"

  if [ -f "${file_path}" ] && [ -s "${file_path}" ]; then
    local file_size
    file_size="$(stat -f%z "${file_path}" 2>/dev/null || stat -c%s "${file_path}" 2>/dev/null || echo 0)"
    local file_sha256
    file_sha256="$(sha256_file "${file_path}")"

    # Voeg komma toe als dit niet de eerste entry is
    if [ -n "${MANIFEST_ENTRIES}" ]; then
      MANIFEST_ENTRIES="${MANIFEST_ENTRIES},"
    fi

    MANIFEST_ENTRIES="${MANIFEST_ENTRIES}
    {
      \"name\": \"${file_name}\",
      \"type\": \"${file_type}\",
      \"size_bytes\": ${file_size},
      \"sha256\": \"${file_sha256}\"
    }"
  fi
}

add_manifest_entry "${PG_BACKUP_FILE:-}" "postgresql_dump"
add_manifest_entry "${SQLITE_BACKUP_FILE:-}" "sqlite_database"
add_manifest_entry "${OLLAMA_BACKUP_FILE:-}" "ollama_models"
add_manifest_entry "${ENV_BACKUP_FILE:-}" "env_config"

cat > "${MANIFEST_FILE}" <<EOF
{
  "version": "${APP_VERSION}",
  "timestamp": "${TIMESTAMP}",
  "created_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "database_type": "${DB_TYPE}",
  "retention_days": ${RETENTION_DAYS},
  "files": [${MANIFEST_ENTRIES}
  ]
}
EOF

MANIFEST_SHA256=$(sha256_file "${MANIFEST_FILE}")
info "Manifest aangemaakt: ${MANIFEST_FILE}"
info "Manifest SHA256: ${MANIFEST_SHA256}"

# ──────────────────────────────────────────────
# Retentie — Verwijder oude backups
# ──────────────────────────────────────────────

info "Retentie-controle: behoud laatste ${RETENTION_DAYS} dagen aan backups..."

DELETED_COUNT=0
if [ -d "${OUTPUT_DIR}" ]; then
  while IFS= read -r old_backup_dir; do
    if [ -d "${old_backup_dir}" ]; then
      OLD_DIR_NAME="$(basename "${old_backup_dir}")"
      # Parseer de timestamp uit de directorynaam (formaat: YYYYMMDD_HHMMSS)
      OLD_DATE_STR="${OLD_DIR_NAME:0:8}"
      OLD_EPOCH="$(date -d "${OLD_DATE_STR}" +%s 2>/dev/null || echo 0)"
      CUTOFF_EPOCH="$(date -d "${RETENTION_DAYS} days ago" +%s 2>/dev/null || echo 0)"

      if [ "${OLD_EPOCH}" -gt 0 ] && [ "${OLD_EPOCH}" -lt "${CUTOFF_EPOCH}" ]; then
        info "Oude backup verwijderen: ${old_backup_dir}"
        rm -rf "${old_backup_dir}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
      fi
    fi
  done < <(find "${OUTPUT_DIR}" -mindepth 1 -maxdepth 1 -type d -name "20*" 2>/dev/null | sort)
fi

if [ "${DELETED_COUNT}" -gt 0 ]; then
  info "${DELETED_COUNT} oude backup(s) verwijderd (ouder dan ${RETENTION_DAYS} dagen)"
else
  info "Geen oude backups om te verwijderen"
fi

# ──────────────────────────────────────────────
# Samenvatting
# ──────────────────────────────────────────────

TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "onbekend")

info "=========================================="
info "SEOCoach Backup — Voltooid"
info "=========================================="
info "Backup locatie: ${BACKUP_DIR}"
info "Totale grootte: ${TOTAL_SIZE}"
info "Database type:  ${DB_TYPE}"
info "Manifest:       ${MANIFEST_FILE}"
info "=========================================="
