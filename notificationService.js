const Push = require('pushover-notifications');

class NotificationService {
    constructor(userKey, appToken) {
        this.push = new Push({
            user: userKey,
            token: appToken,
            onerror: function(error) {
                console.error('Pushover error:', error);
            }
        });
    }

    async sendNotification(title, message, priority = 0) {
        return new Promise((resolve, reject) => {
            const msg = {
                message: message,
                title: title,
                priority: priority,
                sound: 'cosmic' // You can customize this
            };

            this.push.send(msg, (err, result) => {
                if (err) {
                    console.error('Error sending notification:', err);
                    reject(err);
                } else {
                    console.log('Notification sent successfully:', result);
                    resolve(result);
                }
            });
        });
    }

    formatEventNotification(event) {
        const title = `🎵 New Event: ${event.title}`;
        
        const date = new Date(event.date);
        const formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const time = event.start_time ? 
            new Date(event.start_time).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            }) : 'TBA';

        let message = `${formattedDate} at ${time}\n`;
        message += `📍 ${event.venue_name || 'Venue TBA'}\n`;
        
        if (event.artist_names) {
            message += `🎤 ${event.artist_names}\n`;
        }
        
        if (event.attending > 0) {
            message += `👥 ${event.attending} attending\n`;
        }

        message += `\n🔗 https://ra.co${event.content_url}`;

        return { title, message };
    }

    async sendEventNotification(event) {
        const { title, message } = this.formatEventNotification(event);
        return await this.sendNotification(title, message);
    }

    async sendBatchNotification(events) {
        if (events.length === 0) return;

        const title = `🎵 ${events.length} New Event${events.length > 1 ? 's' : ''} Found!`;
        
        let message = `Found ${events.length} new event${events.length > 1 ? 's' : ''} for your monitored artists:\n\n`;
        
        events.forEach((event, index) => {
            const date = new Date(event.date);
            const formattedDate = date.toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric'
            });
            
            message += `${index + 1}. ${event.title}\n`;
            message += `   ${formattedDate} - ${event.venue_name || 'Venue TBA'}\n`;
            if (event.artist_names) {
                message += `   ${event.artist_names}\n`;
            }
            message += `   https://ra.co${event.content_url}\n\n`;
        });

        return await this.sendNotification(title, message, 1); // Higher priority for batch notifications
    }
}

module.exports = NotificationService;
