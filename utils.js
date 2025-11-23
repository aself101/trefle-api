/**
 * Trefle Service Utility Functions
 *
 * Utility functions for working with Trefle data, including file I/O,
 * random number generation, pausing, and data transformations.
 */

import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import winston from 'winston';

// Configure module logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level.toUpperCase()} - ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Write data to file.
 *
 * @param {any} data - Data to write (Object, Array, string, etc.)
 * @param {string} filepath - Path where file should be written
 * @param {string} fileFormat - Format to use ('csv', 'json', 'json.gz', 'txt', 'auto')
 *                              'auto' detects from filepath extension
 *
 * @throws {Error} If filepath not provided
 *
 * Notes:
 * - Dict/Array: Written as JSON with indentation
 * - json.gz: Compressed JSON format (gzip), 80-90% smaller than regular JSON
 */
export async function writeToFile(data, filepath, fileFormat = 'auto') {
  if (!filepath) {
    throw new Error('Filepath is required');
  }

  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // Auto-detect format from extension
    if (fileFormat === 'auto') {
      const ext = path.extname(filepath).toLowerCase();
      if (ext === '.csv') {
        fileFormat = 'csv';
      } else if (ext === '.json') {
        fileFormat = 'json';
      } else if (filepath.endsWith('.json.gz')) {
        fileFormat = 'json.gz';
      } else {
        fileFormat = 'txt';
      }
    }

    // Write based on format
    if (fileFormat === 'json.gz') {
      // Compressed JSON format
      const jsonStr = JSON.stringify(data, null, 2);
      const compressed = zlib.gzipSync(jsonStr);
      await fs.writeFile(filepath, compressed);
    } else if (fileFormat === 'json') {
      // Regular JSON
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } else if (fileFormat === 'csv') {
      // CSV format - for arrays of objects
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(','),
          ...data.map(row =>
            headers.map(header => {
              const value = row[header];
              // Escape commas and quotes
              if (value === null || value === undefined) return '';
              const str = String(value);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          )
        ];
        await fs.writeFile(filepath, csvRows.join('\n'));
      } else {
        throw new Error('CSV format requires an array of objects');
      }
    } else {
      // Text format
      await fs.writeFile(filepath, String(data));
    }

    logger.info(`Successfully wrote data to ${filepath}`);
  } catch (error) {
    logger.error(`Error writing to file ${filepath}: ${error.message}`);
    throw error;
  }
}

/**
 * Read data from file.
 *
 * @param {string} filepath - Path to file to read
 * @param {string} fileFormat - Format to use ('csv', 'json', 'json.gz', 'txt', 'auto')
 *                              'auto' detects from filepath extension
 * @returns {Promise<any>} Data from file (Object, Array, or string)
 *
 * @throws {Error} If filepath not provided or file doesn't exist
 */
export async function readFromFile(filepath, fileFormat = 'auto') {
  if (!filepath) {
    throw new Error('Filepath is required');
  }

  try {
    // Check if file exists
    await fs.access(filepath);

    // Auto-detect format from extension
    if (fileFormat === 'auto') {
      const ext = path.extname(filepath).toLowerCase();
      if (ext === '.csv') {
        fileFormat = 'csv';
      } else if (ext === '.json') {
        fileFormat = 'json';
      } else if (filepath.endsWith('.json.gz')) {
        fileFormat = 'json.gz';
      } else {
        fileFormat = 'txt';
      }
    }

    let result;

    // Read based on format
    if (fileFormat === 'json.gz') {
      const compressed = await fs.readFile(filepath);
      const decompressed = zlib.gunzipSync(compressed);
      result = JSON.parse(decompressed.toString());
    } else if (fileFormat === 'json') {
      const content = await fs.readFile(filepath, 'utf-8');
      result = JSON.parse(content);
    } else if (fileFormat === 'csv') {
      // Basic CSV parsing
      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) return [];

      const headers = lines[0].split(',');
      result = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        return obj;
      });
    } else {
      result = await fs.readFile(filepath, 'utf-8');
    }

    logger.info(`Successfully read data from ${filepath}`);
    return result;
  } catch (error) {
    logger.error(`Error reading from file ${filepath}: ${error.message}`);
    throw error;
  }
}

/**
 * Generate random integer between min and max (inclusive).
 *
 * @param {number} minVal - Minimum value
 * @param {number} maxVal - Maximum value
 * @returns {number} Random integer between minVal and maxVal
 *
 * @throws {Error} If minVal > maxVal
 */
