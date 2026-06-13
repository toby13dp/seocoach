#!/usr/bin/env bash
# ============================================================================
# SEOCoach — Restore Script (BACKUP-002)
# ============================================================================
# Herstelt een SEOCoach backup:
#   - Valideert backup directory en manifest
#   - Verifieert SHA256 checksums van alle bestanden
#   - Stopt de applicatie veilig
#   - Herstelt PostgreSQL of SQLite database
#   - Herstart de applicatie en controleert health
#
# Gebruik:
#   ./scripts/restore.sh BACKUP_DIR
#   ./scripts/restore.sh ./backups/20250101_020000
#   ./scripts/restore.sh --dry-run ./backups/20250101_020000
#
# Let op: Dit script is destructief — bestaande data wordt overschreven!
# ============================================================================

set -euo pipefail

# ──────────────────────────────────────────────
# Configuratie
# ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-seocoach}"
DRY_RUN=false

# PostgreSQL configuratie (uit omgevingsvariabelen of defaults)
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-seocoach}"
POSTGRES_USER="${POSTGRES_USER:-seocoach}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-seocoach_password}"

# SQLite pad
SQLITE_DB_PATH="${PROJECT_DIR}/db/custom.db"

# ──────────────────────────────────────────────
# Argumenten verwerken
# ──────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Gebruik: $0 [--dry-run] BACKUP_DIR"
  echo ""
  echo "Argumenten:"
  echo "  --dry-run    Simuleer de restore zonder wijzigingen door te voeren"
  echo "  BACKUP_DIR   Pad naar de backup directory (bevat manifest.json)"
  echo ""
  echo "Voorbeeld:"
  echo "  $0 ./backups/20250101_020000"
  echo "  $0 --dry-run ./backups/20250101_020000"
  exit 1
fi

# Controleer op --dry-run flag
if [ "${1}" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi

BACKUP_DIR="$(cd "${1}" 2>/dev/null && pwd)" || {
  echo "FOUT: Backup directory bestaat niet: ${1}"
  exit 1
}

# ──────────────────────────────────────────────
# Hulpfuncties
# ──────────────────────────────────────────────

log() {
  local level="${1}"
  local message="${2}"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${timestamp}] [${level}] ${message}"
}

info()     { log "INFO"  "${1}"; }
warn()     { log "WARN"  "${1}"; }
error()    { log "ERROR" "${1}"; }
dry_info() { if [ "${DRY_RUN}" = true ]; then log "DRY-RUN" "${1}"; else info "${1}"; fi; }

# Bereken SHA256 checksum
sha256_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "${1}" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "${1}" | cut -d' ' -f1
  else
    echo "checksum_unavailable"
  fi
}

# Vraag bevestiging aan de gebruiker
confirm() {
  local message="${1}"
  if [ "${DRY_RUN}" = true ]; then
    info "[DRY-RUN] Zou om bevestiging vragen: ${message}"
    return 0
  fi

  echo ""
  echo "⚠️  ${message}"
  read -r -p "Typ 'ja' om door te gaan, iets anders om af te breken: " response
  if [ "${response}" != "ja" ]; then
    info "Restore geannuleerd door gebruiker"
    exit 0
  fi
}

# Controleer of docker compose actief is
is_compose_running() {
  docker compose ps --format json 2>/dev/null | grep -q "running" || \
  docker ps --format "{{.Names}}" 2>/dev/null | grep -q "seocoach"
}

# ──────────────────────────────────────────────
# Validatie
# ──────────────────────────────────────────────

info "=========================================="
info "SEOCoach Restore — Gestart"
info "=========================================="
info "Backup directory: ${BACKUP_DIR}"
info "Dry run: ${DRY_RUN}"

# Controleer manifest
MANIFEST_FILE="${BACKUP_DIR}/manifest.json"
if [ ! -f "${MANIFEST_FILE}" ]; then
  error "manifest.json niet gevonden in ${BACKUP_DIR}"
  error "Dit is geen geldige SEOCoach backup directory"
  exit 1
fi

info "Manifest gevonden: ${MANIFEST_FILE}"

# Parseer manifest (met python3 of jq)
if command -v python3 &>/dev/null; then
  DB_TYPE=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['database_type'])" 2>/dev/null || echo "unknown")
  BACKUP_VERSION=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['version'])" 2>/dev/null || echo "unknown")
  BACKUP_TIMESTAMP=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['timestamp'])" 2>/dev/null || echo "unknown")
elif command -v jq &>/dev/null; then
  DB_TYPE=$(jq -r '.database_type' "${MANIFEST_FILE}" 2>/dev/null || echo "unknown")
  BACKUP_VERSION=$(jq -r '.version' "${MANIFEST_FILE}" 2>/dev/null || echo "unknown")
  BACKUP_TIMESTAMP=$(jq -r '.timestamp' "${MANIFEST_FILE}" 2>/dev/null || echo "unknown")
