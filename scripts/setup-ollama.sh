#!/usr/bin/env bash
# ============================================================================
# SEOCoach — Ollama Setup Script
# ============================================================================
# Installeert en configureert Ollama met aanbevolen modellen voor SEOCoach:
#   - llama3.1 (standaard chat model)
#   - nomic-embed-text (embeddings model)
#
# Detecteert automatisch of Ollama in Docker of lokaal draait.
#
# Gebruik:
#   ./scripts/setup-ollama.sh
# ============================================================================

set -euo pipefail

# ──────────────────────────────────────────────
# Configuratie
# ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Aanbevolen modellen voor SEOCoach
DEFAULT_MODEL="llama3.1"
EMBEDDING_MODEL="nomic-embed-text"

# Modelgroottes (bij benadering, na download)
DEFAULT_MODEL_SIZE="4.7 GB"
EMBEDDING_MODEL_SIZE="274 MB"
TOTAL_REQUIRED_SIZE="~5.0 GB"

# Ollama URL
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

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

info()  { log "INFO"  "${1}"; }
warn()  { log "WARN"  "${1}"; }
error() { log "ERROR" "${1}"; }

# Toon een voortgangsindicator
spinner() {
  local pid="${1}"
  local message="${2}"
  local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

  while kill -0 "${pid}" 2>/dev/null; do
    for i in $(seq 0 9); do
      echo -ne "\r${spin:${i}:1} ${message}..."
      sleep 0.1
    done
  done
  echo -ne "\r✓ ${message}... voltooid    \n"
}

# Controleer beschikbare schijfruimte
check_disk_space() {
  local required_gb="${1}"
  local path="${2:-.}"

  if command -v df &>/dev/null; then
    local available_kb
    available_kb=$(df -k "${path}" | tail -1 | awk '{print $4}')
    local available_gb=$((available_kb / 1024 / 1024))

    info "Beschikbare schijfruimte: ${available_gb} GB"

    if [ "${available_gb}" -lt "${required_gb}" ]; then
      warn "Mogelijk onvoldoende schijfruimte! Vereist: ~${required_gb} GB, Beschikbaar: ${available_gb} GB"
      return 1
    fi
    return 0
  fi
  warn "Kon schijfruimte niet bepalen"
  return 0
}

