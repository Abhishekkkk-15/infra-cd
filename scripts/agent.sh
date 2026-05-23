#!/bin/sh
set -e

TOKEN=""
SERVER=""

# Parse arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --server)
      SERVER="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required"
  exit 1
fi

if [ -z "$SERVER" ]; then
  echo "Error: --server is required"
  exit 1
fi

# Detect OS and Architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64)
    ARCH="amd64"
    ;;
  aarch64|arm64)
    ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  linux)
    OS="linux"
    ;;
  darwin)
    OS="darwin"
    ;;
  *)
    echo "Unsupported operating system: $OS"
    exit 1
    ;;
esac

BINARY_NAME="agent-${OS}-${ARCH}"
# Download from GitHub Releases
DOWNLOAD_URL="https://github.com/abhishekkkk-15/infra-cd/releases/latest/download/${BINARY_NAME}"

# Determine installation path
INSTALL_DIR="/usr/local/bin"
BINARY_PATH="${INSTALL_DIR}/infra-cd-agent"
USE_SUDO=false

if [ ! -w "$INSTALL_DIR" ]; then
  if command -v sudo >/dev/null 2>&1; then
    USE_SUDO=true
  else
    echo "Warning: /usr/local/bin is not writable and sudo is not available. Installing to current directory."
    INSTALL_DIR="."
    BINARY_PATH="./infra-cd-agent"
  fi
fi

echo "Downloading agent binary from ${DOWNLOAD_URL}..."
if [ "$USE_SUDO" = true ]; then
  sudo curl -fsSL -o "${BINARY_PATH}" "${DOWNLOAD_URL}"
  sudo chmod +x "${BINARY_PATH}"
else
  curl -fsSL -o "${BINARY_PATH}" "${DOWNLOAD_URL}"
  chmod +x "${BINARY_PATH}"
fi

# Run the agent using systemd or background process
if [ "$OS" = "linux" ] && command -v systemctl >/dev/null 2>&1 && [ "$USE_SUDO" = true ]; then
  echo "Installing systemd service 'infra-cd-agent'..."
  SERVICE_FILE="[Unit]
Description=Infra-CD Build Agent
After=network.target

[Service]
Type=simple
ExecStart=${BINARY_PATH} --token ${TOKEN} --server ${SERVER}
Restart=always
RestartSec=5
User=$(whoami)

[Install]
WantedBy=multi-user.target"

  echo "$SERVICE_FILE" | sudo tee /etc/systemd/system/infra-cd-agent.service > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable infra-cd-agent
  sudo systemctl restart infra-cd-agent
  echo "✓ Agent installed and started as a systemd service ('infra-cd-agent')."
else
  echo "Running agent in the background..."
  nohup "${BINARY_PATH}" --token "${TOKEN}" --server "${SERVER}" > /dev/null 2>&1 &
  echo "✓ Agent started in the background (PID: $!)."
fi