else
  warn "python3 of jq niet gevonden — kan manifest niet parsen"
  DB_TYPE="unknown"
  BACKUP_VERSION="unknown"
  BACKUP_TIMESTAMP="unknown"
fi

info "Backup versie: ${BACKUP_VERSION}"
info "Backup timestamp: ${BACKUP_TIMESTAMP}"
info "Database type: ${DB_TYPE}"

# ──────────────────────────────────────────────
# Checksum verificatie
# ──────────────────────────────────────────────

info "Checksum verificatie starten..."

CHECKSUM_ERRORS=0

# Verifieer elk bestand in het manifest
if command -v python3 &>/dev/null; then
  # Haal bestandsnamen en checksums uit manifest
  FILE_COUNT=$(python3 -c "
import json
manifest = json.load(open('${MANIFEST_FILE}'))
print(len(manifest.get('files', [])))
" 2>/dev/null || echo 0)

  for i in $(seq 0 $((FILE_COUNT - 1))); do
    FILE_NAME=$(python3 -c "
import json
manifest = json.load(open('${MANIFEST_FILE}'))
print(manifest['files'][${i}]['name'])
" 2>/dev/null || echo "")
    EXPECTED_SHA256=$(python3 -c "
import json
manifest = json.load(open('${MANIFEST_FILE}'))
print(manifest['files'][${i}]['sha256'])
" 2>/dev/null || echo "")

    if [ -z "${FILE_NAME}" ]; then
      continue
    fi

    FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"
    if [ ! -f "${FILE_PATH}" ]; then
      error "Bestand ontbreekt: ${FILE_NAME}"
      CHECKSUM_ERRORS=$((CHECKSUM_ERRORS + 1))
      continue
    fi

    ACTUAL_SHA256=$(sha256_file "${FILE_PATH}")
    if [ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]; then
      error "Checksum mismatch voor ${FILE_NAME}:"
      error "  Verwacht: ${EXPECTED_SHA256}"
      error "  Werkelijk: ${ACTUAL_SHA256}"
      CHECKSUM_ERRORS=$((CHECKSUM_ERRORS + 1))
    else
      info "✓ ${FILE_NAME} — checksum OK"
    fi
  done
else
  warn "python3 niet beschikbaar — checksum verificatie overgeslagen"
  warn "Installeer python3 voor volledige verificatie"
fi

if [ "${CHECKSUM_ERRORS}" -gt 0 ]; then
  error "${CHECKSUM_ERRORS} checksum fout(en) gevonden!"
  confirm "Er zijn checksum fouten. Wil je toch doorgaan met restore?"
fi

info "Checksum verificatie voltooid"

# ──────────────────────────────────────────────
# Bevestiging vragen
# ──────────────────────────────────────────────

confirm "Dit zal de HUIDIGE database overschrijven met de backup van ${BACKUP_TIMESTAMP}. Doorgaan?"

# ──────────────────────────────────────────────
# Applicatie stoppen
# ──────────────────────────────────────────────

info "Applicatie stoppen..."
if [ "${DRY_RUN}" = true ]; then
  dry_info "Zou uitvoeren: docker compose stop app"
else
  if is_compose_running; then
    docker compose stop app 2>/dev/null || \
    docker stop seocoach-app 2>/dev/null || \
    warn "Kon applicatie niet stoppen — ga toch door"
    info "Applicatie gestopt"
  else
    warn "Geen draaiende Docker containers gevonden"
  fi
fi

# ──────────────────────────────────────────────
# Database restore: PostgreSQL
# ──────────────────────────────────────────────

if [ "${DB_TYPE}" = "postgresql" ]; then
  info "PostgreSQL restore starten..."

  # Zoek het PostgreSQL dump bestand
  PG_DUMP_FILE=$(find "${BACKUP_DIR}" -name "postgres_*.dump" -type f 2>/dev/null | head -1 || true)

  if [ -z "${PG_DUMP_FILE}" ]; then
    error "Geen PostgreSQL dump bestand gevonden in ${BACKUP_DIR}"
    exit 1
  fi

  info "Dump bestand: ${PG_DUMP_FILE}"

  if [ "${DRY_RUN}" = true ]; then
    dry_info "Zou uitvoeren: pg_restore met --clean --if-exists"
  else
    # Restore via Docker Compose
    if docker compose ps postgres 2>/dev/null | grep -q "running\|Up"; then
      info "pg_restore via Docker Compose uitvoeren..."
      PGPASSWORD="${POSTGRES_PASSWORD}" docker compose exec -T postgres \
        pg_restore \
          -U "${POSTGRES_USER}" \
          -d "${POSTGRES_DB}" \
          -h localhost \
          --clean \
          --if-exists \
          --verbose \
          < "${PG_DUMP_FILE}" 2>>"${BACKUP_DIR}/restore.log" || true
    else
      # Lokale pg_restore
      if command -v pg_restore &>/dev/null; then
        info "pg_restore lokaal uitvoeren..."
        PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
          -U "${POSTGRES_USER}" \
          -d "${POSTGRES_DB}" \
          -h "${POSTGRES_HOST}" \
          -p "${POSTGRES_PORT}" \
          --clean \
          --if-exists \
          --verbose \
          "${PG_DUMP_FILE}" 2>>"${BACKUP_DIR}/restore.log" || true
      else
        error "pg_restore niet gevonden en PostgreSQL draait niet in Docker"
        error "Start PostgreSQL of installeer postgresql-client"
        exit 1
      fi
    fi
  fi

  info "PostgreSQL restore voltooid"
fi

# ──────────────────────────────────────────────
# Database restore: SQLite
# ──────────────────────────────────────────────

if [ "${DB_TYPE}" = "sqlite" ]; then
  info "SQLite restore starten..."

  # Zoek het SQLite backup bestand
  SQLITE_BACKUP_FILE=$(find "${BACKUP_DIR}" -name "sqlite_*.db" -type f 2>/dev/null | head -1 || true)

  if [ -z "${SQLITE_BACKUP_FILE}" ]; then
    error "Geen SQLite backup bestand gevonden in ${BACKUP_DIR}"
    exit 1
  fi

  info "Backup bestand: ${SQLITE_BACKUP_FILE}"

  if [ "${DRY_RUN}" = true ]; then
    dry_info "Zou kopiëren: ${SQLITE_BACKUP_FILE} → ${SQLITE_DB_PATH}"
  else
    # Maak een backup van de huidige database (als die bestaat)
    if [ -f "${SQLITE_DB_PATH}" ]; then
      SQLITE_PRE_RESTORE_BACKUP="${SQLITE_DB_PATH}.pre-restore.$(date +%Y%m%d_%H%M%S)"
      info "Huidige database backup naar: ${SQLITE_PRE_RESTORE_BACKUP}"
      cp "${SQLITE_DB_PATH}" "${SQLITE_PRE_RESTORE_BACKUP}"
    fi

    # Kopieer het backup bestand
    cp "${SQLITE_BACKUP_FILE}" "${SQLITE_DB_PATH}"
    info "SQLite database hersteld"
  fi
fi

# ──────────────────────────────────────────────
# .env herstellen (optioneel)
# ──────────────────────────────────────────────

ENV_BACKUP_FILE=$(find "${BACKUP_DIR}" -name "env_*.backup" -type f 2>/dev/null | head -1 || true)

if [ -n "${ENV_BACKUP_FILE}" ]; then
  warn ".env backup gevonden: ${ENV_BACKUP_FILE}"
  warn "Automatische .env restore is UITGESCHAKELD om huidige configuratie te beschermen"
  warn "Herstel .env handmatig als nodig: cp ${ENV_BACKUP_FILE} ${PROJECT_DIR}/.env"
fi

# ──────────────────────────────────────────────
# Applicatie herstarten
# ──────────────────────────────────────────────

info "Applicatie herstarten..."
if [ "${DRY_RUN}" = true ]; then
  dry_info "Zou uitvoeren: docker compose start app"
  dry_info "Zou wachten op health check..."
else
  if is_compose_running; then
    docker compose start app 2>/dev/null || \
    docker start seocoach-app 2>/dev/null || \
    warn "Kon applicatie niet herstarten"
    info "Applicatie herstart commando uitgevoerd"
  else
    warn "Geen Docker Compose project gevonden — start handmatig"
    warn "Voer uit: docker compose up -d"
  fi
fi

# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────

if [ "${DRY_RUN}" = false ]; then
  info "Health check uitvoeren..."

  MAX_RETRIES=30
  RETRY_COUNT=0
  HEALTH_OK=false

  while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))

    if curl -sf http://localhost:3000/api/health/live >/dev/null 2>&1; then
      HEALTH_OK=true
      break
    fi

    info "Wachten op applicatie... (poging ${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 2
  done

  if [ "${HEALTH_OK}" = true ]; then
    info "✓ Applicatie is gezond (health check geslaagd)"
  else
    warn "Health check niet geslaagd na ${MAX_RETRIES} pogingen"
    warn "Controleer de logs: docker compose logs app"
  fi
else
  dry_info "Zou health check uitvoeren: curl -f http://localhost:3000/api/health/live"
fi

# ──────────────────────────────────────────────
# Samenvatting
# ──────────────────────────────────────────────

info "=========================================="
info "SEOCoach Restore — Voltooid"
info "=========================================="
info "Backup directory: ${BACKUP_DIR}"
info "Database type:   ${DB_TYPE}"
info "Dry run:         ${DRY_RUN}"
info "Health check:    ${HEALTH_OK:-N/A (dry-run)}"
info "=========================================="

if [ "${DRY_RUN}" = false ]; then
  info "Controleer de applicatie: curl http://localhost:3000/api/health/live"
fi
