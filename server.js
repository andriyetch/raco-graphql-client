const express = require('express');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const EventMonitor = require('./eventMonitor');
const Database = require('./database');

class EventServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.monitor = new EventMonitor();
        this.db = new Database();
        this.isInitialized = false;
    }

    async init() {
        try {
            // Initialize database and monitor
            await this.db.init();
            await this.monitor.init();
            
            // Setup Express middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup cron job
            this.setupCronJob();
            
            this.isInitialized = true;
            console.log('✅ Server initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize server:', error.message);
            process.exit(1);
        }
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                initialized: this.isInitialized
            });
        });

        // API endpoints
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.monitor.getStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/events', async (req, res) => {
            try {
                const { start, end } = req.query;
                const startDate = start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const endDate = end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                
                const events = await this.db.getEventsByDateRange(startDate, endDate);
                res.json(events);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/events/:id', async (req, res) => {
            try {
                const event = await this.db.getEventById(req.params.id);
                if (event) {
                    res.json(event);
                } else {
                    res.status(404).json({ error: 'Event not found' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Manual trigger endpoint (normal - only new events)
        this.app.post('/api/check-events', async (req, res) => {
            try {
                console.log('🔄 Manual event check triggered via API');
                await this.monitor.checkForNewEvents();
                res.json({ message: 'Event check completed' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Manual trigger endpoint (force - all events)
        this.app.post('/api/check-events-force', async (req, res) => {
            try {
                console.log('🔄 Force manual event check triggered via API (will notify for all events)');
                await this.monitor.checkForNewEventsManual();
                res.json({ message: 'Force event check completed - notifications sent for all events' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Dashboard
        this.app.get('/', async (req, res) => {
            try {
                const stats = await this.monitor.getStats();
                const config = this.monitor.config;
                console.log('Dashboard data:', { stats, config });
                
                // Create a simple HTML dashboard instead of using EJS
                const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RA.co Event Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .stat-card h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; text-transform: uppercase; }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .config { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .config h3 { margin: 0 0 15px 0; color: #333; }
        .config-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .config-item:last-child { border-bottom: none; }
        .actions { display: flex; gap: 15px; margin-top: 20px; }
        .btn { padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; text-decoration: none; display: inline-block; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .status { padding: 15px; border-radius: 6px; margin-top: 20px; display: none; }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 RA.co Event Monitor</h1>
            <p>Automated event tracking for your favorite artists</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total Events</h3>
                <div class="value">${stats.totalEvents}</div>
            </div>
            <div class="stat-card">
                <h3>Notifications Sent</h3>
                <div class="value">${stats.totalNotifications}</div>
            </div>
            <div class="stat-card">
                <h3>Recent Events (7 days)</h3>
                <div class="value">${stats.recentEvents}</div>
            </div>
            <div class="stat-card">
                <h3>Monitored Artists</h3>
                <div class="value">${stats.monitoredArtists}</div>
            </div>
        </div>
        
        <div class="config">
            <h3>📍 Current Configuration</h3>
            <div class="config-item">
                <span>Location:</span>
                <span>${config.location.name} (ID: ${config.location.areaId})</span>
            </div>
            <div class="config-item">
                <span>Check Interval:</span>
                <span>Every ${config.notificationSettings.checkIntervalHours} hours</span>
            </div>
            <div class="config-item">
                <span>Date Range:</span>
                <span>${config.notificationSettings.dateRangeDays} days</span>
            </div>
        </div>
        
        <div class="config">
            <h3>🎤 Monitored Artists</h3>
            ${config.artists.map(artist => `
                <div class="config-item">
                    <span>${artist.name}</span>
                    <span>ID: ${artist.id}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="actions">
            <button class="btn btn-primary" onclick="checkEvents()">🔍 Check Events Now</button>
            <button class="btn btn-secondary" onclick="checkEventsForce()">⚡ Force Check (Notify All)</button>
            <a href="/api/events" class="btn btn-secondary" target="_blank">📊 View Events API</a>
            <a href="/health" class="btn btn-secondary" target="_blank">❤️ Health Check</a>
        </div>
        
        <div class="status" id="status"></div>
    </div>
    
    <script>
        async function checkEvents() {
            const status = document.getElementById('status');
            status.textContent = 'Checking events...';
            status.className = 'status';
            status.style.display = 'block';
            
            try {
                const response = await fetch('/api/check-events', { method: 'POST' });
                const result = await response.json();
                
                if (response.ok) {
                    status.textContent = 'Event check completed successfully!';
                    status.className = 'status success';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    status.textContent = 'Error: ' + result.error;
                    status.className = 'status error';
                }
            } catch (error) {
                status.textContent = 'Error: ' + error.message;
                status.className = 'status error';
            }
        }
        
        async function checkEventsForce() {
            const status = document.getElementById('status');
            status.textContent = 'Force checking events...';
            status.className = 'status';
            status.style.display = 'block';
            
            try {
                const response = await fetch('/api/check-events-force', { method: 'POST' });
                const result = await response.json();
                
                if (response.ok) {
                    status.textContent = 'Force check completed! Notifications sent for all events.';
                    status.className = 'status success';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    status.textContent = 'Error: ' + result.error;
                    status.className = 'status error';
                }
            } catch (error) {
                status.textContent = 'Error: ' + error.message;
                status.className = 'status error';
            }
        }
    </script>
</body>
</html>`;
                
                res.send(html);
            } catch (error) {
                console.error('Dashboard error:', error);
                res.status(500).send('Error loading dashboard: ' + error.message);
            }
        });

        // Configuration endpoint
        this.app.get('/api/config', (req, res) => {
            res.json(this.monitor.config);
        });

        // Simple test route
        this.app.get('/test', (req, res) => {
            res.send('Server is working! EJS test: <%= test %>');
        });
    }

    setupCronJob() {
        // Run every 3 hours
        const cronSchedule = '0 */3 * * *';
        
        cron.schedule(cronSchedule, async () => {
            console.log(`\n⏰ Cron job triggered at ${new Date().toISOString()}`);
            try {
                await this.monitor.checkForNewEvents();
            } catch (error) {
                console.error('❌ Error in cron job:', error.message);
            }
        }, {
            scheduled: true,
            timezone: "Europe/London"
        });
        
        console.log(`⏰ Cron job scheduled to run every 3 hours (${cronSchedule})`);
    }

    async start() {
        await this.init();
        
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${this.port}`);
            console.log(`📊 Dashboard available at http://0.0.0.0:${this.port}`);
            console.log(`🔍 Health check at http://0.0.0.0:${this.port}/health`);
        });
    }

    async stop() {
        await this.monitor.close();
        await this.db.close();
        console.log('🛑 Server stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.server) {
        await global.server.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.server) {
        await global.server.stop();
    }
    process.exit(0);
});

// Start server if this file is run directly
if (require.main === module) {
    const server = new EventServer();
    global.server = server;
    server.start().catch(console.error);
}

module.exports = EventServer;
