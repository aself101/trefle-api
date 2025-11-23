#!/usr/bin/env node

/**
 * Trefle API Data Fetcher - Main Orchestration Script
 *
 * CLI tool for fetching plant data from the Trefle API and saving to local files.
 * Follows the data-collection architecture pattern with organized data storage,
 * rate limiting, and comprehensive logging.
 *
 * Usage:
 *   node main.js --all                    # Fetch all data
 *   node main.js --plants --pages 5       # Fetch first 5 pages of plants
 *   node main.js --search "rose"          # Search for roses
 *   node main.js --zones --genus-list     # Fetch reference data
 *
 * Data Organization:
 *   datasets/
 *   ├── trefle/
 *   │   ├── single/          # One-time reference data
 *   │   │   ├── zones.json
 *   │   │   └── genus_list.json
 *   │   ├── plants/          # Paginated plant lists
 *   │   │   ├── plants_pages_1-10.json
 *   │   │   └── ...
 *   │   └── search/          # Search results
 *   │       └── {query}_results.json
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TrefleAPI } from './api.js';
import {
  writeToFile,
  randomNumber,
  pause,
  callAPI,
  trimPlantSynonyms,
  flattenPlantData,
  setLogLevel,
  logger
} from './utils.js';

// ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const { version } = packageJson;

// Base directory for plant data
const BASE_DATA_DIR = path.join(process.cwd(), 'datasets');

/**
 * Get the appropriate file extension for the given format.
 *
 * @param {string} fileFormat - Format type ('json', 'csv', 'json.gz')
 * @returns {string} File extension including the dot
 */
function getFileExtension(fileFormat) {
  if (fileFormat === 'json.gz') {
    return '.json.gz';
  } else if (fileFormat === 'csv') {
    return '.csv';
  } else {
    return '.json';
  }
}

/**
 * Enrich a list of plants by fetching detailed data for each plant and flattening.
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Array} plants - List of plant objects from paginated endpoints
 * @param {boolean} dryRun - If true, skip actual API calls
 * @returns {Promise<Array>} List of enriched and flattened plant objects
 */
async function enrichPlantData(api, plants, dryRun = false) {
  if (!plants || plants.length === 0) {
    return [];
  }

  const enrichedPlants = [];

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    const plantId = plant.id;

    if (!plantId) {
      logger.warn(`  ⚠ Plant ${i + 1}/${plants.length} has no ID, skipping`);
      continue;
    }

    try {
      if (dryRun) {
        logger.info(`  [DRY RUN] Would fetch details for plant ${i + 1}/${plants.length} (ID: ${plantId})`);
        enrichedPlants.push(plant);
      } else {
        logger.info(`  Fetching details for plant ${i + 1}/${plants.length} (ID: ${plantId})...`);
        const detailedResult = await api.getPlant(plantId);

        // Flatten and combine the data
        if (detailedResult.data) {
          const flattened = flattenPlantData(plant, detailedResult.data);
          enrichedPlants.push(flattened);
          logger.info(`    ✓ Enriched data for ${plant.scientific_name || 'unknown'}`);
        } else {
          // If detailed fetch has no data, include partial from paginated
          logger.warn('    ⚠ No detailed data returned, using partial data');
          enrichedPlants.push(plant);
        }

        // Rate limiting pause between detail fetches (2-5 seconds)
        await pause(randomNumber(2, 5));
      }
    } catch (error) {
      logger.error(`    ✗ Error fetching details for plant ${plantId}: ${error.message}`);
      // Include partial data from paginated list
      logger.info('    → Including partial data from paginated list');
      enrichedPlants.push(plant);
    }
  }

  return enrichedPlants;
}

