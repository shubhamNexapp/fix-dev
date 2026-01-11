#!/bin/bash

# Fix JWT Secret Mismatch Script
# This script updates the Node.js JWT_SECRET to match Java Auth Service

echo "======================================"
echo "JWT Secret Synchronization Script"
echo "======================================"
echo ""

# Java Auth JWT Secret (from jauth-main/.env)
JAVA_JWT_SECRET="xXbeJ9A1aU3vpD1YKHQ7tBqvOYlZqZet0pywMSHW3D4QEdDdIqnp244kqTxYjn7b1HxgfHR2Sbi6qupfAA123456"

# Current Node.js JWT Secret
CURRENT_NODE_SECRET=$(grep "^JWT_SECRET=" .env | cut -d '=' -f 2-)

echo "Current Node.js JWT_SECRET:"
echo "$CURRENT_NODE_SECRET"
echo ""
echo "Java Auth JWT_SECRET:"
echo "$JAVA_JWT_SECRET"
echo ""

if [ "$CURRENT_NODE_SECRET" == "$JAVA_JWT_SECRET" ]; then
    echo "✅ JWT secrets already match! No action needed."
    exit 0
fi

echo "⚠️  JWT secrets DO NOT MATCH!"
echo ""
echo "This will cause authentication failures when React Native app"
echo "sends Java Auth tokens to Node.js APIs."
echo ""
read -p "Do you want to update Node.js JWT_SECRET to match Java Auth? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled. No changes made."
    exit 1
fi

# Backup .env file
echo ""
echo "📦 Creating backup: .env.backup"
cp .env .env.backup

# Update JWT_SECRET
echo "🔧 Updating JWT_SECRET in .env..."
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JAVA_JWT_SECRET|" .env

# Verify update
NEW_SECRET=$(grep "^JWT_SECRET=" .env | cut -d '=' -f 2-)

if [ "$NEW_SECRET" == "$JAVA_JWT_SECRET" ]; then
    echo "✅ JWT_SECRET successfully updated!"
    echo ""
    echo "📝 Summary:"
    echo "   - Backup saved: .env.backup"
    echo "   - JWT_SECRET now matches Java Auth"
    echo ""
    echo "⚠️  IMPORTANT: Restart Node.js service for changes to take effect"
    echo "   Run: npm run dev"
else
    echo "❌ Update failed! Please manually edit .env file."
    echo "   Set JWT_SECRET=$JAVA_JWT_SECRET"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Synchronization Complete!"
echo "======================================"
