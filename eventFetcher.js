const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const URL = 'https://ra.co/graphql';
const HEADERS = {
    'Content-Type': 'application/json',
    'Referer': 'https://ra.co/events/uk/london',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0'
};
const QUERY_TEMPLATE_PATH = "graphql_query_template.json";
const ARTIST_QUERY_TEMPLATE_PATH = "graphql_query_template_artist.json";
const DELAY = 1000; // 1 second delay between requests

class EventFetcher {
    /**
     * A class to fetch and print event details from RA.co
     */
    constructor(areas, artist, listingDateGte, listingDateLte) {
        this.payload = this.generatePayload(areas, artist, listingDateGte, listingDateLte);
    }

    /**
     * Generate the payload for the GraphQL request.
     * @param {number} areas - The area code to filter events.
     * @param {number} artist - The artist ID to filter events.
     * @param {string} listingDateGte - The start date for event listings (inclusive).
     * @param {string} listingDateLte - The end date for event listings (inclusive).
     * @returns {Object} The generated payload.
     */
    generatePayload(areas, artist, listingDateGte, listingDateLte) {
        let payload;
        
        // Use different template based on whether artist filtering is requested
        if (artist && artist !== 0) {
            // Use artist-specific template
            const templatePath = path.join(__dirname, ARTIST_QUERY_TEMPLATE_PATH);
            payload = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            
            // Replace placeholders in the artist template
            const artistFilter = payload.variables.filters.find(f => f.type === 'ARTIST');
            const dateFilter = payload.variables.filters.find(f => f.type === 'DATERANGE');
            const baseArtistFilter = payload.variables.baseFilters.find(f => f.type === 'ARTIST');
            const baseDateFilter = payload.variables.baseFilters.find(f => f.type === 'DATERANGE');
            
            if (artistFilter) artistFilter.value = artist.toString();
            // Only use gte if lte is null, otherwise use both
            const dateValue = listingDateLte ? 
                `{"gte":"${listingDateGte}","lte":"${listingDateLte}"}` : 
                `{"gte":"${listingDateGte}"}`;
            if (dateFilter) dateFilter.value = dateValue;
            if (baseArtistFilter) baseArtistFilter.value = artist.toString();
            if (baseDateFilter) baseDateFilter.value = dateValue;
            
        } else {
            // Use original template for area-based filtering
            const templatePath = path.join(__dirname, QUERY_TEMPLATE_PATH);
            payload = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

            // Only add area filter if area is provided
            if (areas && areas !== 0) {
                payload.variables.filters.areas.eq = parseInt(areas);
            } else {
                // Remove area filter if not provided
                delete payload.variables.filters.areas;
            }
            
            payload.variables.filters.listingDate.gte = listingDateGte;
            // Only add lte if provided
            if (listingDateLte) {
                payload.variables.filters.listingDate.lte = listingDateLte;
            } else {
                delete payload.variables.filters.listingDate.lte;
            }
        }

        console.log('Generated payload variables:', payload.variables);
        return payload;
    }

    /**
     * Fetch events for the given page number.
     * @param {number} pageNumber - The page number for event listings.
     * @returns {Promise<Array>} A list of events.
     */
    async getEvents(pageNumber) {
        this.payload.variables.page = pageNumber;
        
        try {
            const response = await axios.post(URL, this.payload, { headers: HEADERS });
            const data = response.data;

            if (!data.data) {
                console.log(`Error: ${JSON.stringify(data)}`);
                return [];
            }

            // Handle different response structures based on query type
            if (this.payload.operationName === 'GET_DEFAULT_EVENTS_LISTING') {
                // Artist query response structure
                return data.data.listing.data;
            } else {
                // Original area query response structure
                return data.data.eventListings.data;
            }
        } catch (error) {
            if (error.response?.status === 400) {
                console.log(`Error 400: Bad request. This might be due to invalid parameters or API changes.`);
                console.log(`Request payload: ${JSON.stringify(this.payload, null, 2)}`);
            } else {
                console.log(`Error: ${error.response?.status || error.message}`);
            }
            return [];
        }
    }

    /**
     * Print the details of the events.
     * @param {Array} events - A list of events.
     */
    printEventDetails(events) {
        for (const event of events) {
            // Handle different event data structures
            const eventData = event.event || event; // Use event.event for original query, or event directly for artist query
            
            console.log(`Event name: ${eventData.title}`);
            console.log(`Date: ${eventData.date}`);
            console.log(`Start Time: ${eventData.startTime}`);
            console.log(`End Time: ${eventData.endTime || 'N/A'}`);
            console.log(`Artists: ${eventData.artists ? eventData.artists.map(artist => artist.name) : 'N/A'}`);
            console.log(`Venue: ${eventData.venue ? eventData.venue.name : 'N/A'}`);
            console.log(`Event URL: ${eventData.contentUrl}`);
            console.log(`Number of guests attending: ${eventData.attending || eventData.interestedCount || 0}`);
            console.log('-'.repeat(80));
        }
    }

    /**
     * Fetch and print all events.
     */
    async fetchAndPrintAllEvents() {
        let pageNumber = 1;

        while (true) {
            const events = await this.getEvents(pageNumber);

            if (!events || events.length === 0) {
                break;
            }

            this.printEventDetails(events);
            pageNumber++;
            await this.sleep(DELAY);
        }
    }