# Wacht tot Ollama beschikbaar is
wait_for_ollama() {
  local url="${1}"
  local max_retries=30
  local retry_count=0

  info "Wachten op Ollama service op ${url}..."

  while [ ${retry_count} -lt ${max_retries} ]; do
    retry_count=$((retry_count + 1))

    if curl -sf "${url}/api/version" >/dev/null 2>&1; then
      local version
      version=$(curl -sf "${url}/api/version" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown")
      info "Ollama is beschikbaar (versie: ${version})"
      return 0
    fi

    info "Wachten op Ollama... (poging ${retry_count}/${max_retries})"
    sleep 2
  done

  error "Ollama niet beschikbaar na ${max_retries} pogingen"
  return 1
}

# Pull een model met voortgangsweergave
pull_model() {
  local url="${1}"
  local model="${2}"
  local expected_size="${3}"

  info "Model '${model}' pullen (verwachte grootte: ${expected_size})..."

  # Controleer of het model al beschikbaar is
  if curl -sf "${url}/api/show" -d "{\"name\":\"${model}\"}" 2>/dev/null | grep -q "name"; then
    info "Model '${model}' is al beschikbaar — overslaan"
    return 0
  fi

  info "Dit kan enkele minuten duren, afhankelijk van je internetverbinding..."

  # Pull het model (stream de voortgang)
  curl -sf "${url}/api/pull" -d "{\"name\":\"${model}\"}" 2>/dev/null | while IFS= read -r line; do
    if echo "${line}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    status = data.get('status', '')
    if 'total' in data and 'completed' in data:
        total = data['total']
        completed = data['completed']
        pct = (completed / total) * 100 if total > 0 else 0
        print(f'  Voortgang: {pct:.1f}% ({status})')
    else:
        print(f'  Status: {status}')
except:
    pass
" 2>/dev/null; then
      : # output al afgehandeld
    fi
  done

  # Verifieer dat het model beschikbaar is
  if curl -sf "${url}/api/show" -d "{\"name\":\"${model}\"}" 2>/dev/null | grep -q "name"; then
    info "✓ Model '${model}' succesvol geïnstalleerd"
    return 0
  else
    warn "Kon installatie van model '${model}' niet verifiëren"
    return 1
  fi
}

# ──────────────────────────────────────────────
# Detectie: Docker of lokaal
# ──────────────────────────────────────────────

info "=========================================="
info "SEOCoach — Ollama Setup"
info "=========================================="
info ""

# Bepaal of Ollama in Docker draait
OLLAMA_MODE="unknown"
OLLAMA_CMD=""

# Controleer Docker Compose
if [ -f "${PROJECT_DIR}/docker-compose.yml" ]; then
  if docker compose ps ollama 2>/dev/null | grep -q "running\|Up"; then
    OLLAMA_MODE="docker-compose"
    OLLAMA_CMD="docker compose exec -T ollama ollama"
    OLLAMA_URL="http://localhost:11434"
    info "✓ Ollama draait in Docker Compose"
  fi
fi

# Controleer standalone Docker
if [ "${OLLAMA_MODE}" = "unknown" ]; then
  if docker ps --filter "name=ollama" --format "{{.Names}}" 2>/dev/null | grep -q "ollama"; then
    OLLAMA_MODE="docker-standalone"
    OLLAMA_CMD="docker exec ollama ollama"
    OLLAMA_URL="http://localhost:11434"
    info "✓ Ollama draait in standalone Docker container"
  fi
fi

# Controleer lokaal geïnstalleerde Ollama
if [ "${OLLAMA_MODE}" = "unknown" ]; then
  if command -v ollama &>/dev/null; then
    OLLAMA_MODE="native"
    OLLAMA_CMD="ollama"
    OLLAMA_URL="http://localhost:11434"
    info "✓ Ollama is lokaal geïnstalleerd"
  fi
fi

# Als Ollama nergens gevonden is, bied opties aan
if [ "${OLLAMA_MODE}" = "unknown" ]; then
  warn "Ollama is niet geïnstalleerd of draait niet"

  echo ""
  echo "Installatie-opties:"
  echo "───────────────────────────────────────────────────"
  echo "1. Lokaal installeren (aanbevolen voor ontwikkeling):"
  echo "   curl -fsSL https://ollama.com/install.sh | sh"
  echo "   ollama serve &"
  echo ""
  echo "2. Via Docker Compose (aanbevolen voor productie):"
  echo "   cd ${PROJECT_DIR}"
  echo "   docker compose up -d ollama"
  echo ""
  echo "3. Handmatig Docker:"
  echo "   docker run -d --name ollama -v ollama-data:/root/.ollama -p 11434:11434 ollama/ollama"
  echo "───────────────────────────────────────────────────"
  echo ""

  read -r -p "Wil je Ollama lokaal installeren? (j/n): " install_choice
  if [ "${install_choice}" = "j" ] || [ "${install_choice}" = "y" ]; then
    info "Ollama installeren..."
    curl -fsSL https://ollama.com/install.sh | sh
    OLLAMA_MODE="native"
    OLLAMA_CMD="ollama"

    info "Ollama service starten..."
    ollama serve &
    sleep 5
  else
    error "Ollama is vereist voor AI-functionaliteit. Installeer het en voer dit script opnieuw uit."
    exit 1
  fi
fi

info ""
info "Ollama modus: ${OLLAMA_MODE}"
info "Ollama URL: ${OLLAMA_URL}"
info ""

# ──────────────────────────────────────────────
# Schijfruimte controleren
# ──────────────────────────────────────────────

info "Schijfruimte controleren..."
info "Vereiste ruimte voor modellen: ${TOTAL_REQUIRED_SIZE}"

check_disk_space 6 "${PROJECT_DIR}" || {
  warn "Onvoldoende schijfruimte gedetecteerd — doorgaan op eigen risico"
  read -r -p "Toch doorgaan? (j/n): " continue_choice
  if [ "${continue_choice}" != "j" ] && [ "${continue_choice}" != "y" ]; then
    info "Afgebroken door gebruiker"
    exit 0
  fi
}

info ""

# ──────────────────────────────────────────────
# Wachten op Ollama
# ──────────────────────────────────────────────

if ! wait_for_ollama "${OLLAMA_URL}"; then
  error "Kan geen verbinding maken met Ollama op ${OLLAMA_URL}"

  if [ "${OLLAMA_MODE}" = "docker-compose" ]; then
    info "Probeer Ollama container te starten..."
    docker compose up -d ollama
    sleep 10
    wait_for_ollama "${OLLAMA_URL}" || {
      error "Ollama start niet — controleer de logs: docker compose logs ollama"
      exit 1
    }
  else
    exit 1
  fi
fi

info ""

# ──────────────────────────────────────────────
# Modellen installeren
# ──────────────────────────────────────────────

info "Aanbevolen modellen installeren voor SEOCoach..."
info ""

# Standaard chat model: llama3.1
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Model 1/2: ${DEFAULT_MODEL} (standaard chat model)"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Gebruik: Content generatie, SEO-analyse, tekstsuggesties"
info "Grootte: ${DEFAULT_MODEL_SIZE}"
info ""

pull_model "${OLLAMA_URL}" "${DEFAULT_MODEL}" "${DEFAULT_MODEL_SIZE}"

info ""

# Embedding model: nomic-embed-text
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Model 2/2: ${EMBEDDING_MODEL} (embedding model)"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Gebruik: Semantisch zoeken, content-clustering, vergelijkbare pagina's vinden"
info "Grootte: ${EMBEDDING_MODEL_SIZE}"
info ""

pull_model "${OLLAMA_URL}" "${EMBEDDING_MODEL}" "${EMBEDDING_MODEL_SIZE}"

info ""

# ──────────────────────────────────────────────
# Geïnstalleerde modellen tonen
# ──────────────────────────────────────────────

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Geïnstalleerde modellen"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "${OLLAMA_MODE}" = "native" ]; then
  ollama list 2>/dev/null || curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for model in data.get('models', []):
        size_gb = model.get('size', 0) / (1024**3)
        print(f'  {model[\"name\"]:30s} {size_gb:.1f} GB')
except:
    print('  Kon modellen niet ophalen')
" 2>/dev/null || warn "Kon modellen niet weergeven"
elif [ "${OLLAMA_MODE}" = "docker-compose" ]; then
  docker compose exec -T ollama ollama list 2>/dev/null || \
  curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for model in data.get('models', []):
        size_gb = model.get('size', 0) / (1024**3)
        print(f'  {model[\"name\"]:30s} {size_gb:.1f} GB')
except:
    print('  Kon modellen niet ophalen')
" 2>/dev/null || warn "Kon modellen niet weergeven"
elif [ "${OLLAMA_MODE}" = "docker-standalone" ]; then
  docker exec ollama ollama list 2>/dev/null || warn "Kon modellen niet weergeven"
fi

# ──────────────────────────────────────────────
# Samenvatting
# ──────────────────────────────────────────────

info ""
info "=========================================="
info "SEOCoach — Ollama Setup Voltooid"
info "=========================================="
info "Ollama modus: ${OLLAMA_MODE}"
info "Chat model:   ${DEFAULT_MODEL}"
info "Embed model:  ${EMBEDDING_MODEL}"
info "Ollama URL:   ${OLLAMA_URL}"
info ""
info "Gebruik in SEOCoach:"
info "  Project → AI-providers → Provider toevoegen"
info "  Type: Ollama"
info "  Base URL: ${OLLAMA_URL}"
info "  API Key: (leeg laten)"
info "=========================================="