export function randomNumber(minVal, maxVal) {
  if (minVal > maxVal) {
    throw new Error(`minVal (${minVal}) cannot be greater than maxVal (${maxVal})`);
  }

  const result = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
  logger.debug(`Generated random number: ${result} (range: ${minVal}-${maxVal})`);
  return result;
}

/**
 * Pause execution for specified duration.
 *
 * @param {number} seconds - Number of seconds to pause (can be float for sub-second delays)
 * @returns {Promise<void>}
 *
 * @throws {Error} If seconds is negative
 */
export function pause(seconds) {
  if (seconds < 0) {
    throw new Error('Seconds cannot be negative');
  }

  logger.debug(`Pausing for ${seconds} seconds...`);
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Call an API method and write the result to a file with graceful error handling.
 *
 * This is a convenience wrapper that handles calling API methods with various
 * parameter types and automatically saves the result to the specified file.
 *
 * @param {Function} apiMethod - API method to call (e.g., api.getPlants)
 * @param {string} filepath - Path where the result should be written
 * @param {any} params - Parameters to pass to the API method. Can be:
 *                       - null/undefined: Call method with no parameters
 *                       - Object: Passed as single argument
 *                       - Other: Passed as single argument
 * @param {boolean} continueOnError - If true, catch and log errors instead of raising (default: true)
 * @returns {Promise<Object>} Object with keys:
 *                            - success: bool indicating if the API call succeeded
 *                            - error: error message if failed (null if successful)
 *                            - errorType: type of error
 *                            - statusCode: HTTP status code if HTTP error (null otherwise)
 *
 * @example
 * const api = new TrefleAPI();
 * const result = await callAPI(api.getPlants.bind(api), "data/plants.json", { page: 1 });
 * if (!result.success) {
 *   console.log(`Failed: ${result.error}`);
 * }
 */
export async function callAPI(apiMethod, filepath, params = null, continueOnError = true) {
  try {
    let data;

    if (params === null || params === undefined) {
      data = await apiMethod();
    } else if (typeof params === 'object' && !Array.isArray(params)) {
      data = await apiMethod(params);
    } else {
      data = await apiMethod(params);
    }

    if (data === null || data === undefined) {
      return { success: true, error: null, errorType: null, statusCode: null };
    }

    await writeToFile(data, filepath);
    return { success: true, error: null, errorType: null, statusCode: null };

  } catch (error) {
    const errorMsg = error.message;
    const statusCode = error.response?.status || null;
    const errorType = error.name || 'Error';

    if (error.response) {
      // HTTP error
      logger.warn(`HTTP Error in API call: ${errorMsg}`);

      if (statusCode === 502) {
        logger.warn('  → Server temporarily unavailable (502 Bad Gateway). Continuing with next request.');
      } else if (statusCode === 429) {
        logger.warn('  → Rate limit exceeded (429). Consider adding longer delays between requests.');
      } else if (statusCode === 503) {
        logger.warn('  → Service unavailable (503). Server may be overloaded.');
      } else if (statusCode) {
        logger.warn(`  → HTTP ${statusCode} error occurred.`);
      }

      if (continueOnError) {
        return { success: false, error: errorMsg, errorType: 'HTTPError', statusCode };
      } else {
        throw error;
      }
    } else {
      // Other error
      logger.error(`${errorType} in API call: ${errorMsg}`);

      if (continueOnError) {
        return { success: false, error: errorMsg, errorType, statusCode: null };
      } else {
        throw error;
      }
    }
  }
}

/**
 * Trim the synonyms list in plant objects to a maximum number.
 *
 * The Trefle API can return 30+ synonyms per plant, which is excessive
 * for list views. This function reduces the synonyms to keep only the
 * top N entries.
 *
 * @param {Array<Object>} plants - List of plant objects from Trefle API
 * @param {number} maxSynonyms - Maximum number of synonyms to keep (default: 5)
 * @returns {Array<Object>} List of plant objects with trimmed synonyms
 *
 * @example
 * const plants = (await api.getPlants({ page: 1 })).data;
 * const trimmed = trimPlantSynonyms(plants, 5);
 */
export function trimPlantSynonyms(plants, maxSynonyms = 5) {
  if (!plants || !Array.isArray(plants)) {
    return plants;
  }

  return plants.map(plant => {
    // Create a shallow copy to avoid modifying the original
    const plantCopy = { ...plant };

    // Trim synonyms if present and exceeds maxSynonyms
    if (Array.isArray(plantCopy.synonyms) && plantCopy.synonyms.length > maxSynonyms) {
      plantCopy.synonyms = plantCopy.synonyms.slice(0, maxSynonyms);
      logger.debug(`Trimmed synonyms for plant '${plantCopy.scientific_name || 'unknown'}' to ${maxSynonyms}`);
    }

    return plantCopy;
  });
}

/**
 * Find the first source object that has a non-null URL value.
 *
 * @param {Array<Object>} sources - List of source objects from Trefle API
 * @returns {Object|null} First source object with URL, or null if no sources have URLs
 *
 * @example
 * const source = findFirstSourceWithUrl(plantData.main_species.sources);
 */
export function findFirstSourceWithUrl(sources) {
  if (!sources || !Array.isArray(sources)) {
    return null;
  }

  for (const source of sources) {
    if (source && typeof source === 'object' && source.url) {
      return source;
    }
  }

  return null;
}

/**
 * Flatten and combine paginated plant list data with detailed plant data.
 *
 * Takes properties from paginated list (like id, common_name, scientific_name)
 * and detailed plant fetch (main_species properties), flattening nested structures.
 *
 * Flattening rules:
 * - Spread all main_species properties to root level
 * - genus → genus: [name]
 * - family → family: [name]
 * - synonyms → keep top 5 only
 * - sources → first source with URL only
 * - distributions → keep all (native and introduced)
 * - Spread specifications properties
 * - Spread growth properties
 * - Spread flower, foliage, fruit_or_seed properties
 *
 * @param {Object} paginatedData - Plant data from getPlants() endpoint
 * @param {Object} detailedData - Plant data from getPlant(id) endpoint
 * @returns {Object} Flattened object with combined properties
 *
 * @example
 * const paginated = (await api.getPlants({ page: 1 })).data[0];
 * const detailed = (await api.getPlant(paginated.id)).data;
 * const flattened = flattenPlantData(paginated, detailed);
 */
export function flattenPlantData(paginatedData, detailedData) {
  const flattened = {};

  // Root level properties from paginated data
  const rootProps = [
    'id', 'common_name', 'slug', 'scientific_name', 'year',
    'bibliography', 'author', 'status', 'rank', 'family_common_name',
    'genus_id', 'image_url', 'observations', 'vegetable'
  ];

  for (const prop of rootProps) {
    flattened[prop] = paginatedData[prop];
  }

  // Synonyms - keep top 5 only
  const synonyms = paginatedData.synonyms || [];
  if (Array.isArray(synonyms) && synonyms.length > 5) {
    flattened.synonyms = synonyms.slice(0, 5);
  } else {
    flattened.synonyms = synonyms;
  }

  // Get main_species from detailed data
  const mainSpecies = detailedData.main_species || {};

  // Main species root properties
  const mainSpeciesProps = ['rank', 'observations', 'duration', 'edible_part', 'edible'];
  for (const prop of mainSpeciesProps) {
    flattened[prop] = mainSpecies[prop];
  }

  // Images - trim to first 2 records per type, keep only image_url and copyright
  const images = mainSpecies.images || {};
  const trimmedImages = {};

  for (const [imageType, imageList] of Object.entries(images)) {
    // Skip empty arrays or empty strings
    if (!imageList || !Array.isArray(imageList) || imageType === '') {
      continue;
    }

    // Take first 2 images and extract only image_url and copyright
    const trimmedList = imageList.slice(0, 2).map(img => {
      if (typeof img === 'object') {
        return {
          image_url: img.image_url,
          copyright: img.copyright
        };
      }
      return img;
    }).filter(img => img && (img.image_url || img.copyright));

    // Only add to images if we have data
    if (trimmedList.length > 0) {
      trimmedImages[imageType] = trimmedList;
    }
  }

  flattened.images = trimmedImages;

  // Distributions - keep only name and species_count for native and introduced
  // Sort by species_count (descending) and keep top 5
  const distributions = mainSpecies.distributions || {};
  const trimmedDistributions = {};

  for (const distType of ['native', 'introduced']) {
    const distList = distributions[distType] || [];
    if (Array.isArray(distList) && distList.length > 0) {
      // Extract name and species_count
      const trimmedDistList = distList
        .map(dist => ({
          name: dist.name,
          species_count: dist.species_count
        }))
        .sort((a, b) => {
          const countA = a.species_count ?? 0;
          const countB = b.species_count ?? 0;
          return countB - countA;
        })
        .slice(0, 5);

      if (trimmedDistList.length > 0) {
        trimmedDistributions[distType] = trimmedDistList;
      }
    }
  }

  flattened.distributions = trimmedDistributions;

  // Flower properties - spread to root with flower_ prefix
  const flower = mainSpecies.flower || {};
  flattened.flower_color = flower.color;
  flattened.flower_conspicuous = flower.conspicuous;

  // Foliage properties - spread to root with foliage_ prefix
  const foliage = mainSpecies.foliage || {};
  flattened.foliage_texture = foliage.texture;
  flattened.foliage_color = foliage.color;
  flattened.foliage_leaf_retention = foliage.leaf_retention;

  // Fruit or seed properties - spread to root with fruit_ prefix
  const fruitOrSeed = mainSpecies.fruit_or_seed || {};
  flattened.fruit_conspicuous = fruitOrSeed.conspicuous;
  flattened.fruit_color = fruitOrSeed.color;
  flattened.fruit_shape = fruitOrSeed.shape;
  flattened.fruit_seed_persistence = fruitOrSeed.seed_persistence;

  // Sources - first source with URL only
  const sources = mainSpecies.sources || [];
  flattened.source = findFirstSourceWithUrl(sources);

  // Specifications - spread all properties to root with spec_ prefix
  const specifications = mainSpecies.specifications || {};
  flattened.spec_ligneous_type = specifications.ligneous_type;
  flattened.spec_growth_form = specifications.growth_form;
  flattened.spec_growth_habit = specifications.growth_habit;
  flattened.spec_growth_rate = specifications.growth_rate;
  flattened.spec_average_height_cm = specifications.average_height?.cm;
  flattened.spec_maximum_height_cm = specifications.maximum_height?.cm;
  flattened.spec_nitrogen_fixation = specifications.nitrogen_fixation;
  flattened.spec_shape_and_orientation = specifications.shape_and_orientation;
  flattened.spec_toxicity = specifications.toxicity;

  // Growth - spread all properties to root with growth_ prefix
  const growth = mainSpecies.growth || {};
  flattened.growth_description = growth.description;
  flattened.growth_sowing = growth.sowing;
  flattened.growth_days_to_harvest = growth.days_to_harvest;
  flattened.growth_row_spacing_cm = growth.row_spacing?.cm;
  flattened.growth_spread_cm = growth.spread?.cm;
  flattened.growth_ph_maximum = growth.ph_maximum;
  flattened.growth_ph_minimum = growth.ph_minimum;
  flattened.growth_light = growth.light;
  flattened.growth_atmospheric_humidity = growth.atmospheric_humidity;
  flattened.growth_months = growth.growth_months;
  flattened.growth_bloom_months = growth.bloom_months;
  flattened.growth_fruit_months = growth.fruit_months;
  flattened.growth_minimum_precipitation_mm = growth.minimum_precipitation?.mm;
  flattened.growth_maximum_precipitation_mm = growth.maximum_precipitation?.mm;
  flattened.growth_minimum_root_depth_cm = growth.minimum_root_depth?.cm;
  flattened.growth_minimum_temperature_deg_f = growth.minimum_temperature?.deg_f;
  flattened.growth_minimum_temperature_deg_c = growth.minimum_temperature?.deg_c;
  flattened.growth_maximum_temperature_deg_f = growth.maximum_temperature?.deg_f;
  flattened.growth_maximum_temperature_deg_c = growth.maximum_temperature?.deg_c;
  flattened.growth_soil_nutriments = growth.soil_nutriments;
  flattened.growth_soil_salinity = growth.soil_salinity;
  flattened.growth_soil_texture = growth.soil_texture;
  flattened.growth_soil_humidity = growth.soil_humidity;

  // Genus - extract name only
  const genus = mainSpecies.genus || {};
  flattened.genus = typeof genus === 'object' ? genus.name : genus;

  // Family - extract name only
  const family = mainSpecies.family || {};
  flattened.family = typeof family === 'object' ? family.name : family;

  return flattened;
}

/**
 * Set logger level
 * @param {string} level - Log level (debug, info, warn, error)
 */
export function setLogLevel(level) {
  logger.level = level.toLowerCase();
}

export { logger };
