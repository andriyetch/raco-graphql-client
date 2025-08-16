# RA.co Event Monitor - Cloud Server

A cloud-based event monitoring service that automatically tracks your favorite artists on RA.co and sends push notifications when new events are found.

## 🚀 Features

- **Automated Monitoring**: Runs every 3 hours to check for new events
- **Push Notifications**: Sends notifications to your phone via Pushover
- **Web Dashboard**: Beautiful web interface to monitor status and manually trigger checks
- **SQLite Database**: Lightweight database to prevent duplicate notifications
- **Multi-Artist Support**: Monitor multiple artists simultaneously
- **Location Filtering**: Focus on events in specific areas
- **REST API**: Full API for integration with other services
- **Health Monitoring**: Built-in health checks and status monitoring

## 📋 Prerequisites

1. **Pushover Account**: Sign up at [pushover.net](https://pushover.net) and get your User Key and App Token
2. **Node.js**: Version 14 or higher
3. **Cloud Server**: Any VPS or cloud provider (DigitalOcean, AWS, etc.)

## 🛠️ Installation

### 1. Clone and Setup

```bash
git clone <your-repo>
cd raco-graphql-client
npm install
```

### 2. Configuration

#### Environment Variables
Copy the example environment file and configure your Pushover credentials:

```bash
cp env.example .env
```

Edit `.env`:
```env
# Pushover Configuration
PUSHOVER_USER_KEY=your_pushover_user_key_here
PUSHOVER_APP_TOKEN=your_pushover_app_token_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_PATH=./events.db
```

#### Artist and Location Configuration
Edit `config.json` to set your monitored artists and location:

```json
{
  "location": {
    "areaId": 13,
    "name": "London"
  },
  "artists": [
    {
      "id": "44361",
      "name": "Rival Consoles"
    },
    {
      "id": "1013", 
      "name": "Seth Troxler"
    }
  ],
  "notificationSettings": {
    "checkIntervalHours": 3,
    "dateRangeDays": 30,
    "includePastDay": true
  }
}
```

### 3. Finding Artist IDs

To find artist IDs on RA.co:
1. Go to the artist's page (e.g., https://ra.co/dj/sethtroxler)
2. Open browser Dev Tools → Network tab
3. Filter by 'graphql'
4. Click "Upcoming Events" on the page
5. Look for the GraphQL request and find the artist ID in the response

### 4. Finding Area IDs

To find area IDs on RA.co:
1. Go to the location page (e.g., https://ra.co/events/uk/london)
2. Open Inspect Element
3. Search for "eventAreaId" or "eventsAreaId" in the HTML

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run server
```

### Using PM2 (Recommended for Production)
```bash
npm install -g pm2
pm2 start server.js --name "ra-event-monitor"
pm2 save
pm2 startup
```

## 📊 Web Dashboard

Once running, visit `http://your-server:3000` to access the dashboard:

- **Statistics**: View total events, notifications sent, and recent activity
- **Configuration**: See current settings and monitored artists
- **Manual Check**: Trigger an immediate event check
- **API Links**: Access the REST API endpoints

## 🔌 API Endpoints

### Health Check
```
GET /health
```
Returns server status and initialization state.

### Statistics
```
GET /api/stats
```
Returns monitoring statistics.

### Events
```
GET /api/events?start=2025-01-01&end=2025-12-31
```
Returns events within a date range.

### Single Event
```
GET /api/events/:id
```
Returns details for a specific event.

### Manual Event Check
```
POST /api/check-events
```
Triggers an immediate event check.

### Configuration
```
GET /api/config
```
Returns current configuration.

## 🔧 Configuration Options

### Notification Settings

- **checkIntervalHours**: How often to check for events (default: 3)
- **dateRangeDays**: How far ahead to look for events (default: 30)
- **includePastDay**: Include events from yesterday (default: true)

### Database

The SQLite database (`events.db`) stores:
- Event details and metadata
- Artist information for each event
- Notification history
- System settings

## 📱 Pushover Notifications

Notifications include:
- Event title and date
- Venue information
- Artist lineup
- Attendance count
- Direct link to the event

### Notification Types

1. **Individual Events**: Sent when new events are found
2. **Batch Notifications**: Multiple events sent in one notification

## 🛡️ Production Deployment

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### 2. Application Setup
```bash
# Clone repository
git clone <your-repo>
cd raco-graphql-client

# Install dependencies
npm install

# Configure environment
cp env.example .env
# Edit .env with your Pushover credentials

# Configure artists and location
# Edit config.json
```

### 3. PM2 Configuration
```bash
# Start the application
pm2 start server.js --name "ra-event-monitor"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 4. Nginx Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔍 Monitoring and Logs

### PM2 Logs
```bash
# View logs
pm2 logs ra-event-monitor

# Monitor in real-time
pm2 monit
```

### Application Logs
The application logs to console with emojis for easy identification:
- 🔍 Event checking
- 📱 Notifications
- ⏰ Cron jobs
- ❌ Errors

## 🛠️ Troubleshooting

### Common Issues

1. **Pushover Notifications Not Working**
   - Verify your User Key and App Token in `.env`
   - Check Pushover app is installed and configured

2. **No Events Found**
   - Verify artist IDs are correct
   - Check area ID is valid
   - Ensure date range is appropriate

3. **Database Issues**
   - Check file permissions for `events.db`
   - Verify SQLite is working: `sqlite3 events.db ".tables"`

4. **Server Won't Start**
   - Check port 3000 is available
   - Verify all dependencies are installed
   - Check `.env` file exists and is properly formatted

### Debug Mode
Set `NODE_ENV=development` in `.env` for more verbose logging.

## 🔄 Updating Configuration

### Adding/Removing Artists
Edit `config.json` and restart the server:
```bash
pm2 restart ra-event-monitor
```

### Changing Location
Update the `areaId` in `config.json` and restart.

### Modifying Check Interval
Update `checkIntervalHours` in `config.json` and restart.

## 📈 Scaling Considerations

- **Multiple Locations**: Run separate instances for different areas
- **High Artist Count**: Consider splitting into multiple instances
- **Database Size**: Monitor `events.db` size and implement cleanup if needed
- **API Rate Limits**: The 2-second delay between artist queries respects RA.co's API

## 🔐 Security Notes

- Keep your `.env` file secure and never commit it to version control
- Use HTTPS in production with proper SSL certificates
- Consider implementing API authentication if exposing the dashboard publicly
- Regularly update dependencies for security patches

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Verify configuration files
4. Test with the CLI version first

---

**Note**: This tool respects RA.co's API by including delays between requests. Please use responsibly and don't overwhelm their servers with excessive requests.
