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
                res.render('dashboard', { stats, config });
            } catch (error) {
                res.status(500).send('Error loading dashboard');
            }
        });

        // Configuration endpoint
        this.app.get('/api/config', (req, res) => {
            res.json(this.monitor.config);
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
        
        this.app.listen(this.port, () => {
            console.log(`🚀 Server running on port ${this.port}`);
            console.log(`📊 Dashboard available at http://localhost:${this.port}`);
            console.log(`🔍 Health check at http://localhost:${this.port}/health`);
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
