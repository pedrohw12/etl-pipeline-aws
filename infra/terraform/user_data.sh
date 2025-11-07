#!/bin/bash
set -euo pipefail

exec > >(tee -a /var/log/user-data.log) 2>&1
echo "[user-data] Starting bootstrap on $(date)"

dnf update -y
dnf install -y git

# Install Node.js 20 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Optional: install PM2 to manage the app process
npm install -g pm2

echo "[user-data] Node version: $(node -v)"
echo "[user-data] NPM version: $(npm -v)"

# Placeholder: deploy your app code here (git clone, copy from S3, etc.)
# Example (uncomment and customize):
# git clone https://github.com/your-org/your-repo.git /opt/app
# cd /opt/app
# npm ci --only=production
# pm2 start "npm run start:prod" --name portfolio-app
# pm2 startup systemd
# pm2 save

echo "[user-data] Bootstrap complete on $(date)"


