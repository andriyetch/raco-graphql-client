const EventFetcher = require('./eventFetcher');
const Database = require('./database');
const NotificationService = require('./notificationService');
const fs = require('fs');
const path = require('path');

class EventMonitor {
    constructor(configPath = './config.json', dbPath = './events.db') {
        this.configPath = configPath;
        this.db = new Database(dbPath);
        this.notificationService = null;
        this.config = null;
    }

    async init() {
        // Load configuration
        this.config = this.loadConfig();
        
        // Initialize database
        await this.db.init();
        
        // Initialize notification service
        if (process.env.PUSHOVER_USER_KEY && process.env.PUSHOVER_APP_TOKEN) {
            this.notificationService = new NotificationService(
                process.env.PUSHOVER_USER_KEY,
                process.env.PUSHOVER_APP_TOKEN
            );
        } else {
            console.warn('Pushover credentials not found. Notifications will be disabled.');
        }
    }

    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('Error loading config:', error.message);
            throw new Error('Failed to load configuration file');
        }
    }

    getDateRange() {
        const now = new Date();
        const startDate = new Date(now);
        
        // If includePastDay is true, start from yesterday
        if (this.config.notificationSettings.includePastDay) {
            startDate.setDate(startDate.getDate() - 1);
        }
        
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + this.config.notificationSettings.dateRangeDays);
        
        return {
            start: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
            end: endDate.toISOString().split('T')[0] + 'T23:59:59.999Z'
        };
    }

    async checkForNewEvents() {
        console.log('🔍 Starting event check...');
        console.log(`Location: ${this.config.location.name} (ID: ${this.config.location.areaId})`);
        console.log(`Artists: ${this.config.artists.map(a => a.name).join(', ')}`);
        
        const dateRange = this.getDateRange();
        console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);
        
        const artistIds = this.config.artists.map(artist => artist.id);
        let allNewEvents = [];
        
        // Check each artist individually
        for (let i = 0; i < artistIds.length; i++) {
            const artistId = artistIds[i];
            const artistName = this.config.artists.find(a => a.id === artistId).name;
            
            console.log(`\n[${i + 1}/${artistIds.length}] Checking events for ${artistName} (ID: ${artistId})`);
            
            try {
                const eventFetcher = new EventFetcher(
                    this.config.location.areaId,
                    artistId,
                    dateRange.start,
                    dateRange.end
                );
                
                const events = await eventFetcher.fetchAllEvents(); // Fetch all available pages
                console.log(`Found ${events.length} events for ${artistName}`);
                
                // Save events to database
                for (const event of events) {
                    await this.db.saveEvent(event);
                }
                
                // Check for new events that haven't been notified about
                const newEvents = await this.db.getNewEventsForArtists(
                    [artistId],
                    dateRange.start,
                    dateRange.end
                );
                
                if (newEvents.length > 0) {
                    console.log(`Found ${newEvents.length} new events for ${artistName}`);
                    allNewEvents.push(...newEvents);
                }
                
                // Add delay between artist queries
                if (i < artistIds.length - 1) {
                    console.log('Waiting 2 seconds before next artist...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error checking events for ${artistName}:`, error.message);
            }
        }
        
        // Send notifications for new events
        if (allNewEvents.length > 0 && this.notificationService) {
            console.log(`\n📱 Sending notifications for ${allNewEvents.length} new events`);
            
            try {
                // Send batch notification
                await this.notificationService.sendBatchNotification(allNewEvents, this.config.location.name);
                
                // Mark events as notified
                for (const event of allNewEvents) {
                    await this.db.markNotificationSent(event.id, 'Batch notification sent');
                }
                
                console.log('✅ Notifications sent successfully');
                
            } catch (error) {
                console.error('Error sending notifications:', error.message);
            }
        } else if (allNewEvents.length > 0) {
            console.log(`\n⚠️  Found ${allNewEvents.length} new events but notifications are disabled`);
        } else {
            console.log('\n✅ No new events found');
        }
        
        console.log('🔍 Event check completed\n');
    }

    async checkForNewEventsManual() {
        console.log('🔍 Starting MANUAL event check (will notify for all events)...');
        console.log(`Location: ${this.config.location.name} (ID: ${this.config.location.areaId})`);
        console.log(`Artists: ${this.config.artists.map(a => a.name).join(', ')}`);
        
        const dateRange = this.getDateRange();
        console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);
        
        const artistIds = this.config.artists.map(artist => artist.id);
        let allEvents = [];
        
        // Check each artist individually
        for (let i = 0; i < artistIds.length; i++) {
            const artistId = artistIds[i];
            const artistName = this.config.artists.find(a => a.id === artistId).name;
            
            console.log(`\n[${i + 1}/${artistIds.length}] Checking events for ${artistName} (ID: ${artistId})`);
            
            try {
                const eventFetcher = new EventFetcher(
                    this.config.location.areaId,
                    artistId,
                    dateRange.start,
                    dateRange.end
                );
                
                const events = await eventFetcher.fetchAllEvents(); // Fetch all available pages
                console.log(`Found ${events.length} events for ${artistName}`);
                
                // Save events to database
                for (const event of events) {
                    await this.db.saveEvent(event);
                }
                
                // For manual check, we need to filter by area after fetching
                // The events are already filtered by area in the EventFetcher, but let's double-check
                const fetchedEvents = await eventFetcher.fetchAllEvents(); // Fetch all available pages
                console.log(`Found ${fetchedEvents.length} events for ${artistName}`);
                
                // Save events to database
                for (const event of fetchedEvents) {
                    await this.db.saveEvent(event);
                }
                
                // Filter events by area (same logic as in EventFetcher.saveEventsToJson)
                const filteredEvents = fetchedEvents.filter(event => {
                    const eventData = event.event || event;
                    const eventAreaId = eventData.venue?.area?.id;
                    return eventAreaId && eventAreaId === this.config.location.areaId.toString();
                });
                
                if (filteredEvents.length > 0) {
                    console.log(`Found ${filteredEvents.length} events for ${artistName} in ${this.config.location.name}`);
                    allEvents.push(...filteredEvents);
                }
                
                // Add delay between artist queries
                if (i < artistIds.length - 1) {
                    console.log('Waiting 2 seconds before next artist...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error checking events for ${artistName}:`, error.message);
            }
        }
        
        // Send notifications for ALL events found
        if (allEvents.length > 0 && this.notificationService) {
            console.log(`\n📱 Sending notifications for ${allEvents.length} events (manual run)`);
            
            try {
                // Send batch notification
                await this.notificationService.sendBatchNotification(allEvents, this.config.location.name);
                
                // Mark events as notified (even if they were notified before)
                for (const event of allEvents) {
                    await this.db.markNotificationSent(event.id, 'Manual notification sent');
                }
                
                console.log('✅ Manual notifications sent successfully');
                
            } catch (error) {
                console.error('Error sending manual notifications:', error.message);
            }
        } else if (allEvents.length > 0) {
            console.log(`\n⚠️  Found ${allEvents.length} events but notifications are disabled`);
        } else {
            console.log('\n✅ No events found');
        }
        
        console.log('🔍 Manual event check completed\n');
    }

    async checkForNewEventsWithArtists(selectedArtistIds) {
        console.log('🔍 Starting event check with selected artists:', selectedArtistIds);
        console.log(`Location: ${this.config.location.name} (ID: ${this.config.location.areaId})`);
        
        const dateRange = this.getDateRange();
        console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);
        
        let allNewEvents = [];
        
        // Check each selected artist individually
        for (let i = 0; i < selectedArtistIds.length; i++) {
            const artistId = selectedArtistIds[i];
            const artistName = this.config.artists.find(a => a.id === artistId)?.name || `Artist ${artistId}`;
            
            console.log(`\n[${i + 1}/${selectedArtistIds.length}] Checking events for ${artistName} (ID: ${artistId})`);
            
            try {
                const eventFetcher = new EventFetcher(
                    this.config.location.areaId,
                    artistId,
                    dateRange.start,
                    dateRange.end
                );
                
                const events = await eventFetcher.fetchAllEvents(); // Fetch all available pages
                console.log(`Found ${events.length} events for ${artistName}`);
                
                // Save events to database
                for (const event of events) {
                    await this.db.saveEvent(event);
                }
                
                // Check for new events that haven't been notified about
                const newEvents = await this.db.getNewEventsForArtists(
                    [artistId],
                    dateRange.start,
                    dateRange.end
                );
                
                if (newEvents.length > 0) {
                    console.log(`Found ${newEvents.length} new events for ${artistName}`);
                    allNewEvents.push(...newEvents);
                }
                
                // Add delay between artist queries
                if (i < selectedArtistIds.length - 1) {
                    console.log('Waiting 2 seconds before next artist...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error checking events for ${artistName}:`, error.message);
            }
        }
        
        // Send notifications for new events
        if (allNewEvents.length > 0 && this.notificationService) {
            console.log(`\n📱 Sending notifications for ${allNewEvents.length} new events`);
            
            try {
                await this.notificationService.sendBatchNotification(allNewEvents, this.config.location.name);
                
                for (const event of allNewEvents) {
                    await this.db.markNotificationSent(event.id, 'Batch notification sent');
                }
                
                console.log('✅ Notifications sent successfully');
                
            } catch (error) {
                console.error('Error sending notifications:', error.message);
            }
        } else if (allNewEvents.length > 0) {
            console.log(`\n⚠️  Found ${allNewEvents.length} new events but notifications are disabled`);
        } else {
            console.log('\n✅ No new events found');
        }
        
        console.log('🔍 Event check completed\n');
    }

    async checkForNewEventsManualWithArtists(selectedArtistIds) {
        console.log('🔍 Starting MANUAL event check with selected artists:', selectedArtistIds);
        console.log(`Location: ${this.config.location.name} (ID: ${this.config.location.areaId})`);
        
        const dateRange = this.getDateRange();
        console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);
        
        let allEvents = [];
        
        // Check each selected artist individually
        for (let i = 0; i < selectedArtistIds.length; i++) {
            const artistId = selectedArtistIds[i];
            const artistName = this.config.artists.find(a => a.id === artistId)?.name || `Artist ${artistId}`;
            
            console.log(`\n[${i + 1}/${selectedArtistIds.length}] Checking events for ${artistName} (ID: ${artistId})`);
            
            try {
                const eventFetcher = new EventFetcher(
                    this.config.location.areaId,
                    artistId,
                    dateRange.start,
                    dateRange.end
                );
                
                const fetchedEvents = await eventFetcher.fetchAllEvents(); // Fetch all available pages
                console.log(`Found ${fetchedEvents.length} events for ${artistName}`);
                
                // Save events to database
                for (const event of fetchedEvents) {
                    await this.db.saveEvent(event);
                }
                
                // Filter events by area (same logic as in EventFetcher.saveEventsToJson)
                const filteredEvents = fetchedEvents.filter(event => {
                    const eventData = event.event || event;
                    const eventAreaId = eventData.venue?.area?.id;
                    return eventAreaId && eventAreaId === this.config.location.areaId.toString();
                });
                
                if (filteredEvents.length > 0) {
                    console.log(`Found ${filteredEvents.length} events for ${artistName} in ${this.config.location.name}`);
                    allEvents.push(...filteredEvents);
                }
                
                // Add delay between artist queries
                if (i < selectedArtistIds.length - 1) {
                    console.log('Waiting 2 seconds before next artist...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error checking events for ${artistName}:`, error.message);
            }
        }
        
        // Send notifications for ALL events found
        if (allEvents.length > 0 && this.notificationService) {
            console.log(`\n📱 Sending notifications for ${allEvents.length} events (manual run)`);
            
            try {
                await this.notificationService.sendBatchNotification(allEvents, this.config.location.name);
                
                for (const event of allEvents) {
                    await this.db.markNotificationSent(event.id, 'Manual notification sent');
                }
                
                console.log('✅ Manual notifications sent successfully');
                
            } catch (error) {
                console.error('Error sending manual notifications:', error.message);
            }
        } else if (allEvents.length > 0) {
            console.log(`\n⚠️  Found ${allEvents.length} events but notifications are disabled`);
        } else {
            console.log('\n✅ No events found');
        }
        
        console.log('🔍 Manual event check completed\n');
    }

    async getStats() {
        const totalEvents = await this.db.get('SELECT COUNT(*) as count FROM events');
        const totalNotifications = await this.db.get('SELECT COUNT(*) as count FROM notifications');
        const recentEvents = await this.db.get(
            'SELECT COUNT(*) as count FROM events WHERE created_at > datetime("now", "-7 days")'
        );
        
        return {
            totalEvents: totalEvents.count,
            totalNotifications: totalNotifications.count,
            recentEvents: recentEvents.count,
            monitoredArtists: this.config.artists.length,
            location: this.config.location.name
        };
    }

    async close() {
        await this.db.close();
    }
}

module.exports = EventMonitor;