/**
 * Fetch single-request reference data endpoints.
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchSingleEndpoints(api, options) {
  // Fetch genus list (zones are handled in fetchDistributionsAndCorrections)
  if (options.genusList) {
    const singleDir = path.join(BASE_DATA_DIR, 'trefle/single');

    logger.info('='.repeat(60));
    logger.info('Fetching genus list...');
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info('[DRY RUN] Would fetch genus list to: datasets/trefle/single/genus_list.json');
    } else {
      // Note: Trefle doesn't have a simple genus list endpoint
      logger.warn('Genus list endpoint not yet implemented in TrefleAPI');

      // Rate limiting pause
      await pause(randomNumber(2, 5));
    }
  }
}

/**
 * Fetch plants with pagination, batching every 10 pages into single files.
 * Optionally enriches data with full plant details when --enrichment flag is set.
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchPlants(api, options) {
  if (!options.plants) {
    return;
  }

  const plantsDir = path.join(BASE_DATA_DIR, 'trefle/plants');
  const fileExt = getFileExtension(options.format);
  const enrichedSuffix = options.enrichment ? '_enriched' : '';

  logger.info('='.repeat(60));
  logger.info(`Fetching plants (${options.enrichment ? 'enriched' : 'paginated'})...`);
  if (options.enrichment) {
    logger.info('Enrichment enabled: Fetching full details for each plant');
  }
  logger.info(`Output format: ${options.format}`);
  logger.info('='.repeat(60));

  let page = options.startPage;
  let pagesFetched = 0;
  const batchSize = options.enrichment ? 5 : 10; // Smaller batches for enriched data
  let batchData = []; // Accumulate data for current batch
  let batchStartPage = page;

  while (true) {
    // Check if we've hit the page limit
    if (options.pages && pagesFetched >= options.pages) {
      logger.info(`Reached page limit (${options.pages}). Stopping.`);
      // Save any remaining batch data
      if (batchData.length > 0 && !options.dryRun) {
        const batchEndPage = page - 1;
        const filepath = path.join(plantsDir, `plants_pages_${batchStartPage}-${batchEndPage}${enrichedSuffix}${fileExt}`);
        await writeToFile(batchData, filepath, options.format);
        logger.info(`✓ Saved final batch (pages ${batchStartPage}-${batchEndPage}) to ${filepath}`);
      }
      break;
    }

    logger.info(`Fetching page ${page}...`);

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would fetch plants page ${page}`);
      if (options.enrichment) {
        logger.info('[DRY RUN] Would enrich data for plants on this page');
      }
      pagesFetched++;
      page++;

      // For dry run, show batch example every batchSize pages
      if (pagesFetched % batchSize === 0) {
        const batchEnd = page - 1;
        const batchStart = batchEnd - batchSize + 1;
        logger.info(`[DRY RUN] Would write batch: datasets/trefle/plants/plants_pages_${batchStart}-${batchEnd}${enrichedSuffix}${fileExt}`);
      }

      // For dry run, stop after showing 3 batches worth
      if (pagesFetched >= 15) {
        logger.info('[DRY RUN] (showing first 15 pages / 3 batches only)');
        break;
      }
    } else {
      try {
        // Fetch the page
        const result = await api.getPlants({ page });

        // Process the data
        if (result.data && result.data.length > 0) {
          const pagePlants = result.data;

          if (options.enrichment) {
            // Enrich with full plant details
            logger.info(`✓ Fetched page ${page} (${pagePlants.length} plants)`);
            const enrichedData = await enrichPlantData(api, pagePlants, options.dryRun);
            batchData.push(...enrichedData);
          } else {
            // Trim synonyms only (basic mode)
            const trimmedData = trimPlantSynonyms(pagePlants, 5);
            batchData.push(...trimmedData);
            logger.info(`✓ Fetched page ${page} (${trimmedData.length} plants)`);
          }

          pagesFetched++;

          // Check if we've completed a batch
          if (pagesFetched % batchSize === 0) {
            const batchEndPage = page;
            const filepath = path.join(plantsDir, `plants_pages_${batchStartPage}-${batchEndPage}${enrichedSuffix}${fileExt}`);
            await writeToFile(batchData, filepath, options.format);
            logger.info(`✓✓ Saved batch (pages ${batchStartPage}-${batchEndPage}) with ${batchData.length} total plants to ${filepath}`);

            // Reset batch for next set
            batchData = [];
            batchStartPage = page + 1;
          }

          // Check if there's a next page
          if (result.links && result.links.next) {
            page++;

            // Rate limiting pause between requests
            await pause(randomNumber(2, 5));
          } else {
            logger.info('No more pages available.');
            // Save any remaining batch data
            if (batchData.length > 0) {
              const batchEndPage = page;
              const filepath = path.join(plantsDir, `plants_pages_${batchStartPage}-${batchEndPage}${enrichedSuffix}${fileExt}`);
              await writeToFile(batchData, filepath, options.format);
              logger.info(`✓ Saved final batch (pages ${batchStartPage}-${batchEndPage}) with ${batchData.length} plants to ${filepath}`);
            }
            break;
          }
        } else {
          logger.warn('No data returned for this page');
          break;
        }
      } catch (error) {
        logger.error(`✗ Error fetching page ${page}: ${error.message}`);
        // Save any accumulated data before breaking
        if (batchData.length > 0) {
          const batchEndPage = page - 1;
          const filepath = path.join(plantsDir, `plants_pages_${batchStartPage}-${batchEndPage}${enrichedSuffix}${fileExt}`);
          await writeToFile(batchData, filepath, options.format);
          logger.info(`✓ Saved partial batch (pages ${batchStartPage}-${batchEndPage}) with ${batchData.length} plants to ${filepath}`);
        }
        break;
      }
    }
  }

  logger.info(`Completed: Fetched ${pagesFetched} page(s) of plants`);
}

/**
 * Execute search queries and save results.
 * Optionally enriches results with full plant details when --enrichment flag is set.
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchSearchQueries(api, options) {
  if (!options.search || options.search.length === 0) {
    return;
  }

  const searchDir = path.join(BASE_DATA_DIR, 'trefle/search');
  const fileExt = getFileExtension(options.format);
  const enrichedSuffix = options.enrichment ? '_enriched' : '';

  logger.info('='.repeat(60));
  logger.info(`Executing search queries (${options.enrichment ? 'enriched' : 'basic'})...`);
  if (options.enrichment) {
    logger.info('Enrichment enabled: Fetching full details for each plant');
  }
  logger.info(`Output format: ${options.format}`);
  logger.info('='.repeat(60));

  for (const query of options.search) {
    logger.info(`Searching for: '${query}'`);

    if (options.dryRun) {
      const safeQuery = query.replace(/\s+/g, '_').replace(/\//g, '_');
      logger.info(`[DRY RUN] Would search for '${query}'`);
      if (options.enrichment) {
        logger.info('[DRY RUN] Would enrich search results');
      }
      logger.info(`[DRY RUN] Would save to: datasets/trefle/search/${safeQuery}_results${enrichedSuffix}${fileExt}`);
    } else {
      try {
        // Execute search
        const result = await api.searchPlants(query, { page: 1 });

        // Process results
        if (result.data && result.data.length > 0) {
          const searchResults = result.data;
          const count = searchResults.length;
          const total = result.meta?.total || 'unknown';
          logger.info(`✓ Found ${count} results (page 1 of ${total} total)`);

          let dataToSave;
          if (options.enrichment) {
            // Enrich search results
            const enrichedResults = await enrichPlantData(api, searchResults, options.dryRun);
            dataToSave = enrichedResults;
          } else {
            dataToSave = searchResults;
          }

          // Save to file (sanitize query for filename)
          const safeQuery = query.replace(/\s+/g, '_').replace(/\//g, '_');
          const filepath = path.join(searchDir, `${safeQuery}_results${enrichedSuffix}${fileExt}`);
          await writeToFile(dataToSave, filepath, options.format);
          logger.info(`  Saved to ${filepath}`);
        } else {
          logger.warn('No results found');
        }

        // Rate limiting pause
        await pause(randomNumber(2, 5));

      } catch (error) {
        logger.error(`✗ Error searching for '${query}': ${error.message}`);
      }
    }
  }

  logger.info(`Completed: Executed ${options.search.length} search(es)`);
}

/**
 * Fetch specific plants by their IDs.
 * With --enrichment, flattens the detailed plant data structure.
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchPlantsById(api, options) {
  if (!options.plantId || options.plantId.length === 0) {
    return;
  }

  const plantsDir = path.join(BASE_DATA_DIR, 'trefle/plants_by_id');
  const fileExt = getFileExtension(options.format);
  const enrichedSuffix = options.enrichment ? '_enriched' : '';

  logger.info('='.repeat(60));
  logger.info(`Fetching plants by ID (${options.enrichment ? 'enriched' : 'detailed'})...`);
  if (options.enrichment) {
    logger.info('Enrichment enabled: Flattening plant data structure');
  }
  logger.info(`Output format: ${options.format}`);
  logger.info('='.repeat(60));

  for (const plantId of options.plantId) {
    logger.info(`Fetching plant ID: ${plantId}`);

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would fetch plant ${plantId}`);
      if (options.enrichment) {
        logger.info('[DRY RUN] Would flatten plant data');
      }
      logger.info(`[DRY RUN] Would save to: datasets/trefle/plants_by_id/{slug}_${plantId}${enrichedSuffix}${fileExt}`);
    } else {
      try {
        // Fetch the plant
        const result = await api.getPlant(plantId);

        // Process data
        if (result.data) {
          const plantData = result.data;
          const commonName = plantData.common_name || 'N/A';
          const scientificName = plantData.scientific_name || 'N/A';
          const slug = plantData.slug || `plant_${plantId}`;
          logger.info(`✓ Fetched: ${commonName} (${scientificName})`);

          let dataToSave;
          if (options.enrichment) {
            // Flatten the detailed data
            const flattenedData = flattenPlantData(plantData, result.data);
            dataToSave = flattenedData;
          } else {
            dataToSave = result;
          }

          // Save to file using slug_id format
          const filepath = path.join(plantsDir, `${slug}_${plantId}${enrichedSuffix}${fileExt}`);
          await writeToFile(dataToSave, filepath, options.format);
          logger.info(`  Saved to ${filepath}`);
        } else {
          logger.warn(`No data returned for plant ID ${plantId}`);
        }

        // Rate limiting pause
        await pause(randomNumber(2, 5));

      } catch (error) {
        logger.error(`✗ Error fetching plant ${plantId}: ${error.message}`);
      }
    }
  }

  logger.info(`Completed: Fetched ${options.plantId.length} plant(s) by ID`);
}

/**
 * Fetch taxonomy data (kingdoms, subkingdoms, divisions, etc.)
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchTaxonomy(api, options) {
  const taxonomyDir = path.join(BASE_DATA_DIR, 'trefle/taxonomy');
  const fileExt = getFileExtension(options.format);

  const taxonomyEndpoints = [
    { flag: 'kingdoms', method: 'getKingdoms', single: 'kingdom', singleMethod: 'getKingdom' },
    { flag: 'subkingdoms', method: 'getSubkingdoms', single: 'subkingdom', singleMethod: 'getSubkingdom' },
    { flag: 'divisions', method: 'getDivisions', single: 'division', singleMethod: 'getDivision' },
    { flag: 'divisionClasses', method: 'getDivisionClasses', single: 'divisionClass', singleMethod: 'getDivisionClass' },
    { flag: 'divisionOrders', method: 'getDivisionOrders', single: 'divisionOrder', singleMethod: 'getDivisionOrder' },
    { flag: 'families', method: 'getFamilies', single: 'family', singleMethod: 'getFamily' },
    { flag: 'genera', method: 'getGenera', single: 'genus', singleMethod: 'getGenus' }
  ];

  for (const endpoint of taxonomyEndpoints) {
    // Handle list endpoints
    if (options[endpoint.flag]) {
      logger.info('='.repeat(60));
      logger.info(`Fetching ${endpoint.flag}...`);
      logger.info('='.repeat(60));

      if (options.dryRun) {
        logger.info(`[DRY RUN] Would fetch ${endpoint.flag}`);
      } else {
        try {
          const result = await api[endpoint.method]({ page: 1 });
          const filepath = path.join(taxonomyDir, `${endpoint.flag}${fileExt}`);
          await writeToFile(result.data || result, filepath, options.format);
          logger.info(`✓ Saved ${endpoint.flag} to ${filepath}`);
        } catch (error) {
          logger.error(`✗ Error fetching ${endpoint.flag}: ${error.message}`);
        }
        await pause(randomNumber(2, 5));
      }
    }

    // Handle single item endpoints
    if (options[endpoint.single]) {
      const id = options[endpoint.single];
      logger.info('='.repeat(60));
      logger.info(`Fetching ${endpoint.single} ${id}...`);
      logger.info('='.repeat(60));

      if (options.dryRun) {
        logger.info(`[DRY RUN] Would fetch ${endpoint.single} ${id}`);
      } else {
        try {
          const result = await api[endpoint.singleMethod](id);
          const filepath = path.join(taxonomyDir, `${endpoint.single}_${id}${fileExt}`);
          await writeToFile(result.data || result, filepath, options.format);
          logger.info(`✓ Saved ${endpoint.single} ${id} to ${filepath}`);
        } catch (error) {
          logger.error(`✗ Error fetching ${endpoint.single} ${id}: ${error.message}`);
        }
        await pause(randomNumber(2, 5));
      }
    }
  }
}

/**
 * Fetch species data
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchSpecies(api, options) {
  const speciesDir = path.join(BASE_DATA_DIR, 'trefle/species');
  const fileExt = getFileExtension(options.format);

  // List species
  if (options.species) {
    logger.info('='.repeat(60));
    logger.info('Fetching species list...');
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info('[DRY RUN] Would fetch species list');
    } else {
      try {
        const result = await api.getSpeciesList({ page: 1 });
        const filepath = path.join(speciesDir, `species_list${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved species list to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching species: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }

  // Single species
  if (options.speciesId) {
    const id = options.speciesId;
    logger.info('='.repeat(60));
    logger.info(`Fetching species ${id}...`);
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would fetch species ${id}`);
    } else {
      try {
        const result = await api.getSpecies(id);
        const filepath = path.join(speciesDir, `species_${id}${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved species ${id} to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching species ${id}: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }

  // Search species
  if (options.searchSpecies && options.searchSpecies.length > 0) {
    const searchDir = path.join(speciesDir, 'search');

    for (const query of options.searchSpecies) {
      logger.info('='.repeat(60));
      logger.info(`Searching species for: '${query}'`);
      logger.info('='.repeat(60));

      if (options.dryRun) {
        logger.info(`[DRY RUN] Would search species for '${query}'`);
      } else {
        try {
          const result = await api.searchSpecies(query, { page: 1 });
          const safeQuery = query.replace(/\s+/g, '_').replace(/\//g, '_');
          const filepath = path.join(searchDir, `${safeQuery}_results${fileExt}`);
          await writeToFile(result.data || result, filepath, options.format);
          logger.info(`✓ Saved species search results to ${filepath}`);
        } catch (error) {
          logger.error(`✗ Error searching species for '${query}': ${error.message}`);
        }
        await pause(randomNumber(2, 5));
      }
    }
  }
}

/**
 * Fetch distribution zones and corrections
 *
 * @param {TrefleAPI} api - Initialized TrefleAPI instance
 * @param {Object} options - Parsed command-line options
 */
