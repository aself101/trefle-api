/**
 * TrefleAPI Tests
 * Tests for the main API wrapper class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { TrefleAPI } from '../api.js';

// Mock axios
vi.mock('axios');

// Mock config to avoid environment variable issues
vi.mock('../config.js', () => ({
  getTrefleToken: vi.fn(() => 'test-token-12345'),
  BASE_URL: 'https://trefle.io/api/v1'
}));

describe('TrefleAPI', () => {
  let api;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new TrefleAPI({ token: 'test-token-12345', logLevel: 'error' });
  });

  describe('constructor', () => {
    it('should initialize with provided token', () => {
      const customApi = new TrefleAPI({ token: 'custom-token' });
      expect(customApi.token).toBe('custom-token');
    });

    it('should set base URL', () => {
      expect(api.baseUrl).toBe('https://trefle.io/api/v1');
    });

    it('should create logger', () => {
      expect(api.logger).toBeDefined();
    });

    it('should accept custom log level', () => {
      const debugApi = new TrefleAPI({ token: 'test', logLevel: 'DEBUG' });
      expect(debugApi.logger.level).toBe('debug');
    });

    it('should default to INFO log level', () => {
      const defaultApi = new TrefleAPI({ token: 'test' });
      expect(defaultApi.logger.level).toBe('info');
    });
  });

  describe('_verifyToken', () => {
    it('should not throw when token is set', () => {
      expect(() => api._verifyToken()).not.toThrow();
    });

    it('should throw error when token is not set', () => {
      api.token = null;
      expect(() => api._verifyToken()).toThrow('API token not set');
    });

    it('should include helpful error message', () => {
      api.token = null;
      expect(() => api._verifyToken()).toThrow('TREFLE_API_TOKEN environment variable');
    });
  });

  describe('_buildParams', () => {
    it('should include token in params', () => {
      const params = api._buildParams();
      expect(params.token).toBe('test-token-12345');
    });

    it('should add optional parameters', () => {
      const params = api._buildParams({ page: 2, q: 'rose' });
      expect(params.page).toBe(2);
      expect(params.q).toBe('rose');
    });

    it('should skip null and undefined values', () => {
      const params = api._buildParams({ page: null, filter: undefined, q: 'test' });
      expect(params.page).toBeUndefined();
      expect(params.filter).toBeUndefined();
      expect(params.q).toBe('test');
    });

    it('should stringify object parameters', () => {
      const params = api._buildParams({ filter: { edible: true } });
      expect(params.filter).toBe('{"edible":true}');
    });

    it('should not stringify array parameters', () => {
      const params = api._buildParams({ values: [1, 2, 3] });
      expect(params.values).toEqual([1, 2, 3]);
    });
  });

  describe('_makeRequest', () => {
    it('should make GET request with correct URL and params', async () => {
      axios.get.mockResolvedValue({ data: { result: 'success' } });

      await api._makeRequest('GET', 'plants', { page: 1 });

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants',
        { params: { token: 'test-token-12345', page: 1 } }
      );
    });

    it('should make POST request with data in body', async () => {
      axios.post.mockResolvedValue({ data: { result: 'success' } });

      await api._makeRequest('POST', 'plants/123/report', { data: { notes: 'test' } });

      expect(axios.post).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants/123/report',
        { notes: 'test' },
        { params: { token: 'test-token-12345' } }
      );
    });

    it('should return response data', async () => {
      axios.get.mockResolvedValue({ data: { plants: [] } });

      const result = await api._makeRequest('GET', 'plants');

      expect(result).toEqual({ plants: [] });
    });

    it('should throw error for unsupported HTTP method', async () => {
      await expect(api._makeRequest('DELETE', 'plants')).rejects.toThrow('Unsupported HTTP method: DELETE');
    });

    it('should throw error on request failure', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(api._makeRequest('GET', 'plants')).rejects.toThrow('Network error');
    });
  });

  describe('getPlants', () => {
    it('should fetch plants successfully', async () => {
      const mockResponse = {
        data: [{ id: 1, common_name: 'Rose' }],
        links: { next: null },
        meta: { total: 1 }
      };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getPlants({ page: 1 });

      expect(result).toEqual(mockResponse);
    });

    it('should pass filter parameters', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getPlants({ filter: { edible: 'true' }, page: 1 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            filter: '{"edible":"true"}'
          })
        })
      );
    });

    it('should pass order parameters', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getPlants({ order: { common_name: 'asc' } });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            order: '{"common_name":"asc"}'
          })
        })
      );
    });

    it('should throw error when token is not set', async () => {
      api.token = null;

      await expect(api.getPlants()).rejects.toThrow('API token not set');
    });
  });

  describe('getPlant', () => {
    it('should fetch single plant by ID', async () => {
      const mockResponse = {
        data: { id: 123, common_name: 'Rose', main_species: {} }
      };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getPlant(123);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants/123',
        expect.any(Object)
      );
    });

    it('should fetch single plant by slug', async () => {
      axios.get.mockResolvedValue({ data: { data: {} } });

      await api.getPlant('rosa-gallica');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants/rosa-gallica',
        expect.any(Object)
      );
    });

    it('should throw error on failure', async () => {
      axios.get.mockRejectedValue(new Error('Plant not found'));

      await expect(api.getPlant(999999)).rejects.toThrow('Plant not found');
    });
  });

  describe('searchPlants', () => {
    it('should search plants with query', async () => {
      const mockResponse = { data: [{ id: 1, common_name: 'Rose' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.searchPlants('rose');

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants/search',
        expect.objectContaining({
          params: expect.objectContaining({ q: 'rose' })
        })
      );
    });

    it('should throw error for empty query', async () => {
      await expect(api.searchPlants('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should throw error for null query', async () => {
      await expect(api.searchPlants(null)).rejects.toThrow('Search query cannot be empty');
    });

    it('should pass additional filter options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.searchPlants('rose', { filter: { edible: 'true' }, page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'rose',
            page: 2,
            filter: '{"edible":"true"}'
          })
        })
      );
    });
  });

  describe('getPlantsByZone', () => {
    it('should fetch plants by zone', async () => {
      const mockResponse = { data: [{ id: 1 }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getPlantsByZone('usa');

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/distributions/usa/plants',
        expect.any(Object)
      );
    });

    it('should throw error for empty zone', async () => {
      await expect(api.getPlantsByZone('')).rejects.toThrow('Zone ID cannot be empty');
    });

    it('should throw error for null zone', async () => {
      await expect(api.getPlantsByZone(null)).rejects.toThrow('Zone ID cannot be empty');
    });

    it('should pass filter and pagination options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getPlantsByZone('eur', { filter: { edible: 'true' }, page: 3 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 3,
            filter: '{"edible":"true"}'
          })
        })
      );
    });
  });

  describe('getPlantsByGenus', () => {
    it('should fetch plants by genus ID', async () => {
      const mockResponse = { data: [{ id: 1 }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getPlantsByGenus(1234);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/genus/1234/plants',
        expect.any(Object)
      );
    });

    it('should pass filter options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getPlantsByGenus(1234, { filter: { vegetable: 'true' } });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            filter: '{"vegetable":"true"}'
          })
        })
      );
    });
  });

  describe('reportPlant', () => {
    it('should report plant with notes', async () => {
      const mockResponse = { data: { correction_id: 1 } };
      axios.post.mockResolvedValue({ data: mockResponse });

      const result = await api.reportPlant(123, 'Name is misspelled');

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/plants/123/report',
        { notes: 'Name is misspelled' },
        expect.any(Object)
      );
    });

    it('should throw error for empty notes', async () => {
      await expect(api.reportPlant(123, '')).rejects.toThrow('Notes cannot be empty');
    });

    it('should throw error for null notes', async () => {
      await expect(api.reportPlant(123, null)).rejects.toThrow('Notes cannot be empty');
    });
  });

  describe('getAllPages', () => {
    it('should fetch all pages until no next link', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 1 }, { id: 2 }],
            links: { next: 'page2' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 3 }, { id: 4 }],
            links: { next: 'page3' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 5 }],
            links: { next: null }
          }
        });

      const result = await api.getAllPages('getPlants');

      expect(result).toHaveLength(5);
      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    it('should respect maxPages limit', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 1 }],
            links: { next: 'page2' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 2 }],
            links: { next: 'page3' }
          }
        });

      const result = await api.getAllPages('getPlants', { maxPages: 2 });

      expect(result).toHaveLength(2);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should throw error for invalid method name', async () => {
      await expect(api.getAllPages('invalidMethod')).rejects.toThrow("Method 'invalidMethod' does not exist");
    });

    it('should pass options to the method', async () => {
      axios.get.mockResolvedValue({
        data: {
          data: [{ id: 1 }],
          links: { next: null }
        }
      });

      await api.getAllPages('getPlants', { filter: { edible: 'true' } });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            filter: '{"edible":"true"}'
          })
        })
      );
    });
  });

  // ==================== TAXONOMY ENDPOINTS ====================

  describe('getKingdoms', () => {
    it('should fetch kingdoms successfully', async () => {
      const mockResponse = { data: [{ id: 1, name: 'Plantae' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getKingdoms();

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/kingdoms',
        expect.any(Object)
      );
    });

    it('should pass pagination', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });
      await api.getKingdoms({ page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })
      );
    });
  });

  describe('getKingdom', () => {
    it('should fetch single kingdom by ID', async () => {
      const mockResponse = { data: { id: 1, name: 'Plantae' } };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getKingdom(1);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/kingdoms/1',
        expect.any(Object)
      );
    });

    it('should fetch kingdom by slug', async () => {
      axios.get.mockResolvedValue({ data: { data: {} } });
      await api.getKingdom('plantae');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/kingdoms/plantae',
        expect.any(Object)
      );
    });
  });

  describe('getSubkingdoms', () => {
    it('should fetch subkingdoms successfully', async () => {
      const mockResponse = { data: [{ id: 1, name: 'Tracheobionta' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getSubkingdoms();

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/subkingdoms',
        expect.any(Object)
      );
    });
  });

  describe('getSubkingdom', () => {
    it('should fetch single subkingdom', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getSubkingdom(1);

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/subkingdoms/1',
        expect.any(Object)
      );
    });
  });

  describe('getDivisions', () => {
    it('should fetch divisions successfully', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getDivisions();

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/divisions',
        expect.any(Object)
      );
    });
  });

  describe('getDivision', () => {
    it('should fetch single division', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getDivision('magnoliophyta');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/divisions/magnoliophyta',
        expect.any(Object)
      );
    });
  });

  describe('getDivisionClasses', () => {
    it('should fetch division classes successfully', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getDivisionClasses();

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/division_classes',
        expect.any(Object)
      );
    });
  });

  describe('getDivisionClass', () => {
    it('should fetch single division class', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getDivisionClass(1);

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/division_classes/1',
        expect.any(Object)
      );
    });
  });

  describe('getDivisionOrders', () => {
    it('should fetch division orders successfully', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getDivisionOrders();

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/division_orders',
        expect.any(Object)
      );
    });
  });

  describe('getDivisionOrder', () => {
    it('should fetch single division order', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getDivisionOrder(1);

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/division_orders/1',
        expect.any(Object)
      );
    });
  });

  describe('getFamilies', () => {
    it('should fetch families successfully', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getFamilies();

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/families',
        expect.any(Object)
      );
    });

    it('should pass filter and order options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getFamilies({ filter: { name: 'Rosaceae' }, order: { name: 'asc' } });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            filter: '{"name":"Rosaceae"}',
            order: '{"name":"asc"}'
          })
        })
      );
    });
  });

  describe('getFamily', () => {
    it('should fetch single family', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getFamily('rosaceae');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/families/rosaceae',
        expect.any(Object)
      );
    });
  });

  describe('getGenera', () => {
    it('should fetch genera successfully', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getGenera();

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/genus',
        expect.any(Object)
      );
    });
  });

  describe('getGenus', () => {
    it('should fetch single genus', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 1 } } });

      await api.getGenus('rosa');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/genus/rosa',
        expect.any(Object)
      );
    });
  });

  // ==================== SPECIES ENDPOINTS ====================

  describe('getSpeciesList', () => {
    it('should fetch species list successfully', async () => {
      const mockResponse = { data: [{ id: 1, scientific_name: 'Rosa gallica' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getSpeciesList();

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/species',
        expect.any(Object)
      );
    });

    it('should pass filter options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getSpeciesList({ filter: { edible: 'true' }, page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            filter: '{"edible":"true"}',
            page: 2
          })
        })
      );
    });
  });

  describe('getSpecies', () => {
    it('should fetch single species by ID', async () => {
      const mockResponse = { data: { id: 123, scientific_name: 'Rosa gallica' } };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getSpecies(123);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/species/123',
        expect.any(Object)
      );
    });

    it('should fetch species by slug', async () => {
      axios.get.mockResolvedValue({ data: { data: {} } });

      await api.getSpecies('rosa-gallica');

      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/species/rosa-gallica',
        expect.any(Object)
      );
    });
  });

  describe('searchSpecies', () => {
    it('should search species with query', async () => {
      const mockResponse = { data: [{ id: 1 }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.searchSpecies('rose');

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/species/search',
        expect.objectContaining({
          params: expect.objectContaining({ q: 'rose' })
        })
      );
    });

    it('should throw error for empty query', async () => {
      await expect(api.searchSpecies('')).rejects.toThrow('Search query cannot be empty');
    });

    it('should throw error for null query', async () => {
      await expect(api.searchSpecies(null)).rejects.toThrow('Search query cannot be empty');
    });

    it('should pass additional filter options', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.searchSpecies('rose', { filter: { edible: 'true' }, page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'rose',
            page: 2,
            filter: '{"edible":"true"}'
          })
        })
      );
    });
  });

  describe('reportSpecies', () => {
    it('should report species with notes', async () => {
      const mockResponse = { data: { correction_id: 1 } };
      axios.post.mockResolvedValue({ data: mockResponse });

      const result = await api.reportSpecies(123, 'Name is misspelled');

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/species/123/report',
        { notes: 'Name is misspelled' },
        expect.any(Object)
      );
    });

    it('should throw error for empty notes', async () => {
      await expect(api.reportSpecies(123, '')).rejects.toThrow('Notes cannot be empty');
    });

    it('should throw error for null notes', async () => {
      await expect(api.reportSpecies(123, null)).rejects.toThrow('Notes cannot be empty');
    });
  });

  // ==================== DISTRIBUTION ENDPOINTS ====================

  describe('getDistributions', () => {
    it('should fetch distributions successfully', async () => {
      const mockResponse = { data: [{ id: 'usa', name: 'United States' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getDistributions();

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/distributions',
        expect.any(Object)
      );
    });

    it('should pass pagination', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getDistributions({ page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })
      );
    });
  });

  describe('getDistribution', () => {
    it('should fetch single distribution', async () => {
      const mockResponse = { data: { id: 'usa', name: 'United States' } };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getDistribution('usa');

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/distributions/usa',
        expect.any(Object)
      );
    });
  });

  // ==================== CORRECTION ENDPOINTS ====================

  describe('getCorrections', () => {
    it('should fetch corrections successfully', async () => {
      const mockResponse = { data: [{ id: 1, notes: 'Fixed typo' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getCorrections();

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/corrections',
        expect.any(Object)
      );
    });

    it('should pass pagination', async () => {
      axios.get.mockResolvedValue({ data: { data: [] } });

      await api.getCorrections({ page: 2 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })
      );
    });
  });

  describe('getCorrection', () => {
    it('should fetch single correction', async () => {
      const mockResponse = { data: { id: 1, notes: 'Fixed typo' } };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getCorrection(1);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/corrections/1',
        expect.any(Object)
      );
    });
  });

  describe('getCorrectionsForSpecies', () => {
    it('should fetch corrections for species', async () => {
      const mockResponse = { data: [{ id: 1, notes: 'Fixed name' }] };
      axios.get.mockResolvedValue({ data: mockResponse });

      const result = await api.getCorrectionsForSpecies(123);

      expect(result).toEqual(mockResponse);
      expect(axios.get).toHaveBeenCalledWith(
        'https://trefle.io/api/v1/corrections/species/123',
        expect.any(Object)
      );
    });
  });
});
