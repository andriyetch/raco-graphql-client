# RA.co Event Fetcher

A Node.js tool to fetch event data from the RA.co GraphQL API and save it as a JSON file. Accepts RA.co area ID, artist ID, start date, and/or end date as command-line arguments and saves the fetched events to a JSON file.

Please use responsibly :) RA.co's GraphQL API is undocumented and not officially supported, don't throw thousands of requests at it in short periods - we don't want it to be thrown behind some kind of authentication.

## Installation

1. Clone the repository or download the source code.
2. Run `npm install` to install the required dependencies.

## Usage

### CLI Tool (One-time queries)

This is the original command-line tool for one-time event queries.

#### Options

- `-r, --area <id>`: (Optional) The area code to filter events.
- `-a, --artist <ids>`: (Optional) The artist ID(s) to filter events. Can be a single ID or comma-separated list of IDs (e.g., "1013,44361,789").
- `-p, --pages <number>`: (Optional) Number of pages to fetch (default: 1).
- `-gte, --gte <date>`: (Optional) Start date for events (format: YYYY-MM-DD, default: today).
- `-lte, --lte <date>`: (Optional) End date for events (format: YYYY-MM-DD).
- `-o, --output <file>`: (Optional) The output file path (default: `events.json`).

### Examples

To fetch all events from today onwards:

```bash
node eventFetcher.js
```

To fetch events for an area (e.g. area ID 13 for London) from today onwards:

```bash
node eventFetcher.js -r 13 -o events.json
```

To fetch events for a specific artist (e.g., artist ID 1013 for Seth Troxler) from today onwards:

```bash
node eventFetcher.js -a 1013 -o artist_events.json
```

To fetch events for multiple artists (e.g., artist IDs 1013, 44361, and 789) from today onwards:

```bash
node eventFetcher.js -a "1013,44361,789" -o multiple_artists_events.json
```

To fetch events for a specific artist in a specific area from today onwards:

```bash
node eventFetcher.js -r 13 -a 1013 -o artist_area_events.json
```

To fetch events for multiple artists in a specific area from today onwards:

```bash
node eventFetcher.js -r 13 -a "1013,44361" -o multiple_artists_area_events.json
```

To fetch multiple pages of events (e.g., 5 pages):

```bash
node eventFetcher.js -r 13 -p 5 -o multiple_pages.json
```

To fetch events for a specific date range:

```bash
# Events from a specific start date onwards
node eventFetcher.js -r 13 -gte 2025-08-20

# Events within a specific date range
node eventFetcher.js -r 13 -gte 2025-08-20 -lte 2025-08-25

# Events for an artist in a date range
node eventFetcher.js -a 1013 -gte 2025-08-20 -lte 2025-08-25

# Events for multiple artists in a date range
node eventFetcher.js -a "1013,44361" -gte 2025-08-20 -lte 2025-08-25
```

Or using npm script:

```bash
npm start -- -r 13 -o events.json
```

### Cloud Server (Automated monitoring)

For continuous monitoring with push notifications, use the cloud server version:

```bash
# Run the cloud server
npm run server

# Or for development
npm run dev
```

See [README_CLOUD.md](README_CLOUD.md) for full cloud server documentation.

## Output

The fetched events will be saved to the specified output file (JSON by default) with comprehensive event data including:

- Event details (title, date, times, URL)
- Artist information
- Venue details with area information
- Attendance counts
- Images and metadata
- Query information and timestamps

## Features

- **Dual Filtering**: Search by area code OR artist ID
- **Multi-Artist Support**: Search by multiple artists using comma-separated IDs
- **Combined Filtering**: Search by artist(s) globally, then filter by area
- **Flexible Date Ranges**: Default to current day onwards, with custom date options
- **Pagination Control**: Fetch single page by default, or specify multiple pages
- **Rich JSON Output**: Comprehensive event data with metadata
- **Rate Limiting**: Includes delays between requests to be respectful to the API
- **Error Handling**: Gracefully handles API errors and continues processing
- **Command Line Interface**: Easy-to-use CLI with argument parsing

## 🚀 Cloud Server Version

This project also includes a **cloud server version** with automated monitoring and push notifications! See [README_CLOUD.md](README_CLOUD.md) for details.

### Cloud Server Features:
- **Automated Monitoring**: Runs every 3 hours to check for new events
- **Push Notifications**: Sends notifications to your phone via Pushover
- **Web Dashboard**: Beautiful web interface for monitoring and manual controls
- **SQLite Database**: Prevents duplicate notifications
- **REST API**: Full API for integration with other services

### Quick Start (Cloud Server):
```bash
# Install dependencies
npm install

# Configure environment and artists
cp env.example .env
# Edit .env with your Pushover credentials
# Edit config.json with your artists and location

# Run the server
npm run server

# Or for development with auto-restart
npm run dev
```

## Dependencies

- `axios`: For making HTTP requests to the GraphQL API
- `commander`: For parsing command-line arguments

## How to find area IDs?

- Navigate to the page of the location you want the ID for, e.g. https://ra.co/events/nl/utrecht and open Inspect Element.
- Ctrl + F the contents of the HTML for "eventAreaId" or "eventsAreaId". Most times it'll show up here, certain locations don't work this way I don't really know why. Searching for a more consistent way of doing this.

## How to find artist IDs?

- Navigate to the page of the artist you want the ID for, e.g. https://ra.co/dj/sethtroxler and open browser Dev Tools.
- Click on the Network tab in Dev Tools, filter by 'graphql', then on the webpage click on "Upcoming Events" or "Past Events".
- You'll see a new graphql request appear in Dev Tools, open up the Response tab and you'll see the list of events loaded for the artist. In the meta data of each event you'll find the artist ID for any artists involved. 