    /**
     * Fetch all events and return them as a list.
     * @returns {Promise<Array>} A list of all events.
     */
    async fetchAllEvents() {
        const allEvents = [];
        let pageNumber = 1;

        while (true) {
            const events = await this.getEvents(pageNumber);

            if (!events || events.length === 0) {
                break;
            }

            allEvents.push(...events);
            pageNumber++;
            await this.sleep(DELAY);
        }

        return allEvents;
    }

    /**
     * Fetch events with a page limit and return them as a list.
     * @param {number} maxPages - Maximum number of pages to fetch.
     * @returns {Promise<Array>} A list of events.
     */
    async fetchEventsWithPageLimit(maxPages) {
        const allEvents = [];
        let pageNumber = 1;

        while (pageNumber <= maxPages) {
            const events = await this.getEvents(pageNumber);

            if (!events || events.length === 0) {
                break;
            }

            allEvents.push(...events);
            pageNumber++;
            await this.sleep(DELAY);
        }

        return allEvents;
    }

    /**
     * Save events to a JSON file.
     * @param {Array} events - A list of events.
     * @param {string} outputFile - The output file path. (default: "events.json")
     * @param {number} areaFilter - Optional area ID to filter events.
     * @param {number} artistFilter - Optional artist ID to filter events.
     */
    async saveEventsToJson(events, outputFile = "events.json", areaFilter = null, artistFilter = null) {
        const records = events.map(event => {
            // Handle different event data structures
            const eventData = event.event || event; // Use event.event for original query, or event directly for artist query
            
            return {
                title: eventData.title,
                date: eventData.date,
                startTime: eventData.startTime,
                endTime: eventData.endTime || null, // Artist query might not have endTime
                artists: eventData.artists ? eventData.artists.map(artist => artist.name) : [],
                venue: eventData.venue ? eventData.venue.name : null,
                contentUrl: eventData.contentUrl,
                attending: eventData.attending || eventData.interestedCount || 0,
                // Include additional metadata
                id: eventData.id,
                isTicketed: eventData.isTicketed,
                queueItEnabled: eventData.queueItEnabled,
                newEventForm: eventData.newEventForm,
                images: eventData.images || [],
                venueDetails: eventData.venue || null,
                artistDetails: eventData.artists || []
            };
        });

        // If both area and artist filters are specified, filter events by area
        let filteredRecords = records;
        if (areaFilter && artistFilter) {
            filteredRecords = records.filter(record => {
                const eventAreaId = record.venueDetails?.area?.id;
                return eventAreaId && eventAreaId === areaFilter.toString();
            });
            console.log(`Filtered to ${filteredRecords.length} events in area ${areaFilter}`);
        }

        const jsonData = {
            metadata: {
                totalEvents: filteredRecords.length,
                generatedAt: new Date().toISOString(),
                queryInfo: {
                    area: this.payload.variables.filters?.areas?.eq || null,
                    artist: this.payload.variables.filters?.artist?.eq || 
                           (Array.isArray(this.payload.variables.filters) ? 
                            this.payload.variables.filters.find(f => f.type === 'ARTIST')?.value : null) || null,
                    dateRange: {
                        gte: this.payload.variables.filters?.listingDate?.gte || 
                             (Array.isArray(this.payload.variables.filters) ? 
                              this.payload.variables.filters.find(f => f.type === 'DATERANGE')?.value : null) || null
                    }
                }
            },
            events: filteredRecords
        };

        fs.writeFileSync(outputFile, JSON.stringify(jsonData, null, 2));
        console.log(`Events saved to ${outputFile}`);
    }



    /**
     * Utility function to sleep for a given number of milliseconds.
     * @param {number} ms - Milliseconds to sleep.
     * @returns {Promise} A promise that resolves after the specified time.
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Main function to run the event fetcher.
 */
async function main() {
    const program = new Command();
    
    program
        .name('event-fetcher')
        .description('Fetch events from ra.co and save them to a JSON file.') 
        .option('-r, --area <id>', 'The area code to filter events (optional).', parseInt)
        .option('-a, --artist <id>', 'The artist ID to filter events (optional).', parseInt)
        .option('-p, --pages <number>', 'Number of pages to fetch (default: 1).', parseInt)
        .option('-gte, --gte <date>', 'Start date for events (format: YYYY-MM-DD, default: today).')
        .option('-lte, --lte <date>', 'End date for events (format: YYYY-MM-DD, optional).')
        .option('-o, --output <file>', 'The output file path', 'events.json')
        .parse();

    const options = program.opts();
    
    // Handle date options
    const today = new Date();
    const defaultGte = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
    
    const listingDateGte = options.gte ? 
        options.gte + 'T00:00:00.000Z' : 
        defaultGte;
    
    const listingDateLte = options.lte ? 
        options.lte + 'T23:59:59.999Z' : 
        null;

    // Use 0 as default for area and artist if not provided
    const areaId = options.area || 0;
    const artistId = options.artist || 0;
    const maxPages = options.pages || 1;
    const eventFetcher = new EventFetcher(areaId, artistId, listingDateGte, listingDateLte);

    // Fetch events with page limit
    let allEvents = await eventFetcher.fetchEventsWithPageLimit(maxPages);

    await eventFetcher.saveEventsToJson(allEvents, options.output, options.area, options.artist);
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = EventFetcher;
