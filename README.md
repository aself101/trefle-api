# Trefle API Service (Node.js)

[![npm version](https://img.shields.io/npm/v/trefle-api.svg)](https://www.npmjs.com/package/trefle-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/trefle-api)](https://nodejs.org)

A Node.js wrapper for the [Trefle Plants API](https://trefle.io/) that provides easy access to comprehensive plant data including species information, taxonomy, distributions, and more.

This service follows the data-collection architecture pattern with organized data storage, rate limiting, comprehensive logging, and CLI orchestration - a Node.js port of the Python implementation.

## Quick Start

### CLI Usage
```bash
# Install globally
npm install -g trefle-api

export TREFLE_API_TOKEN="your-token-here"

# Fetch plants
trefle --plants --pages 10

# Search for specific plants
trefle --search "rose" --search "oak"
```

### Programmatic Usage
```javascript
import { TrefleAPI } from 'trefle-api';

const api = new TrefleAPI();

// Get edible plants
const plants = await api.getPlants({
  filter: { edible: 'true' },
  page: 1
});

// Search for a specific plant
const coconuts = await api.searchPlants('coconut');

// Get detailed information about a specific plant
const plant = await api.getPlant(123456);
```

## Table of Contents

- [Overview](#overview)
- [Data Categories](#data-categories)
- [Authentication Setup](#authentication-setup)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [API Methods](#api-methods)
  - [Core Plant Endpoints](#core-plant-endpoints)
  - [Taxonomy Endpoints](#taxonomy-endpoints)
  - [Species Endpoints](#species-endpoints)
  - [Distribution Endpoints](#distribution-endpoints)
  - [Correction Endpoints](#correction-endpoints)
  - [Helper Methods](#helper-methods)
- [Examples](#examples)
- [Data Organization](#data-organization)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Differences from Python Version](#differences-from-python-version)
- [Responsible Use](#responsible-use)

## Overview

The Trefle API provides access to a vast database of plants with over 1.3 million records. This Node.js service implements:

- **30+ API Endpoints** - Plants, taxonomy, species, distributions, and corrections
- **Token-based Authentication** - Simple API key authentication
- **Auto-pagination** - Helper methods to fetch all pages automatically
- **Rate Limiting** - Built-in delays to respect API limits (120 req/min)
- **CLI Orchestration** - Command-line tool for batch fetching and data management
- **Organized Data Storage** - Structured directories for different data types
- **Data Enrichment** - Optionally fetch full details and flatten nested structures
- **Multiple Output Formats** - JSON, compressed JSON (gzip), CSV

## Data Categories

### Plants
Core plant endpoints for searching and browsing plant data.

**Endpoints:**
- `getPlants()` - List plants with filtering, sorting, and pagination
- `getPlant()` - Get specific plant by ID or slug
- `searchPlants()` - Search plants by query string
- `getPlantsByZone()` - List plants in a distribution zone
- `getPlantsByGenus()` - List plants for a specific genus
- `reportPlant()` - Report an error for a plant

**Parameters:**
- `filter` - Filter conditions (e.g., `{ edible: 'true', vegetable: 'true' }`)
- `filter_not` - Exclusion filters (e.g., `{ toxicity: 'high' }`)
- `order` - Sort order (e.g., `{ common_name: 'asc' }`)
- `range` - Range filters (e.g., `{ maximum_height: '10,100' }`)
- `page` - Page number for pagination

### Taxonomy
Hierarchical taxonomy data from kingdoms to genera.

**Endpoints:**
- `getKingdoms()` / `getKingdom()` - Plant kingdoms
- `getSubkingdoms()` / `getSubkingdom()` - Subkingdoms
- `getDivisions()` / `getDivision()` - Divisions (phyla)
- `getDivisionClasses()` / `getDivisionClass()` - Division classes
- `getDivisionOrders()` / `getDivisionOrder()` - Division orders
- `getFamilies()` / `getFamily()` - Plant families
- `getGenera()` / `getGenus()` - Plant genera

### Species
Species-specific endpoints with detailed information.

**Endpoints:**
- `getSpeciesList()` - List species with filtering
- `getSpecies()` - Get specific species by ID or slug
- `searchSpecies()` - Search species by query string
- `reportSpecies()` - Report an error for a species

### Distributions
Geographic distribution zones (TDWG regions).

**Endpoints:**
- `getDistributions()` - List all distribution zones
- `getDistribution()` - Get specific zone by ID or slug

**Common Zone Codes:**
- `usa` - United States
- `eur` - Europe
- `afr` - Africa
- `asi` - Asia
- `sam` - South America
- `nam` - North America
- `aus` - Australia

### Corrections
Community-submitted corrections to plant data.

**Endpoints:**
- `getCorrections()` - List all corrections
- `getCorrection()` - Get specific correction by ID
- `getCorrectionsForSpecies()` - Get corrections for a species

## Authentication Setup

### 1. Get Your API Token

1. Create an account at [https://trefle.io/](https://trefle.io/)
2. Confirm your email address
3. Log in and navigate to your account dashboard
4. Copy your API access token

### 2. Set Environment Variable

Add your token to the `.env` file in the project root:

```bash
TREFLE_API_TOKEN=your_token_here
```

**Important:** Never commit your `.env` file or expose your token publicly.

## Installation

### Option 1: Install from npm

```bash
# Install globally for CLI usage
npm install -g trefle-api

# Or install locally in your project
npm install trefle-api
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/yourusername/trefle-api.git
cd trefle-api

# Install dependencies
npm install
```

Dependencies:
- `axios` - HTTP client for API calls
- `commander` - CLI argument parsing
- `dotenv` - Environment variable management
- `winston` - Logging framework

## API Methods

### Core Plant Endpoints

#### `getPlants(options)`

List plants with optional filtering, sorting, and pagination.

**Parameters:**
```javascript
{
  filter: Object,      // Filter conditions (e.g., { edible: 'true', vegetable: 'true' })
  filter_not: Object,  // Exclusion filters (e.g., { toxicity: 'high' })
  order: Object,       // Sort order (e.g., { common_name: 'asc' })
  range: Object,       // Range filters (e.g., { maximum_height: '10,100' })
  page: Number         // Page number
}
```

**Returns:** Promise<Object> with 'data', 'links', and 'meta' keys

**Example:**
```javascript
// Get edible vegetables, sorted alphabetically
const plants = await api.getPlants({
  filter: { edible: 'true', vegetable: 'true' },
  order: { common_name: 'asc' },
  page: 1
});

// Get tall trees (10-100 meters height)
const trees = await api.getPlants({
  filter: { ligneous_type: 'tree' },
  range: { maximum_height: '1000,10000' },  // in cm
  page: 1
});
```

**Available Filters:**
- Plant characteristics: `edible`, `vegetable`, `toxicity`, `edible_part`
- Physical traits: `flower_color`, `fruit_color`, `foliage_color`, `growth_habit`, `growth_rate`
- Size ranges: `average_height`, `maximum_height`, `spread`
- Environmental: `atmospheric_humidity`, `light`, `soil_humidity`, `ph_minimum`, `ph_maximum`
- Taxonomy: `family_name`, `genus_name`, `common_name`, `scientific_name`
- Lifecycle: `bloom_months`, `fruit_months`, `growth_months`, `duration`

---

#### `getPlant(plantId)`

Get specific plant by ID or slug.

**Parameters:**
- `plantId` (Number|String): Plant ID or slug

**Returns:** Promise<Object> - Complete plant object with main_species, genus, family, etc.

**Example:**
```javascript
const plant = await api.getPlant(123456);
console.log(plant.data.common_name);
console.log(plant.data.scientific_name);
```

---

#### `searchPlants(query, options)`

Search plants by query string. Searches across scientific name, common name, and synonyms.

**Parameters:**
```javascript
query: String,  // Required search query
options: {
  page: Number,
  filter: Object,
  filter_not: Object,
  order: Object,
  range: Object
}
```

**Returns:** Promise<Object> - Search results with 'data', 'links', and 'meta' keys

**Example:**
```javascript
// Simple search
const results = await api.searchPlants('coconut');

// Search with filters
const roses = await api.searchPlants('rose', {
  filter: { edible: 'true' }
});
```

---

#### `getPlantsByZone(zoneId, options)`

List plants in a specific distribution zone.

**Parameters:**
- `zoneId` (String): TDWG zone code (e.g., 'usa', 'eur', 'afr')
- `options` (Object): Same as getPlants()

**Returns:** Promise<Object> - Plants found in the specified zone

**Example:**
```javascript
// Get plants native to USA
const usaPlants = await api.getPlantsByZone('usa', { page: 1 });

// Get edible plants in Europe
const eurEdibles = await api.getPlantsByZone('eur', {
  filter: { edible: 'true' }
});
```

**Common Zone Codes:**
- `usa` - United States
- `eur` - Europe
- `afr` - Africa
- `asi` - Asia
- `sam` - South America
- `nam` - North America
- `aus` - Australia

---

#### `getPlantsByGenus(genusId, options)`

List plants for a specific genus.

**Parameters:**
- `genusId` (Number): Genus ID
- `options` (Object): Same as getPlants()

**Returns:** Promise<Object> - Plants in the specified genus

**Example:**
```javascript
// Get all roses (Rosa genus)
const roses = await api.getPlantsByGenus(1234, { page: 1 });
```

---

#### `reportPlant(plantId, notes)`

Report an error for a plant.

**Parameters:**
- `plantId` (Number): Plant ID to report error for
- `notes` (String): Description of the error or issue

**Returns:** Promise<Object> - Correction object

**Example:**
```javascript
const correction = await api.reportPlant(
  123456,
  "Common name is misspelled - should be 'Oak' not 'Oka'"
);
```

---

### Taxonomy Endpoints

The following endpoints provide access to the plant taxonomy hierarchy.

#### `getKingdoms(options)` / `getKingdom(id)`

List all kingdoms or get a specific kingdom.

```javascript
// List all kingdoms
const kingdoms = await api.getKingdoms({ page: 1 });

// Get specific kingdom
const kingdom = await api.getKingdom('plantae');
```

---

#### `getSubkingdoms(options)` / `getSubkingdom(id)`

List all subkingdoms or get a specific subkingdom.

```javascript
const subkingdoms = await api.getSubkingdoms({ page: 1 });
const subkingdom = await api.getSubkingdom(123);
```

---

#### `getDivisions(options)` / `getDivision(id)`

List all divisions or get a specific division.

```javascript
const divisions = await api.getDivisions({ page: 1 });
const division = await api.getDivision('magnoliophyta');
```

---

#### `getDivisionClasses(options)` / `getDivisionClass(id)`

List all division classes or get a specific division class.

```javascript
const classes = await api.getDivisionClasses({ page: 1 });
const divClass = await api.getDivisionClass(123);
```

---

#### `getDivisionOrders(options)` / `getDivisionOrder(id)`

List all division orders or get a specific division order.

```javascript
const orders = await api.getDivisionOrders({ page: 1 });
const order = await api.getDivisionOrder('rosales');
```

---

#### `getFamilies(options)` / `getFamily(id)`

List all families or get a specific family. Supports filtering and sorting.

```javascript
// List families
const families = await api.getFamilies({
  filter: { name: 'Rosa' },
  page: 1
});

// Get specific family
const rosaceae = await api.getFamily('rosaceae');
```

---

#### `getGenera(options)` / `getGenus(id)`

List all genera or get a specific genus. Supports filtering and sorting.

```javascript
// List genera
const genera = await api.getGenera({ page: 1 });

// Get specific genus
const rosa = await api.getGenus('rosa');
```

---

### Species Endpoints

#### `getSpeciesList(options)`

List species with optional filtering, sorting, and pagination.

**Parameters:** Same as `getPlants()`

```javascript
const species = await api.getSpeciesList({
  filter: { edible: 'true' },
  page: 1
});
```

---

#### `getSpecies(speciesId)`

Get a specific species by ID or slug.

```javascript
const species = await api.getSpecies(123456);
console.log(species.data.scientific_name);
```

---

#### `searchSpecies(query, options)`

Search species by query string.

```javascript
const results = await api.searchSpecies('oak', { page: 1 });
```

---

#### `reportSpecies(speciesId, notes)`

Report an error for a species.

```javascript
const correction = await api.reportSpecies(123456, 'Scientific name spelling error');
```

---

### Distribution Endpoints

#### `getDistributions(options)`

List all distribution zones with pagination.

```javascript
const distributions = await api.getDistributions({ page: 1 });
```

---

#### `getDistribution(distributionId)`

Get a specific distribution zone by ID or slug.

```javascript
const zone = await api.getDistribution('usa');
console.log(zone.data.name);
```

---

### Correction Endpoints

#### `getCorrections(options)`

List all corrections with pagination.

```javascript
const corrections = await api.getCorrections({ page: 1 });
```

---

#### `getCorrection(correctionId)`

Get a specific correction by ID.

```javascript
const correction = await api.getCorrection(123);
```

---

#### `getCorrectionsForSpecies(recordId)`

Get corrections for a specific species record.

```javascript
const corrections = await api.getCorrectionsForSpecies(123456);
```

---

### Helper Methods

#### `getAllPages(methodName, options)`

Helper method to fetch all pages of results automatically.

**Parameters:**
```javascript
methodName: String,  // Name of API method ('getPlants', 'searchPlants', etc.)
options: {
  maxPages: Number,  // Maximum pages to fetch (null for all)
  ...otherParams     // Parameters to pass to the method
}
```

**Returns:** Promise<Array> - Combined data from all pages

**Example:**
```javascript
// Get all edible plants (all pages)
const allEdibles = await api.getAllPages('getPlants', {
  filter: { edible: 'true' }
});

// Get first 5 pages only
const limited = await api.getAllPages('getPlants', {
  maxPages: 5,
  filter: { vegetable: 'true' }
});
```

## CLI Usage

The CLI provides command-line access to fetch and save plant data.

### Basic Command Structure

```bash
# Global install
trefle [endpoint] [options]

# Local install (use npx)
npx trefle [endpoint] [options]

# From source (development)
npm run trefle -- [endpoint] [options]
```

### Basic Commands

```bash
# Show help
trefle --help

# Fetch everything
trefle --all

# Fetch reference data only
trefle --all-single

# Fetch plants with pagination
trefle --plants --pages 10
```

**Note:** Examples below use `trefle` command (global install). For local install, use `npx trefle` instead. For development from source, use `npm run trefle -- [flags]`.

### Search Commands

```bash
# Single search
trefle --search "maple"

# Multiple searches
trefle --search "oak" --search "pine" --search "rose"
```

### Advanced Options

```bash
# Start from specific page
trefle --plants --start-page 5 --pages 10

# Fetch with enrichment (full details + flattened structure)
trefle --plants --pages 5 --enrichment

# Output as compressed JSON
trefle --plants --pages 10 --format json.gz

# Dry run (preview without fetching)
trefle --all --dry-run

# Debug logging
trefle --plants --log-level DEBUG
```

### CLI Flags Reference

**Category Flags:**
| Flag | Description |
|------|-------------|
| `--all` | Fetch all data (reference + all plant pages) |
| `--all-single` | Fetch all reference data (zones, genus list) |
| `--all-plants` | Fetch all plant pages |

**Plant Endpoint Flags:**
| Flag | Description |
|------|-------------|
| `--plants` | Fetch plants (use --pages to limit) |
| `--plants-combined` | Shortcut for `--plants --enrichment` |
| `--search <queries...>` | Search plants by query (can specify multiple) |
| `--plant-id <ids...>` | Fetch specific plants by ID (can specify multiple) |

**Taxonomy Endpoint Flags:**
| Flag | Description |
|------|-------------|
| `--kingdoms` | Fetch all kingdoms |
| `--kingdom <id>` | Fetch specific kingdom by ID or slug |
| `--subkingdoms` | Fetch all subkingdoms |
| `--subkingdom <id>` | Fetch specific subkingdom by ID or slug |
| `--divisions` | Fetch all divisions |
| `--division <id>` | Fetch specific division by ID or slug |
| `--division-classes` | Fetch all division classes |
| `--division-class <id>` | Fetch specific division class by ID or slug |
| `--division-orders` | Fetch all division orders |
| `--division-order <id>` | Fetch specific division order by ID or slug |
| `--families` | Fetch all families |
| `--family <id>` | Fetch specific family by ID or slug |
| `--genera` | Fetch all genera |
| `--genus <id>` | Fetch specific genus by ID or slug |

**Species Endpoint Flags:**
| Flag | Description |
|------|-------------|
| `--species` | Fetch species list |
| `--species-id <id>` | Fetch specific species by ID or slug |
| `--search-species <queries...>` | Search species by query (can specify multiple) |

**Distribution & Correction Flags:**
| Flag | Description |
|------|-------------|
| `--zones` | Fetch all distribution zones |
| `--zone <id>` | Fetch specific distribution zone by ID or slug |
| `--corrections` | Fetch all corrections |
| `--correction <id>` | Fetch specific correction by ID |

**Pagination Options:**
| Flag | Description |
|------|-------------|
| `--pages <N>` | Number of pages to fetch |
| `--start-page <N>` | Starting page number (default: 1) |

**Other Options:**
| Flag | Description |
|------|-------------|
| `--enrichment` | Enrich data by fetching full details for each plant |
| `--format <format>` | Output format: `json` (default), `json.gz`, `csv` |
| `--dry-run` | Preview operations without fetching |
| `--log-level <level>` | Set logging level (DEBUG, INFO, WARNING, ERROR) |

## Data Organization

The CLI organizes fetched data into structured directories:

```
datasets/
└── trefle/
    ├── single/                      # One-time reference data
    │   ├── zones.json              # Distribution zones
    │   └── genus_list.json         # Genus reference list
    ├── taxonomy/                    # Taxonomy data
    │   ├── kingdoms.json
    │   ├── divisions.json
    │   ├── families.json
    │   └── genera.json
    ├── species/                     # Species data
    │   ├── species_list.json
    │   └── search/
    ├── distributions/               # Distribution zone data
    ├── corrections/                 # Correction data
    ├── plants_pages_1-10.json      # Paginated plant lists (batched)
    ├── plants_pages_11-20.json     # 10 pages per file (basic mode)
    ├── plants_pages_1-5_enriched.json  # 5 pages per file (enriched mode)
    ├── plants_by_id/               # Individual plant details
    │   ├── plant_123456.json
    │   └── plant_789012.json
    └── search/                      # Search results
        ├── rose_results.json
        ├── oak_results.json
        └── maple_results_enriched.json
```

## Rate Limiting

The Trefle API has a rate limit of **120 requests per minute**.

### Automatic Rate Limiting

The CLI automatically implements rate limiting:
- Random delays of 2-5 seconds between requests
- This averages ~0.5 requests per second (30 requests/min)
- Well below the 120 req/min limit to ensure stability

### Manual Rate Limiting

When using the API class directly, implement your own rate limiting:

```javascript
import { pause, randomNumber } from './utils.js';

const api = new TrefleAPI();

for (let page = 1; page <= 100; page++) {
  const plants = await api.getPlants({ page });
  // Process plants...

  // Rate limiting pause
  await pause(randomNumber(2, 5));
}
```

## Examples

### Example 1: Find Edible Plants Native to USA

```javascript
import { TrefleAPI } from './api.js';

const api = new TrefleAPI();

// Get edible plants in USA
const usaEdibles = await api.getPlantsByZone('usa', {
  filter: { edible: 'true' },
  page: 1
});

for (const plant of usaEdibles.data) {
  console.log(`${plant.common_name} - ${plant.scientific_name}`);
}
```

### Example 2: Batch Fetch All Fruit Trees

```javascript
import { TrefleAPI } from './api.js';
import { writeToFile, pause, randomNumber } from './utils.js';

const api = new TrefleAPI();

const fruitTrees = await api.getAllPages('getPlants', {
  filter: {
    ligneous_type: 'tree',
    fruit_conspicuous: 'true'
  }
});

// Save to file
await writeToFile(fruitTrees, 'datasets/fruit_trees.json');
```

### Example 3: Search and Filter

```javascript
const api = new TrefleAPI();

// Search for roses that are fragrant and edible
const fragrantRoses = await api.searchPlants('rose', {
  filter: {
    edible: 'true',
    flower_conspicuous: 'true'
  }
});

console.log(`Found ${fragrantRoses.data.length} fragrant edible roses`);
```

### Example 4: Explore Plant Taxonomy

```javascript
const api = new TrefleAPI();

// Get all plant families
const families = await api.getFamilies({ page: 1 });
console.log(`Found ${families.meta.total} families`);

// Get details for a specific family
const rosaceae = await api.getFamily('rosaceae');
console.log(`Rosaceae has ${rosaceae.data.species_count} species`);

// Get all genera in the Rosa family
const genera = await api.getGenera({
  filter: { family_id: rosaceae.data.id },
  page: 1
});
```

### Example 5: CLI Batch Fetching with Enrichment

```bash
# Fetch plants with full enrichment
trefle --plants --pages 10 --enrichment --format json.gz

# Search for medicinal herbs with enrichment
trefle \
  --search "chamomile" \
  --search "lavender" \
  --search "mint" \
  --enrichment

# Fetch taxonomy data
trefle --kingdoms --divisions --families

# Fetch zone data
trefle --zones
```

## Differences from Python Version

This Node.js implementation maintains feature parity with the Python version while adapting to JavaScript/Node.js idioms:

### Language & Runtime
- **ES Modules** instead of Python imports (`import`/`export` vs `import`/`from`)
- **Async/Await** for all API calls (vs Python's sync requests)
- **Commander.js** for CLI parsing (vs Python's argparse)
- **Winston** for logging (vs Python's logging module)

### API Differences
- Methods use camelCase (e.g., `getPlants`) vs Python's snake_case (`get_plants`)
- Options passed as object destructuring vs keyword arguments
- Promises instead of synchronous returns

### File I/O
- Native Node.js `fs/promises` for async file operations
- `zlib` module for compression (vs Python's gzip)
- Simpler CSV handling (basic implementation vs pandas)

### Utilities
- `randomNumber()` uses `Math.random()` vs Python's `random.randint()`
- `pause()` returns Promise with `setTimeout` vs `time.sleep()`
- Flattening utilities use object destructuring vs Python dict operations

### CLI
- Commander.js flags and options vs argparse
- Slightly different flag syntax but same functionality
- Maintains same data organization structure

### Feature Parity
- All 30+ API endpoints (plants, taxonomy, species, distributions, corrections)
- Auto-pagination helper
- Rate limiting with random delays
- Data enrichment with flattening
- Batch processing (10 pages for basic, 5 for enriched)
- Multiple output formats (JSON, JSON.gz, CSV)
- Dry-run mode
- Comprehensive logging
- Organized data storage

## Response Format

All API methods return JSON responses in this format:

```json
{
  "data": [
    {
      "id": 123456,
      "common_name": "Oak",
      "scientific_name": "Quercus robur",
      "genus": "Quercus",
      "family": "Fagaceae",
      ...
    }
  ],
  "links": {
    "self": "/api/v1/plants?page=1",
    "first": "/api/v1/plants?page=1",
    "next": "/api/v1/plants?page=2",
    "prev": null,
    "last": "/api/v1/plants?page=50"
  },
  "meta": {
    "total": 500
  }
}
```

## Error Handling

The service includes comprehensive error handling:

```javascript
try {
  const plants = await api.getPlants({ page: 1 });
} catch (error) {
  if (error.response) {
    console.error(`HTTP Error: ${error.response.status}`);
  } else {
    console.error(`Error: ${error.message}`);
  }
}
```

All errors are logged automatically with context information.

## Troubleshooting

### Token Not Found Error

```
Error: TREFLE_API_TOKEN not found in environment variables
```

**Solution:** Add your token to the `.env` file:
```bash
TREFLE_API_TOKEN=your_actual_token_here
```

### Rate Limit Exceeded

```
HTTP Error: 429 Too Many Requests
```

**Solution:** The API automatically rate limits, but if you see this:
1. Increase delays between requests
2. Reduce concurrent requests
3. Wait a minute before retrying

### Authentication Failed

```
HTTP Error: 401 Unauthorized
```

**Solution:**
1. Verify your token is correct
2. Check that your account is confirmed
3. Generate a new token from trefle.io if needed

### Module Not Found

```
Error: Cannot find module 'axios'
```

**Solution:** Install dependencies:
```bash
cd trefle-api
npm install
```

## Development Scripts

**Note:** These npm scripts are only available when working from the source repository.

```bash
npm run trefle              # Run CLI
npm run trefle:help         # Show help
npm run trefle:all          # Fetch all data
npm run trefle:plants       # Fetch first 10 pages of plants
npm run trefle:dry-run      # Dry run preview
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report
```

Pass additional flags with `--`:

```bash
npm run trefle -- --search "oak" --enrichment
```

## Additional Resources

- [Trefle API Documentation](https://docs.trefle.io/)
- [Trefle Website](https://trefle.io/)
- [Getting Started Guide](https://docs.trefle.io/docs/guides/getting-started)
- [API Reference](https://docs.trefle.io/reference/)

---

**Disclaimer:** This project is an independent community wrapper and is not affiliated with trefle.io.

## Responsible Use

This package includes built-in rate limiting (2-5 second delays between requests), but users are ultimately responsible for how they use this tool. Please:

- **Respect rate limits** - Avoid excessive requests that could burden the server (120 req/min limit)
- **Use reasonably** - Fetch only the data you need, when you need it
- **Cache appropriately** - Store fetched data locally rather than re-fetching repeatedly
- **Follow terms of service** - Comply with trefle.io's usage policies

Abuse of this package (e.g., excessive requests, circumventing access controls) may result in your API token being revoked or your account being suspended. The maintainers of this package are not responsible for any consequences arising from misuse.

## License

MIT