async function fetchDistributionsAndCorrections(api, options) {
  const distribDir = path.join(BASE_DATA_DIR, 'trefle/distributions');
  const correctionsDir = path.join(BASE_DATA_DIR, 'trefle/corrections');
  const fileExt = getFileExtension(options.format);

  // List distributions
  if (options.zones) {
    logger.info('='.repeat(60));
    logger.info('Fetching distribution zones...');
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info('[DRY RUN] Would fetch distribution zones');
    } else {
      try {
        const result = await api.getDistributions({ page: 1 });
        const filepath = path.join(distribDir, `zones${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved zones to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching zones: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }

  // Single distribution
  if (options.zone) {
    const id = options.zone;
    logger.info('='.repeat(60));
    logger.info(`Fetching distribution zone ${id}...`);
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would fetch zone ${id}`);
    } else {
      try {
        const result = await api.getDistribution(id);
        const filepath = path.join(distribDir, `zone_${id}${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved zone ${id} to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching zone ${id}: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }

  // List corrections
  if (options.corrections) {
    logger.info('='.repeat(60));
    logger.info('Fetching corrections...');
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info('[DRY RUN] Would fetch corrections');
    } else {
      try {
        const result = await api.getCorrections({ page: 1 });
        const filepath = path.join(correctionsDir, `corrections${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved corrections to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching corrections: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }

  // Single correction
  if (options.correction) {
    const id = options.correction;
    logger.info('='.repeat(60));
    logger.info(`Fetching correction ${id}...`);
    logger.info('='.repeat(60));

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would fetch correction ${id}`);
    } else {
      try {
        const result = await api.getCorrection(id);
        const filepath = path.join(correctionsDir, `correction_${id}${fileExt}`);
        await writeToFile(result.data || result, filepath, options.format);
        logger.info(`✓ Saved correction ${id} to ${filepath}`);
      } catch (error) {
        logger.error(`✗ Error fetching correction ${id}: ${error.message}`);
      }
      await pause(randomNumber(2, 5));
    }
  }
}

/**
 * Main execution function.
 */
async function main() {
  const program = new Command();

  program
    .name('trefle')
    .description('Fetch plant data from Trefle API')
    .version(version);

  // Category flags
  program
    .option('--all', 'Fetch all data (reference data + all plant pages)')
    .option('--all-single', 'Fetch all single-fetch reference data (zones, genus list)')
    .option('--all-plants', 'Fetch all plant pages (paginated)');

  // Individual endpoint flags - Plants
  program
    .option('--plants', 'Fetch plants (use --pages to limit)')
    .option('--plants-combined', 'Fetch plants with full details combined (batched in 5-page files)')
    .option('--search <queries...>', 'Search plants by query (can specify multiple)')
    .option('--plant-id <ids...>', 'Fetch specific plant by ID (can specify multiple)', (val, prev) => {
      return [...(prev || []), parseInt(val)];
    });

  // Individual endpoint flags - Taxonomy
  program
    .option('--kingdoms', 'Fetch all kingdoms')
    .option('--kingdom <id>', 'Fetch specific kingdom by ID or slug')
    .option('--subkingdoms', 'Fetch all subkingdoms')
    .option('--subkingdom <id>', 'Fetch specific subkingdom by ID or slug')
    .option('--divisions', 'Fetch all divisions')
    .option('--division <id>', 'Fetch specific division by ID or slug')
    .option('--division-classes', 'Fetch all division classes')
    .option('--division-class <id>', 'Fetch specific division class by ID or slug')
    .option('--division-orders', 'Fetch all division orders')
    .option('--division-order <id>', 'Fetch specific division order by ID or slug')
    .option('--families', 'Fetch all families (use --pages to limit)')
    .option('--family <id>', 'Fetch specific family by ID or slug')
    .option('--genera', 'Fetch all genera (use --pages to limit)')
    .option('--genus <id>', 'Fetch specific genus by ID or slug');

  // Individual endpoint flags - Species
  program
    .option('--species', 'Fetch species list (use --pages to limit)')
    .option('--species-id <id>', 'Fetch specific species by ID or slug')
    .option('--search-species <queries...>', 'Search species by query (can specify multiple)');

  // Individual endpoint flags - Distributions & Corrections
  program
    .option('--zones', 'Fetch all distribution zones')
    .option('--zone <id>', 'Fetch specific distribution zone by ID or slug')
    .option('--corrections', 'Fetch all corrections')
    .option('--correction <id>', 'Fetch specific correction by ID');

  // Pagination/range flags
  program
    .option('--pages <number>', 'Number of pages to fetch (default: all pages)', parseInt)
    .option('--start-page <number>', 'Starting page number (default: 1)', parseInt, 1);

  // Other options
  program
    .option('--enrichment', 'Enrich plant data by fetching full details for each plant')
    .option('--format <format>', 'Output file format: json (default), csv, or json.gz (compressed)', 'json')
    .option('--dry-run', 'Preview operations without fetching data')
    .option('--log-level <level>', 'Set logging level (DEBUG, INFO, WARNING, ERROR)', 'INFO');

  program.parse();

  const options = program.opts();

  // Set logging level
  setLogLevel(options.logLevel);

  // If no flags specified, show help
  const hasAnyOption = options.all || options.allSingle || options.allPlants ||
      options.zones || options.zone || options.plants || options.plantsCombined ||
      options.search || options.plantId || options.kingdoms || options.kingdom ||
      options.subkingdoms || options.subkingdom || options.divisions || options.division ||
      options.divisionClasses || options.divisionClass || options.divisionOrders ||
      options.divisionOrder || options.families || options.family || options.genera ||
      options.genus || options.species || options.speciesId || options.searchSpecies ||
      options.corrections || options.correction;

  if (!hasAnyOption) {
    program.help();
  }

  // Expand category flags
  if (options.all) {
    options.allSingle = true;
    options.allPlants = true;
  }

  if (options.allSingle) {
    options.zones = true;
    options.genusList = true;
  }

  if (options.allPlants) {
    options.plants = true;
  }

  // Make --plants-combined a shortcut for --plants --enrichment
  if (options.plantsCombined) {
    options.plants = true;
    options.enrichment = true;
  }

  // Print configuration
  logger.info('='.repeat(60));
  logger.info('TREFLE API DATA FETCHER');
  logger.info('='.repeat(60));
  logger.info(`Dry run: ${options.dryRun || false}`);
  logger.info(`Log level: ${options.logLevel}`);
  if (options.pages) {
    logger.info(`Page limit: ${options.pages}`);
  }
  if (options.startPage !== 1) {
    logger.info(`Starting page: ${options.startPage}`);
  }
  logger.info('');

  try {
    // Initialize API
    logger.info('Initializing Trefle API...');
    const api = new TrefleAPI({ logLevel: options.logLevel });
    logger.info('✓ API initialized successfully');
    logger.info('');

    // Execute fetches based on flags
    await fetchSingleEndpoints(api, options);
    await fetchPlants(api, options);
    await fetchSearchQueries(api, options);
    await fetchPlantsById(api, options);
    await fetchTaxonomy(api, options);
    await fetchSpecies(api, options);
    await fetchDistributionsAndCorrections(api, options);

    // Summary
    logger.info('='.repeat(60));
    logger.info('EXECUTION COMPLETE');
    logger.info('='.repeat(60));
    logger.info(`Data directory: ${path.resolve(BASE_DATA_DIR)}`);

    if (!options.dryRun) {
      logger.info('\nData has been saved to local files.');
      logger.info('Check the datasets/ directory for fetched data.');
    }

  } catch (error) {
    if (error.message.includes('interrupted')) {
      logger.warn('\n\nExecution interrupted by user (Ctrl+C)');
      process.exit(1);
    } else {
      logger.error(`\n\nFatal error: ${error.message}`);
      if (options.logLevel === 'DEBUG') {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  logger.warn('\n\nExecution interrupted by user (Ctrl+C)');
  process.exit(1);
});

// Run main
main();
