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
                const { start, end, artists } = req.query;
                const startDate = start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const endDate = end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                
                console.log('API /api/events called with:', { startDate, endDate, artists });
                
                let events;
                if (artists) {
                    // Filter by selected artists and location
                    const artistIds = artists.split(',');
                    console.log('Filtering by artists:', artistIds, 'and location:', this.monitor.config.location.areaId);
                    events = await this.db.getEventsByDateRangeAndArtists(startDate, endDate, artistIds, this.monitor.config.location.areaId);
                } else {
                    // Get all events (for backward compatibility)
                    events = await this.db.getEventsByDateRange(startDate, endDate);
                }
                
                // Ensure events is always an array
                if (!Array.isArray(events)) {
                    console.error('Database returned non-array:', events);
                    events = [];
                }
                
                console.log('Returning events:', events.length);
                res.json(events);
            } catch (error) {
                console.error('Error in /api/events:', error);
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
                const { selectedArtists } = req.body;
                console.log('🔄 Manual event check triggered via API with artists:', selectedArtists);
                
                if (selectedArtists && selectedArtists.length > 0) {
                    // Use selected artists for this check
                    await this.monitor.checkForNewEventsWithArtists(selectedArtists);
                } else {
                    // Use all artists if none selected
                    await this.monitor.checkForNewEvents();
                }
                
                res.json({ message: 'Event check completed' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Manual trigger endpoint (force - all events)
        this.app.post('/api/check-events-force', async (req, res) => {
            try {
                const { selectedArtists } = req.body;
                console.log('🔄 Force manual event check triggered via API with artists:', selectedArtists);
                
                if (selectedArtists && selectedArtists.length > 0) {
                    // Use selected artists for this check
                    await this.monitor.checkForNewEventsManualWithArtists(selectedArtists);
                } else {
                    // Use all artists if none selected
                    await this.monitor.checkForNewEventsManual();
                }
                
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
                
                // Create a three-column HTML dashboard
                const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RA.co Event Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; height: 100vh; overflow: hidden; }
        
        .layout {
            display: grid;
            grid-template-columns: 300px 1fr 400px;
            height: 100vh;
            gap: 0;
        }
        
        /* Left Column - Artist Management */
        .left-panel {
            background: white;
            border-right: 1px solid #ddd;
            padding: 20px;
            overflow-y: auto;
        }
        
        .left-panel h2 {
            margin-bottom: 20px;
            color: #333;
            font-size: 18px;
        }
        
        .artist-list {
            margin-bottom: 30px;
        }
        
        .artist-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border: 1px solid #eee;
            margin-bottom: 8px;
            border-radius: 6px;
            background: #f9f9f9;
        }
        
        .artist-item input[type="checkbox"] {
            margin-right: 10px;
            transform: scale(1.2);
        }
        
        .artist-item label {
            flex: 1;
            cursor: pointer;
        }
        
        .artist-name {
            font-weight: bold;
            color: #333;
        }
        
        .artist-id {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
        }
        
        .add-artist-form {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ddd;
        }
        
        .add-artist-form h3 {
            margin-bottom: 15px;
            font-size: 16px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }
        
        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 8px;
        }
        
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        
        /* Center Column - Dashboard */
        .center-panel {
            background: white;
            padding: 30px;
            overflow-y: auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 14px;
            text-transform: uppercase;
        }
        
        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        
        .config {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .config h3 {
            margin: 0 0 15px 0;
            color: #333;
        }
        
        .config-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .config-item:last-child {
            border-bottom: none;
        }
        
        .actions {
            display: flex;
            gap: 15px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .status {
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            display: none;
        }
        
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        
        /* Right Column - Events List */
        .right-panel {
            background: white;
            border-left: 1px solid #ddd;
            display: flex;
            flex-direction: column;
        }
        
        .events-header {
            padding: 20px;
            border-bottom: 1px solid #ddd;
            background: #f8f9fa;
        }
        
        .events-header h2 {
            margin: 0;
            color: #333;
            font-size: 18px;
        }
        
                 .events-list {
             flex: 1;
             overflow-y: auto;
             padding: 0;
             max-height: calc(100vh - 80px);
         }
        
        .event-item {
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .event-item:hover {
            background: #f8f9fa;
        }
        
        .event-item:last-child {
            border-bottom: none;
        }
        
        .event-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            font-size: 16px;
        }
        
        .event-details {
            font-size: 14px;
            color: #666;
            line-height: 1.4;
        }
        
        .event-date {
            color: #007bff;
            font-weight: 500;
        }
        
        .event-venue {
            color: #28a745;
        }
        
        .event-artists {
            color: #6c757d;
            font-style: italic;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .no-events {
            text-align: center;
            padding: 40px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="layout">
        <!-- Left Panel - Artist Management -->
        <div class="left-panel">
            <h2>🎤 Artist Management</h2>
            
            <div class="artist-list">
                <h3>Monitored Artists</h3>
                ${config.artists.map(artist => `
                    <div class="artist-item">
                        <input type="checkbox" id="artist-${artist.id}" checked onchange="toggleArtist('${artist.id}', this.checked)">
                        <label for="artist-${artist.id}">
                            <div class="artist-name">${artist.name}</div>
                            <div class="artist-id">ID: ${artist.id}</div>
                        </label>
                    </div>
                `).join('')}
            </div>
            
            <div class="add-artist-form">
                <h3>Add New Artist</h3>
                <div class="form-group">
                    <label for="newArtistName">Artist Name:</label>
                    <input type="text" id="newArtistName" placeholder="e.g., Aphex Twin">
                </div>
                <div class="form-group">
                    <label for="newArtistId">Artist ID:</label>
                    <input type="text" id="newArtistId" placeholder="e.g., 12345">
                </div>
                <button class="btn btn-primary" onclick="addArtist()">Add Artist</button>
            </div>
        </div>
        
        <!-- Center Panel - Dashboard -->
        <div class="center-panel">
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
            
            <div class="actions">
                <button class="btn btn-primary" onclick="checkEvents()">🔍 Check Events Now</button>
                <button class="btn btn-secondary" onclick="checkEventsForce()">⚡ Force Check (Notify All)</button>
                <button class="btn btn-secondary" onclick="loadEvents()">📋 Refresh Events</button>
                <a href="/api/events" class="btn btn-secondary" target="_blank">📊 API</a>
                <a href="/health" class="btn btn-secondary" target="_blank">❤️ Health</a>
            </div>
            
            <div class="status" id="status"></div>
        </div>
        
        <!-- Right Panel - Events List -->
        <div class="right-panel">
            <div class="events-header">
                <h2>📅 Upcoming Events</h2>
            </div>
            <div class="events-list" id="eventsList">
                <div class="loading">Loading events...</div>
            </div>
        </div>
    </div>
    
    <script>
        let selectedArtists = ${JSON.stringify(config.artists.map(a => a.id))};
        
        // Load events on page load
        window.addEventListener('load', loadEvents);
        
        async function loadEvents() {
            const eventsList = document.getElementById('eventsList');
            eventsList.innerHTML = '<div class="loading">Loading events...</div>';
            
            try {
                // Build query parameters with selected artists
                const params = new URLSearchParams();
                if (selectedArtists && selectedArtists.length > 0) {
                    params.append('artists', selectedArtists.join(','));
                }
                
                const response = await fetch(\`/api/events?\${params.toString()}\`);
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const events = await response.json();
                
                console.log('Loaded events for artists:', selectedArtists, 'Events:', events);
                
                // Ensure events is an array
                if (!Array.isArray(events)) {
                    console.error('API returned non-array:', events);
                    eventsList.innerHTML = '<div class="no-events">Error: Invalid response format</div>';
                    return;
                }
                
                if (events.length === 0) {
                    eventsList.innerHTML = '<div class="no-events">No events found for selected artists</div>';
                    return;
                }
                
                eventsList.innerHTML = events.map(event => \`
                    <div class="event-item" onclick="window.open('https://ra.co\${event.content_url}', '_blank')">
                        <div class="event-title">\${event.title}</div>
                        <div class="event-details">
                            <div class="event-date">📅 \${new Date(event.date).toLocaleDateString('en-GB')}</div>
                            <div class="event-venue">📍 \${event.venue_name || 'Venue TBA'}</div>
                            \${event.artist_names ? \`<div class="event-artists">🎤 \${event.artist_names}</div>\` : ''}
                        </div>
                    </div>
                \`).join('');
            } catch (error) {
                console.error('Error loading events:', error);
                eventsList.innerHTML = '<div class="no-events">Error loading events: ' + error.message + '</div>';
            }
        }
        
        function toggleArtist(artistId, isChecked) {
            if (isChecked) {
                if (!selectedArtists.includes(artistId)) {
                    selectedArtists.push(artistId);
                }
            } else {
                selectedArtists = selectedArtists.filter(id => id !== artistId);
            }
            console.log('Selected artists:', selectedArtists);
            
            // Reload events when artists are toggled
            loadEvents();
        }
        
        async function addArtist() {
            const name = document.getElementById('newArtistName').value.trim();
            const id = document.getElementById('newArtistId').value.trim();
            
            if (!name || !id) {
                alert('Please enter both artist name and ID');
                return;
            }
            
            try {
                const response = await fetch('/api/artists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, id })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Clear the form
                    document.getElementById('newArtistName').value = '';
                    document.getElementById('newArtistId').value = '';
                    
                    // Show success message
                    alert(\`Artist added successfully! Total artists: \${result.totalArtists}\`);
                    
                    // Reload the page to show the new artist
                    location.reload();
                } else {
                    alert('Error adding artist: ' + result.error);
                }
            } catch (error) {
                alert('Error adding artist: ' + error.message);
            }
        }
        
        async function checkEvents() {
            const status = document.getElementById('status');
            status.textContent = 'Checking events...';
            status.className = 'status';
            status.style.display = 'block';
            
            try {
                // Send selected artists with the request
                const response = await fetch('/api/check-events', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selectedArtists })
                });
                const result = await response.json();
                
                if (response.ok) {
                    status.textContent = 'Event check completed successfully!';
                    status.className = 'status success';
                    setTimeout(() => {
                        loadEvents();
                        status.style.display = 'none';
                    }, 2000);
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
                // Send selected artists with the request
                const response = await fetch('/api/check-events-force', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selectedArtists })
                });
                const result = await response.json();
                
                if (response.ok) {
                    status.textContent = 'Force check completed! Notifications sent for all events.';
                    status.className = 'status success';
                    setTimeout(() => {
                        loadEvents();
                        status.style.display = 'none';
                    }, 2000);
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

        // Add artist endpoint
        this.app.post('/api/artists', async (req, res) => {
            try {
                const { name, id } = req.body;
                
                if (!name || !id) {
                    return res.status(400).json({ error: 'Name and ID are required' });
                }
                
                // Check if artist already exists
                const existingArtist = this.monitor.config.artists.find(artist => 
                    artist.id === id || artist.name.toLowerCase() === name.toLowerCase()
                );
                
                if (existingArtist) {
                    return res.status(400).json({ 
                        error: `Artist already exists: ${existingArtist.name} (ID: ${existingArtist.id})` 
                    });
                }
                
                // Add new artist to config
                const newArtist = { id, name };
                this.monitor.config.artists.push(newArtist);
                
                // Save updated config to file
                const fs = require('fs');
                const configPath = './config.json';
                await fs.promises.writeFile(configPath, JSON.stringify(this.monitor.config, null, 2));
                
                console.log(`✅ Added new artist: ${name} (ID: ${id})`);
                
                res.json({ 
                    message: 'Artist added successfully', 
                    artist: newArtist,
                    totalArtists: this.monitor.config.artists.length
                });
            } catch (error) {
                console.error('Error adding artist:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get selected artists endpoint
        this.app.get('/api/selected-artists', (req, res) => {
            try {
                // For now, return all artists (we'll implement filtering later)
                res.json(this.monitor.config.artists);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
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
