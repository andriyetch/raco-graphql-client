const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './events.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                venue_name TEXT,
                venue_id TEXT,
                content_url TEXT,
                attending INTEGER DEFAULT 0,
                is_ticketed BOOLEAN,
                queue_it_enabled BOOLEAN,
                new_event_form BOOLEAN,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS event_artists (
                event_id TEXT,
                artist_id TEXT,
                artist_name TEXT,
                PRIMARY KEY (event_id, artist_id),
                FOREIGN KEY (event_id) REFERENCES events (id)
            )`,
            `CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                message TEXT,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )`,
            `CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Error running sql:', sql);
                    console.error('Error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Error getting sql:', sql);
                    console.error('Error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error getting all sql:', sql);
                    console.error('Error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async saveEvent(event) {
        const eventSql = `
            INSERT OR REPLACE INTO events (
                id, title, date, start_time, end_time, venue_name, venue_id, 
                content_url, attending, is_ticketed, queue_it_enabled, new_event_form, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const eventParams = [
            event.id,
            event.title,
            event.date,
            event.startTime,
            event.endTime,
            event.venue?.name,
            event.venue?.id,
            event.contentUrl,
            event.attending || event.interestedCount || 0,
            event.isTicketed,
            event.queueItEnabled,
            event.newEventForm
        ];

        await this.run(eventSql, eventParams);

        // Save artists for this event
        if (event.artists && event.artists.length > 0) {
            // Remove existing artists for this event
            await this.run('DELETE FROM event_artists WHERE event_id = ?', [event.id]);

            // Add new artists
            for (const artist of event.artists) {
                await this.run(
                    'INSERT INTO event_artists (event_id, artist_id, artist_name) VALUES (?, ?, ?)',
                    [event.id, artist.id, artist.name]
                );
            }
        }
    }

    async getEventById(eventId) {
        const event = await this.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (event) {
            const artists = await this.all(
                'SELECT artist_id, artist_name FROM event_artists WHERE event_id = ?',
                [eventId]
            );
            event.artists = artists;
        }
        return event;
    }

    async getEventsByDateRange(startDate, endDate) {
        const sql = `
            SELECT e.*, GROUP_CONCAT(ea.artist_name) as artist_names
            FROM events e
            LEFT JOIN event_artists ea ON e.id = ea.event_id
            WHERE e.date BETWEEN ? AND ?
            GROUP BY e.id
            ORDER BY e.date ASC
        `;
        return await this.all(sql, [startDate, endDate]);
    }

    async hasNotificationBeenSent(eventId) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM notifications WHERE event_id = ?',
            [eventId]
        );
        return result.count > 0;
    }

    async markNotificationSent(eventId, message) {
        await this.run(
            'INSERT INTO notifications (event_id, message) VALUES (?, ?)',
            [eventId, message]
        );
    }

    async getNewEventsForArtists(artistIds, startDate, endDate) {
        const placeholders = artistIds.map(() => '?').join(',');
        const sql = `
            SELECT DISTINCT e.*
            FROM events e
            JOIN event_artists ea ON e.id = ea.event_id
            WHERE ea.artist_id IN (${placeholders})
            AND e.date BETWEEN ? AND ?
            AND e.id NOT IN (
                SELECT event_id FROM notifications
            )
            ORDER BY e.date ASC
        `;
        
        const params = [...artistIds, startDate, endDate];
        return await this.all(sql, params);
    }

    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;
