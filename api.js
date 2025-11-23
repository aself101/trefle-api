/**
 * Trefle API Wrapper
 *
 * Main API wrapper class for interacting with the Trefle Plants API.
 * Provides methods for accessing plant data, searching, and filtering.
 *
 * All methods follow a consistent pattern:
 * 1. Verify token is set
 * 2. Build request URL and parameters
 * 3. Execute HTTP request
 * 4. Log success or error
 * 5. Return raw JSON response
 *
 * @example
 * const api = new TrefleAPI();
 * const plants = await api.getPlants({ filter: { edible: 'true' }, page: 1 });
 * const plantDetail = await api.getPlant(123456);
 */

import axios from 'axios';
import winston from 'winston';
import { getTrefleToken, BASE_URL } from './config.js';

/**
 * Wrapper class for Trefle Plants API.
 *
 * Provides methods to access plant data including listing, searching,
 * filtering, and detailed plant information retrieval.
 */
export class TrefleAPI {
  /**
   * Initialize TrefleAPI instance.
   *
   * @param {Object} options - Configuration options
   * @param {string} options.token - Trefle API token. If null, reads from environment variable.
   * @param {string} options.logLevel - Logging level (DEBUG, INFO, WARNING, ERROR)
   *
   * @throws {Error} If token is not provided and not in environment
   */
  constructor({ token = null, logLevel = 'INFO' } = {}) {
    // Setup logging
    this.logger = winston.createLogger({
      level: logLevel.toLowerCase(),
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

    // Set token
    this.token = token || getTrefleToken();
    this.baseUrl = BASE_URL;

    this.logger.info('TrefleAPI initialized successfully');
  }

  /**
   * Verify that API token is set.
   *
   * @throws {Error} If token is not set
   */
  _verifyToken() {
    if (!this.token) {
      throw new Error(
        'API token not set. Please provide token during initialization ' +
        'or set TREFLE_API_TOKEN environment variable.'
      );
    }
  }

  /**
   * Build request parameters including token and optional filters.
   *
   * @param {Object} options - Optional parameters
   * @returns {Object} Parameters object with token and provided options
   */
  _buildParams(options = {}) {
    const params = { token: this.token };

    // Add optional parameters if provided
    for (const [key, value] of Object.entries(options)) {
      if (value !== null && value !== undefined) {
        // Convert objects to JSON strings for complex parameters
        if (typeof value === 'object' && !Array.isArray(value)) {
          params[key] = JSON.stringify(value);
        } else {
          params[key] = value;
        }
      }
    }

    return params;
  }

  /**
   * Make HTTP request to Trefle API.
   *
   * @param {string} method - HTTP method (GET, POST)
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Additional parameters for the request
   * @returns {Promise<Object>} JSON response from API
   *
   * @throws {Error} If request fails
   */
  async _makeRequest(method, endpoint, options = {}) {
    const url = `${this.baseUrl}/${endpoint}`;
    const params = this._buildParams(options);

    try {
      let response;

      if (method.toUpperCase() === 'GET') {
        response = await axios.get(url, { params });
      } else if (method.toUpperCase() === 'POST') {
        // For POST, token goes in params, data in json body
        const data = options.data || {};
        response = await axios.post(url, data, {
          params: { token: this.token }
        });
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }

      return response.data;

    } catch (error) {
      this.logger.error(`Request failed for ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a list endpoint method with standard pattern.
   *
   * @param {string} endpoint - API endpoint path
   * @param {string} logName - Name for logging
   * @param {boolean} supportsFilters - Whether the endpoint supports filter/order params
   * @returns {Function} Async method for the endpoint
   * @private
   */
  _createListMethod(endpoint, logName, supportsFilters = false) {
    if (supportsFilters) {
      return async ({ filter = null, order = null, page = null } = {}) => {
        this._verifyToken();
        const result = await this._makeRequest('GET', endpoint, { filter, order, page });
        this.logger.info(`Successfully fetched ${logName} (page ${page || 1})`);
        return result;
      };
    }
    return async ({ page = null } = {}) => {
      this._verifyToken();
      const result = await this._makeRequest('GET', endpoint, { page });
      this.logger.info(`Successfully fetched ${logName} (page ${page || 1})`);
      return result;
    };
  }

  /**
   * Create a single-item endpoint method with standard pattern.
   *
   * @param {string} endpointBase - API endpoint base path
   * @param {string} logName - Name for logging
   * @returns {Function} Async method for the endpoint
   * @private
   */
  _createSingleMethod(endpointBase, logName) {
    return async (id) => {
      this._verifyToken();
      const result = await this._makeRequest('GET', `${endpointBase}/${id}`);
      this.logger.info(`Successfully fetched ${logName} ${id}`);
      return result;
    };
  }

  // ==================== TAXONOMY ENDPOINTS ====================

  /**
   * List all kingdoms with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getKingdoms = this._createListMethod('kingdoms', 'kingdoms');

  /**
   * Get a specific kingdom by ID or slug.
   *
   * @param {number|string} kingdomId - Kingdom ID or slug
   * @returns {Promise<Object>} Kingdom object
   */
  getKingdom = this._createSingleMethod('kingdoms', 'kingdom');

  /**
   * List all subkingdoms with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getSubkingdoms = this._createListMethod('subkingdoms', 'subkingdoms');

  /**
   * Get a specific subkingdom by ID or slug.
   *
   * @param {number|string} subkingdomId - Subkingdom ID or slug
   * @returns {Promise<Object>} Subkingdom object
   */
  getSubkingdom = this._createSingleMethod('subkingdoms', 'subkingdom');

  /**
   * List all divisions with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getDivisions = this._createListMethod('divisions', 'divisions');

  /**
   * Get a specific division by ID or slug.
   *
   * @param {number|string} divisionId - Division ID or slug
   * @returns {Promise<Object>} Division object
   */
  getDivision = this._createSingleMethod('divisions', 'division');

  /**
   * List all division classes with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getDivisionClasses = this._createListMethod('division_classes', 'division classes');

  /**
   * Get a specific division class by ID or slug.
   *
   * @param {number|string} classId - Division class ID or slug
   * @returns {Promise<Object>} Division class object
   */
  getDivisionClass = this._createSingleMethod('division_classes', 'division class');

  /**
   * List all division orders with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getDivisionOrders = this._createListMethod('division_orders', 'division orders');

  /**
   * Get a specific division order by ID or slug.
   *
   * @param {number|string} orderId - Division order ID or slug
   * @returns {Promise<Object>} Division order object
   */
  getDivisionOrder = this._createSingleMethod('division_orders', 'division order');

  /**
   * List all families with optional filtering and pagination.
   *
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions
   * @param {Object} options.order - Sort order
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getFamilies = this._createListMethod('families', 'families', true);

  /**
   * Get a specific family by ID or slug.
   *
   * @param {number|string} familyId - Family ID or slug
   * @returns {Promise<Object>} Family object
   */
  getFamily = this._createSingleMethod('families', 'family');

  /**
   * List all genera with optional filtering and pagination.
   *
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions
   * @param {Object} options.order - Sort order
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getGenera = this._createListMethod('genus', 'genera', true);

  /**
   * Get a specific genus by ID or slug.
   *
   * @param {number|string} genusId - Genus ID or slug
   * @returns {Promise<Object>} Genus object
   */
  getGenus = this._createSingleMethod('genus', 'genus');

  // ==================== CORE PLANT ENDPOINTS ====================

  /**
   * List plants with optional filtering, sorting, and pagination.
   *
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions (e.g., { edible: 'true', vegetable: 'true' })
   * @param {Object} options.filter_not - Exclusion filters (e.g., { toxicity: 'high' })
   * @param {Object} options.order - Sort order (e.g., { common_name: 'asc' })
   * @param {Object} options.range - Range filters (e.g., { maximum_height: '10,100' })
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   *
   * @example
   * // Get edible vegetables, sorted alphabetically
   * const plants = await api.getPlants({
   *   filter: { edible: 'true', vegetable: 'true' },
   *   order: { common_name: 'asc' },
   *   page: 1
   * });
   *
   * // Get tall trees (10-100 meters)
   * const trees = await api.getPlants({
   *   filter: { ligneous_type: 'tree' },
   *   range: { maximum_height: '1000,10000' },  // in cm
   *   page: 1
   * });
   */
  async getPlants({ filter = null, filter_not = null, order = null, range = null, page = null } = {}) {
    this._verifyToken();
    const result = await this._makeRequest('GET', 'plants', {
      filter,
      filter_not,
      order,
      range,
      page
    });
    this.logger.info(`Successfully fetched plants (page ${page || 1})`);
    return result;
  }

  /**
   * Get specific plant by ID or slug.
   *
   * @param {number|string} plantId - Plant ID or slug
   * @returns {Promise<Object>} Complete plant object with main_species, genus, family, etc.
   *
   * @example
   * const plant = await api.getPlant(123456);
   * console.log(plant.data.common_name);
   */
  async getPlant(plantId) {
    this._verifyToken();
    const result = await this._makeRequest('GET', `plants/${plantId}`);
    this.logger.info(`Successfully fetched plant ${plantId}`);
    return result;
  }

  /**
   * Search plants by query string.
   *
   * Searches across scientific name, common name, and synonyms.
   *
   * @param {string} query - Search query string (required)
   * @param {Object} options - Additional query options
   * @param {number} options.page - Page number
   * @param {Object} options.filter - Additional filter conditions
   * @param {Object} options.filter_not - Exclusion filters
   * @param {Object} options.order - Sort order
   * @param {Object} options.range - Range filters
   * @returns {Promise<Object>} Search results with 'data', 'links', and 'meta' keys
   *
   * @example
   * // Search for coconut
   * const results = await api.searchPlants('coconut');
   *
   * // Search for roses that are edible
   * const results = await api.searchPlants('rose', {
   *   filter: { edible: 'true' }
   * });
   */
  async searchPlants(query, { page = null, filter = null, filter_not = null, order = null, range = null } = {}) {
    this._verifyToken();

    if (!query) {
      throw new Error('Search query cannot be empty');
    }

    const result = await this._makeRequest('GET', 'plants/search', {
      q: query,
      page,
      filter,
      filter_not,
      order,
      range
    });
    this.logger.info(`Successfully searched plants for '${query}' (page ${page || 1})`);
    return result;
  }

  /**
   * List plants in a specific distribution zone.
   *
   * @param {string} zoneId - TDWG zone code (e.g., 'usa', 'eur', 'afr')
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions
   * @param {Object} options.filter_not - Exclusion filters
   * @param {Object} options.order - Sort order
   * @param {Object} options.range - Range filters
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Plants found in the specified zone
   *
   * @example
   * // Get plants native to USA
   * const usaPlants = await api.getPlantsByZone('usa', { page: 1 });
   *
   * // Get edible plants in Europe
   * const eurEdibles = await api.getPlantsByZone('eur', {
   *   filter: { edible: 'true' }
   * });
   */
  async getPlantsByZone(zoneId, { filter = null, filter_not = null, order = null, range = null, page = null } = {}) {
    this._verifyToken();

    if (!zoneId) {
      throw new Error('Zone ID cannot be empty');
    }

    const result = await this._makeRequest('GET', `distributions/${zoneId}/plants`, {
      filter,
      filter_not,
      order,
      range,
      page
    });
    this.logger.info(`Successfully fetched plants for zone ${zoneId} (page ${page || 1})`);
    return result;
  }

  /**
   * List plants for a specific genus.
   *
   * @param {number} genusId - Genus ID
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions
   * @param {Object} options.filter_not - Exclusion filters
   * @param {Object} options.order - Sort order
   * @param {Object} options.range - Range filters
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Plants in the specified genus
   *
   * @example
   * // Get all plants in genus (e.g., Rosa for roses)
   * const roses = await api.getPlantsByGenus(1234, { page: 1 });
   */
  async getPlantsByGenus(genusId, { filter = null, filter_not = null, order = null, range = null, page = null } = {}) {
    this._verifyToken();

    const result = await this._makeRequest('GET', `genus/${genusId}/plants`, {
      filter,
      filter_not,
      order,
      range,
      page
    });
    this.logger.info(`Successfully fetched plants for genus ${genusId} (page ${page || 1})`);
    return result;
  }

  /**
   * Report an error for a plant.
   *
   * @param {number} plantId - Plant ID to report error for
   * @param {string} notes - Description of the error or issue
   * @returns {Promise<Object>} Correction object
   *
   * @example
   * const correction = await api.reportPlant(
   *   123456,
   *   "Common name is misspelled"
   * );
   */
  async reportPlant(plantId, notes) {
    this._verifyToken();

    if (!notes) {
      throw new Error('Notes cannot be empty');
    }

    const result = await this._makeRequest('POST', `plants/${plantId}/report`, {
      data: { notes }
    });
    this.logger.info(`Successfully reported plant ${plantId}`);
    return result;
  }

  // ==================== SPECIES ENDPOINTS ====================

  /**
   * List species with optional filtering, sorting, and pagination.
   *
   * @param {Object} options - Query options
   * @param {Object} options.filter - Filter conditions
   * @param {Object} options.filter_not - Exclusion filters
   * @param {Object} options.order - Sort order
   * @param {Object} options.range - Range filters
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  async getSpeciesList({ filter = null, filter_not = null, order = null, range = null, page = null } = {}) {
    this._verifyToken();
    const result = await this._makeRequest('GET', 'species', {
      filter,
      filter_not,
      order,
      range,
      page
    });
    this.logger.info(`Successfully fetched species (page ${page || 1})`);
    return result;
  }

  /**
   * Get a specific species by ID or slug.
   *
   * @param {number|string} speciesId - Species ID or slug
   * @returns {Promise<Object>} Complete species object
   */
  getSpecies = this._createSingleMethod('species', 'species');

  /**
   * Search species by query string.
   *
   * @param {string} query - Search query string (required)
   * @param {Object} options - Additional query options
   * @param {number} options.page - Page number
   * @param {Object} options.filter - Additional filter conditions
   * @param {Object} options.filter_not - Exclusion filters
   * @param {Object} options.order - Sort order
   * @param {Object} options.range - Range filters
   * @returns {Promise<Object>} Search results
   */
  async searchSpecies(query, { page = null, filter = null, filter_not = null, order = null, range = null } = {}) {
    this._verifyToken();

    if (!query) {
      throw new Error('Search query cannot be empty');
    }

    const result = await this._makeRequest('GET', 'species/search', {
      q: query,
      page,
      filter,
      filter_not,
      order,
      range
    });
    this.logger.info(`Successfully searched species for '${query}' (page ${page || 1})`);
    return result;
  }

  /**
   * Report an error for a species.
   *
   * @param {number} speciesId - Species ID to report error for
   * @param {string} notes - Description of the error or issue
   * @returns {Promise<Object>} Correction object
   */
  async reportSpecies(speciesId, notes) {
    this._verifyToken();

    if (!notes) {
      throw new Error('Notes cannot be empty');
    }

    const result = await this._makeRequest('POST', `species/${speciesId}/report`, {
      data: { notes }
    });
    this.logger.info(`Successfully reported species ${speciesId}`);
    return result;
  }

  // ==================== DISTRIBUTION ENDPOINTS ====================

  /**
   * List all distribution zones with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getDistributions = this._createListMethod('distributions', 'distributions');

  /**
   * Get a specific distribution zone by ID or slug.
   *
   * @param {number|string} distributionId - Distribution zone ID or slug
   * @returns {Promise<Object>} Distribution zone object
   */
  getDistribution = this._createSingleMethod('distributions', 'distribution');

  // ==================== CORRECTION ENDPOINTS ====================

  /**
   * List all corrections with optional pagination.
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Object>} Response with 'data', 'links', and 'meta' keys
   */
  getCorrections = this._createListMethod('corrections', 'corrections');

  /**
   * Get a specific correction by ID.
   *
   * @param {number} correctionId - Correction ID
   * @returns {Promise<Object>} Correction object
   */
  getCorrection = this._createSingleMethod('corrections', 'correction');

  /**
   * Get corrections for a specific species record.
   *
   * @param {number} recordId - Species record ID
   * @returns {Promise<Object>} Corrections for the species
   */
  async getCorrectionsForSpecies(recordId) {
    this._verifyToken();
    const result = await this._makeRequest('GET', `corrections/species/${recordId}`);
    this.logger.info(`Successfully fetched corrections for species ${recordId}`);
    return result;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Helper method to fetch all pages of results automatically.
   *
   * @param {string} methodName - Name of the API method to call ('getPlants', 'searchPlants', etc.)
   * @param {Object} options - Parameters to pass to the method
   * @param {number} options.maxPages - Maximum number of pages to fetch (null for all)
   * @returns {Promise<Array>} Combined data from all pages
   *
   * @example
   * // Get all edible plants (all pages)
   * const allEdibles = await api.getAllPages('getPlants', {
   *   filter: { edible: 'true' }
   * });
   *
   * // Get first 5 pages only
   * const limited = await api.getAllPages('getPlants', {
   *   maxPages: 5,
   *   filter: { vegetable: 'true' }
   * });
   */
  async getAllPages(methodName, options = {}) {
    const { maxPages = null, ...methodOptions } = options;
    const method = this[methodName];

    if (!method || typeof method !== 'function') {
      throw new Error(`Method '${methodName}' does not exist on TrefleAPI`);
    }

    const allData = [];
    let page = 1;

    while (true) {
      if (maxPages && page > maxPages) {
        break;
      }

      methodOptions.page = page;
      const result = await method.call(this, methodOptions);

      if (result.data) {
        allData.push(...result.data);
      }

      // Check if there's a next page
      if (result.links && result.links.next) {
        page++;
      } else {
        break;
      }
    }

    this.logger.info(`Fetched ${allData.length} total records across ${page} pages`);
    return allData;
  }
}

export default TrefleAPI;
