# Bidradar Worker

Long-running daemon that polls AWS SQS for file download tasks, fetches files from CEF (using plain HTTP or Puppeteer browser automation), uploads them to S3, and reports health via API heartbeats.

## Quick install (Ubuntu 24)

The `install.sh` script handles everything: installs Node.js 22, Chrome/Chromium (based on architecture), creates the system user, deploys the bundle, configures credentials, and sets up the systemd service.

On your **development machine**, build the worker:

```bash
pnpm install && pnpm build
```

Copy the worker to the VM:

```bash
scp -r apps/worker/dist apps/worker/install.sh user@vm:/tmp/bidradar-worker/
```

On the **VM**, run the installer:

```bash
cd /tmp/bidradar-worker
sudo ./install.sh
```

The script will interactively prompt for all required credentials (AWS keys, SQS queue URL, S3 bucket, API URL, API key) and optional settings (worker ID, log level).

## Manual setup

If you prefer to install manually, follow the steps below.

### 1. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should print v22.x
```

### 2. Install a Chromium-based browser (needed for browser-based downloads)

**x86_64 (amd64):**

```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable
```

**ARM64 (aarch64):** Chrome does not ship ARM64 Linux builds. Install Chromium instead:

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
```

The worker auto-detects both (`/usr/bin/google-chrome`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`).

### 3. Create the bidradar user and directory

```bash
sudo useradd --system --create-home --shell /bin/bash bidradar
sudo mkdir -p /opt/bidradar/worker/dist
sudo chown -R bidradar:bidradar /opt/bidradar
```

### 4. Deploy the worker bundle

On your **development machine**, build the worker:

```bash
cd ~/Projects/bidradar
pnpm install
pnpm build
```

Then copy the bundle to the VM:

```bash
scp apps/worker/dist/index.js user@vm:/tmp/bidradar-worker.js
```

On the **VM**, move the file into place:

```bash
sudo mv /tmp/bidradar-worker.js /opt/bidradar/worker/dist/index.js
sudo chown -R bidradar:bidradar /opt/bidradar
```

### 5. Configure AWS credentials

The worker needs AWS credentials for SQS and S3. Preferred approach is an IAM instance profile on EC2. If not on EC2, configure credentials manually:

```bash
sudo -u bidradar mkdir -p /home/bidradar/.aws

sudo tee /home/bidradar/.aws/credentials > /dev/null << 'EOF'
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
EOF

sudo chown -R bidradar:bidradar /home/bidradar/.aws
sudo chmod 600 /home/bidradar/.aws/credentials
```

### 6. Create the environment file

```bash
sudo tee /opt/bidradar/.env.worker > /dev/null << 'EOF'
# Required
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT/CefDownloadQueue
BUCKET_NAME=your-bidradar-bucket
BIDRADAR_API_URL=https://your-api-url.lambda-url.us-east-1.on.aws
BIDRADAR_API_KEY=br_your-api-key-here

# Optional
AWS_REGION=us-east-1
WORKER_ID=worker-ubuntu-01
RATE_LIMIT_DELAY_MS=1000
LOG_LEVEL=INFO
EOF

sudo chmod 600 /opt/bidradar/.env.worker
sudo chown bidradar:bidradar /opt/bidradar/.env.worker
```

### 7. Install and enable the systemd service

```bash
sudo cp bidradar-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bidradar-worker
sudo systemctl start bidradar-worker
```

### 8. Verify it's running

```bash
# Check service status
sudo systemctl status bidradar-worker

# Follow logs in real time
sudo journalctl -u bidradar-worker -f

# Check if heartbeats are reaching the API
curl -H "Authorization: Bearer YOUR_JWT" https://your-api-url/worker/status
```

## Quick reference

| Action | Command |
|---|---|
| Start | `sudo systemctl start bidradar-worker` |
| Stop | `sudo systemctl stop bidradar-worker` |
| Restart | `sudo systemctl restart bidradar-worker` |
| Logs (follow) | `sudo journalctl -u bidradar-worker -f` |
| Logs (last 100) | `sudo journalctl -u bidradar-worker -n 100` |
| Status | `sudo systemctl status bidradar-worker` |

The service is configured with `Restart=always` and `RestartSec=10`, so it automatically restarts on crash. It handles SIGTERM gracefully (finishes current message, sends shutdown heartbeat, then exits).

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQS_QUEUE_URL` | Yes | — | AWS SQS queue URL for download tasks |
| `BUCKET_NAME` | Yes | — | S3 bucket for file uploads |
| `BIDRADAR_API_URL` | Yes | — | API base URL for metadata and heartbeats |
| `BIDRADAR_API_KEY` | Yes | — | API key for authentication (`X-API-Key` header) |
| `AWS_REGION` | No | `us-east-1` | AWS region for SQS and S3 |
| `WORKER_ID` | No | `os.hostname()` | Unique identifier reported in heartbeats |
| `RATE_LIMIT_DELAY_MS` | No | `1000` | Delay (ms) between message completions |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`, `INFO`, `WARN`, or `ERROR` |
