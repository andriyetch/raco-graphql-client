const EventFetcher = require('./eventFetcher');

/**
 * Example usage of the EventFetcher class
 */
async function example() {
    console.log('RA.co Event Fetcher Example');
    console.log('============================\n');

    try {
        // Example 1: Area-based filtering (London area 13)
        console.log('Example 1: Area-based filtering for London...\n');
        
        // Use current day onwards (no end date)
        const today = new Date();
        const todayGte = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
        
        const areaEventFetcher = new EventFetcher(
            13, // London area code
            0,  // No artist filter
            todayGte, // Current day onwards
            null  // No end date limit
        );

        const areaEvents = await areaEventFetcher.fetchEventsWithPageLimit(1); // Default to 1 page
        if (areaEvents.length > 0) {
            await areaEventFetcher.saveEventsToJson(areaEvents, 'example_area_events.json');
            console.log(`Successfully saved ${areaEvents.length} area-based events to example_area_events.json`);
        }

        // Example 2: Artist-based filtering (Rival Consoles - ID 44361)
        console.log('\nExample 2: Artist-based filtering for Rival Consoles...\n');
        const artistEventFetcher = new EventFetcher(
            0, // No area filter for artist queries
            44361, // Artist ID for Rival Consoles
            todayGte, // Current day onwards
            null  // No end date limit
        );

        const artistEvents = await artistEventFetcher.fetchEventsWithPageLimit(1); // Default to 1 page
        if (artistEvents.length > 0) {
            await artistEventFetcher.saveEventsToJson(artistEvents, 'example_artist_events.json');
            console.log(`Successfully saved ${artistEvents.length} artist-based events to example_artist_events.json`);
        } else {
            console.log('No events found for the specified artist and date range');
        }

        // Example 3: Multiple pages
        console.log('\nExample 3: Fetching multiple pages...\n');
        const multiPageEventFetcher = new EventFetcher(
            13, // London area
            0,  // No artist filter
            todayGte, // Current day onwards
            null  // No end date limit
        );

        const multiPageEvents = await multiPageEventFetcher.fetchEventsWithPageLimit(3); // Fetch 3 pages
        if (multiPageEvents.length > 0) {
            await multiPageEventFetcher.saveEventsToJson(multiPageEvents, 'example_multipage_events.json');
            console.log(`Successfully saved ${multiPageEvents.length} multi-page events to example_multipage_events.json`);
        }

        // Example 4: Custom date range
        console.log('\nExample 4: Custom date range...\n');
        const customDateEventFetcher = new EventFetcher(
            13, // London area
            0,  // No artist filter
            '2025-08-20T00:00:00.000Z', // Custom start date
            '2025-08-25T23:59:59.999Z'  // Custom end date
        );

        const customDateEvents = await customDateEventFetcher.fetchEventsWithPageLimit(1); // Fetch 1 page
        if (customDateEvents.length > 0) {
            await customDateEventFetcher.saveEventsToJson(customDateEvents, 'example_custom_date_events.json');
            console.log(`Successfully saved ${customDateEvents.length} custom date range events to example_custom_date_events.json`);
        }



    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the example
example();
