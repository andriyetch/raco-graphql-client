#!/bin/bash

# RA.co Event Monitor - Initial Server Setup Script
# This script sets up the event monitor on a fresh Ubuntu server
# 
# IMPORTANT: This script is for INITIAL SETUP ONLY.
# After running this script, use 'npm run server' to run the application.

set -e

echo "🚀 RA.co Event Monitor Deployment Script"
echo "========================================"

# Check if running as root (optional warning)
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  Running as root user (this is fine for DigitalOcean droplets)"
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed"
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Install SQLite
echo "📦 Installing SQLite..."
sudo apt install -y sqlite3

# Create application directory
if [[ $EUID -eq 0 ]]; then
    APP_DIR="/root/ra-event-monitor"
else
    APP_DIR="$HOME/ra-event-monitor"
fi

echo "📁 Setting up application directory: $APP_DIR"

if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
fi

cd "$APP_DIR"

# Copy application files (assuming they're in the current directory)
echo "📋 Copying application files..."
cp -r . "$APP_DIR/"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup environment file
if [ ! -f ".env" ]; then
    echo "⚙️  Setting up environment configuration..."
    cp env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file with your Pushover credentials:"
    echo "   nano .env"
    echo ""
    echo "   You need to set:"
    echo "   - PUSHOVER_USER_KEY=your_user_key"
    echo "   - PUSHOVER_APP_TOKEN=your_app_token"
    echo ""
    read -p "Press Enter after you've configured .env file..."
else
    echo "✅ Environment file already exists"
fi

# Setup configuration
if [ ! -f "config.json" ]; then
    echo "⚙️  Setting up configuration..."
    echo ""
    echo "⚠️  Please edit config.json with your artists and location:"
    echo "   nano config.json"
    echo ""
    echo "   You need to set:"
    echo "   - location.areaId (e.g., 13 for London)"
    echo "   - artists array with your monitored artists"
    echo ""
    read -p "Press Enter after you've configured config.json..."
else
    echo "✅ Configuration file already exists"
fi

# Test the application
echo "🧪 Testing application..."
if node server.js --test &> /dev/null; then
    echo "✅ Application test passed"
else
    echo "⚠️  Application test failed, but continuing..."
fi

# Setup PM2
echo "⚙️  Setting up PM2..."
pm2 start server.js --name "ra-event-monitor"
pm2 save
pm2 startup

echo ""
echo "🎉 Initial setup completed!"
echo "==========================="
echo ""
echo "📊 Dashboard: http://$(hostname -I | awk '{print $1}'):3000"
echo "🔍 Health Check: http://$(hostname -I | awk '{print $1}'):3000/health"
echo ""
echo "🚀 To run the server:"
echo "   npm run server               # Production mode"
echo "   npm run dev                  # Development mode with auto-restart"
echo "   node server.js               # Direct execution"
echo ""
echo "📱 PM2 Commands (if using PM2):"
echo "   pm2 status                    # Check status"
echo "   pm2 logs ra-event-monitor     # View logs"
echo "   pm2 restart ra-event-monitor  # Restart service"
echo "   pm2 stop ra-event-monitor     # Stop service"
echo ""
echo "🔧 Configuration:"
echo "   Edit config.json to change artists/location"
echo "   Edit .env to change Pushover settings"
echo ""
echo "📈 Monitoring:"
echo "   pm2 monit                     # Real-time monitoring (if using PM2)"
echo "   tail -f ~/.pm2/logs/ra-event-monitor-out.log  # Application logs (if using PM2)"
echo ""
echo "✅ Your RA.co Event Monitor is now ready to run!"
