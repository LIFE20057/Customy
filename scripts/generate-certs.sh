#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-certs.sh – Generate a self-signed SSL certificate for Customy.
# Run once before starting with HTTPS.
# Usage: bash scripts/generate-certs.sh [hostname]
# ─────────────────────────────────────────────────────────────────────────────

HOSTNAME=${1:-"customy.local"}
CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

echo "🔐 Generating self-signed certificate for: $HOSTNAME"
echo "   Output: $CERT_DIR/cert.pem + key.pem"
echo ""

openssl req -x509 -nodes \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/key.pem" \
  -out    "$CERT_DIR/cert.pem" \
  -days   365 \
  -subj   "/C=US/ST=Local/L=Local/O=Customy/CN=$HOSTNAME" \
  -addext "subjectAltName=DNS:$HOSTNAME,DNS:localhost,IP:127.0.0.1"

echo ""
echo "✅ Certificate generated:"
echo "   cert.pem – $CERT_DIR/cert.pem"
echo "   key.pem  – $CERT_DIR/key.pem"
echo ""
echo "⚠️  This is a self-signed cert. Browsers will show a security warning."
echo "   For production, use Let's Encrypt (certbot) or your own CA."
echo ""
echo "📋 Next steps:"
echo "   1. Update .env:  CERT_PATH=./certs/cert.pem  KEY_PATH=./certs/key.pem"
echo "   2. Start server: npm start  (or docker compose up)"
echo "   3. Visit:        https://$HOSTNAME:3443"
