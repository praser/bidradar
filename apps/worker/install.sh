#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/bidradar"
SERVICE_USER="bidradar"
SERVICE_NAME="bidradar-worker"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_FILE="${SCRIPT_DIR}/dist/index.js"

# ── Helpers ─────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

prompt() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  local value
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "${BOLD}${prompt_text}${NC} [${default}]: ")" value
    value="${value:-$default}"
  else
    while true; do
      read -rp "$(echo -e "${BOLD}${prompt_text}${NC}: ")" value
      [[ -n "$value" ]] && break
      error "This field is required."
    done
  fi
  eval "$var_name=\"\$value\""
}

prompt_secret() {
  local var_name="$1" prompt_text="$2"
  local value
  while true; do
    read -srp "$(echo -e "${BOLD}${prompt_text}${NC}: ")" value
    echo
    [[ -n "$value" ]] && break
    error "This field is required."
  done
  eval "$var_name=\"\$value\""
}

# ── Pre-flight checks ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (sudo)."
  exit 1
fi

if [[ ! -f "$BUNDLE_FILE" ]]; then
  error "Worker bundle not found at ${BUNDLE_FILE}"
  echo "  Build the worker first:  pnpm build"
  echo "  Then re-run this script."
  exit 1
fi

ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$ARCH" in
  amd64|x86_64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    error "Unsupported architecture: ${ARCH}"
    exit 1
    ;;
esac

echo
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Bidradar Worker — Install Script       ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Architecture: ${CYAN}${ARCH}${NC}${BOLD}                            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}App-level env vars (SQS_QUEUE_URL, BUCKET_NAME, BIDRADAR_API_URL,${NC}"
echo -e "${CYAN}BIDRADAR_API_KEY) are loaded from SSM Parameter Store at runtime.${NC}"
echo -e "${CYAN}Make sure they exist under /bidradar/{stage}/env/ in your AWS account.${NC}"
echo

# ── 1. Install Node.js 22 ──────────────────────────────────────────
if command -v node &>/dev/null && node --version | grep -q "^v22\."; then
  success "Node.js $(node --version) already installed"
else
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  success "Node.js $(node --version) installed"
fi

# ── 2. Install Chrome / Chromium ────────────────────────────────────
if [[ "$ARCH" == "amd64" ]]; then
  if command -v google-chrome &>/dev/null; then
    success "Google Chrome already installed"
  else
    info "Installing Google Chrome (amd64)..."
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list
    apt-get update -qq
    apt-get install -y google-chrome-stable
    success "Google Chrome installed"
  fi
else
  if command -v chromium-browser &>/dev/null || command -v chromium &>/dev/null; then
    success "Chromium already installed"
  else
    info "Installing Chromium (arm64)..."
    apt-get update -qq
    apt-get install -y chromium-browser
    success "Chromium installed"
  fi
fi

# ── 3. Create user and directories ─────────────────────────────────
if id "$SERVICE_USER" &>/dev/null; then
  success "User '${SERVICE_USER}' already exists"
else
  info "Creating system user '${SERVICE_USER}'..."
  useradd --system --create-home --shell /bin/bash "$SERVICE_USER"
  success "User '${SERVICE_USER}' created"
fi

info "Creating directories..."
mkdir -p "${INSTALL_DIR}/worker/dist"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
success "Directories ready at ${INSTALL_DIR}"

# ── 4. Deploy worker bundle ──────────────────────────────────────────
info "Copying worker bundle..."
cp "$BUNDLE_FILE" "${INSTALL_DIR}/worker/dist/index.js"
chown "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/worker/dist/index.js"
success "Worker bundle deployed"

# ── 5. Collect configuration ──────────────────────────────────────────
echo
echo -e "${BOLD}── AWS Credentials ──${NC}"
echo

prompt        AWS_REGION           "AWS region"                       "us-east-1"
prompt_secret AWS_ACCESS_KEY_ID    "AWS access key ID"
prompt_secret AWS_SECRET_ACCESS_KEY "AWS secret access key"

echo
echo -e "${BOLD}── Environment ──${NC}"
echo

prompt        BIDRADAR_ENV         "SST stage (staging or prod)"      "staging"

echo
echo -e "${BOLD}── Worker Settings ──${NC}"
echo

prompt        WORKER_ID            "Worker ID"                        "$(hostname)"
prompt        RATE_LIMIT_DELAY_MS  "Rate limit delay (ms)"            "1000"
prompt        LOG_LEVEL            "Log level (DEBUG/INFO/WARN/ERROR)" "INFO"

# ── 6. Configure AWS credentials ───────────────────────────────────
info "Configuring AWS credentials..."

AWS_DIR="/home/${SERVICE_USER}/.aws"
mkdir -p "$AWS_DIR"

cat > "${AWS_DIR}/credentials" << EOF
[default]
aws_access_key_id = ${AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}
EOF

cat > "${AWS_DIR}/config" << EOF
[default]
region = ${AWS_REGION}
EOF

chown -R "${SERVICE_USER}:${SERVICE_USER}" "$AWS_DIR"
chmod 700 "$AWS_DIR"
chmod 600 "${AWS_DIR}/credentials" "${AWS_DIR}/config"
success "AWS credentials configured"

# ── 7. Install systemd service ──────────────────────────────────────
info "Installing systemd service..."

cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Bidradar Download Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/worker/dist/index.js
Restart=always
RestartSec=10
Environment=BIDRADAR_ENV=${BIDRADAR_ENV}
Environment=WORKER_ID=${WORKER_ID}
Environment=RATE_LIMIT_DELAY_MS=${RATE_LIMIT_DELAY_MS}
Environment=LOG_LEVEL=${LOG_LEVEL}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
success "Service installed and enabled"

# ── 8. Start the service ────────────────────────────────────────────
info "Starting ${SERVICE_NAME}..."
systemctl start "$SERVICE_NAME"

sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
  success "Service is running"
else
  warn "Service may have failed to start. Check logs:"
  echo "  sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

# ── Done ────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         Installation complete!                ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo
echo "  Useful commands:"
echo "    sudo systemctl status  ${SERVICE_NAME}"
echo "    sudo systemctl restart ${SERVICE_NAME}"
echo "    sudo systemctl stop    ${SERVICE_NAME}"
echo "    sudo journalctl -u ${SERVICE_NAME} -f"
echo
