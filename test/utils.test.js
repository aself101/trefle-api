/**
 * Utility Functions Tests
 * Tests for file I/O, random number generation, pausing, and data transformations
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  writeToFile,
  readFromFile,
  randomNumber,
  pause,
  callAPI,
  trimPlantSynonyms,
  findFirstSourceWithUrl,
  flattenPlantData,
  setLogLevel
} from '../utils.js';

// Test directory for file I/O tests
const TEST_DIR = join(process.cwd(), 'test-output-utils');

describe('File I/O Functions', () => {
  beforeAll(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('writeToFile', () => {
    it('should throw error when filepath is not provided', async () => {
      await expect(writeToFile({ data: 'test' }, null)).rejects.toThrow('Filepath is required');
    });

    it('should write JSON data to file', async () => {
      const filepath = join(TEST_DIR, 'test.json');
      const data = { name: 'test', value: 123 };

      await writeToFile(data, filepath);

      const content = readFileSync(filepath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should write CSV data to file', async () => {
      const filepath = join(TEST_DIR, 'test.csv');
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];

      await writeToFile(data, filepath);

      const content = readFileSync(filepath, 'utf-8');
      expect(content).toContain('name,age');
      expect(content).toContain('Alice,30');
      expect(content).toContain('Bob,25');
    });

    it('should escape commas and quotes in CSV data', async () => {
      const filepath = join(TEST_DIR, 'test-escape.csv');
      const data = [
        { name: 'Hello, World', description: 'Say "hello"' }
      ];

      await writeToFile(data, filepath);

      const content = readFileSync(filepath, 'utf-8');
      expect(content).toContain('"Hello, World"');
      expect(content).toContain('"Say ""hello"""');
    });

    it('should throw error for CSV format with non-array data', async () => {
      const filepath = join(TEST_DIR, 'invalid.csv');
      await expect(writeToFile({ single: 'object' }, filepath, 'csv')).rejects.toThrow('CSV format requires an array of objects');
    });

    it('should write text data to file', async () => {
      const filepath = join(TEST_DIR, 'test.txt');
      const data = 'Hello, World!';

      await writeToFile(data, filepath);

      const content = readFileSync(filepath, 'utf-8');
      expect(content).toBe(data);
    });

    it('should write compressed JSON data to file', async () => {
      const filepath = join(TEST_DIR, 'test.json.gz');
      const data = { compressed: true, value: 'test data' };

      await writeToFile(data, filepath);

      expect(existsSync(filepath)).toBe(true);
    });

    it('should auto-detect format from extension', async () => {
      const jsonPath = join(TEST_DIR, 'auto.json');
      const csvPath = join(TEST_DIR, 'auto.csv');

      await writeToFile({ test: 'json' }, jsonPath);
      await writeToFile([{ test: 'csv' }], csvPath);

      const jsonContent = readFileSync(jsonPath, 'utf-8');
      expect(JSON.parse(jsonContent)).toEqual({ test: 'json' });

      const csvContent = readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('test');
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = join(TEST_DIR, 'nested', 'deep', 'file.json');
      await writeToFile({ nested: true }, nestedPath);
      expect(existsSync(nestedPath)).toBe(true);
    });
  });

  describe('readFromFile', () => {
    it('should throw error when filepath is not provided', async () => {
      await expect(readFromFile(null)).rejects.toThrow('Filepath is required');
    });

    it('should read JSON data from file', async () => {
      const filepath = join(TEST_DIR, 'read-test.json');
      const data = { read: 'test', number: 42 };
      await writeToFile(data, filepath);

      const result = await readFromFile(filepath);
      expect(result).toEqual(data);
    });

    it('should read CSV data from file', async () => {
      const filepath = join(TEST_DIR, 'read-test.csv');
      const data = [
        { col1: 'a', col2: 'b' },
        { col1: 'c', col2: 'd' }
      ];
      await writeToFile(data, filepath);

      const result = await readFromFile(filepath);
      expect(result).toHaveLength(2);
      expect(result[0].col1).toBe('a');
    });

    it('should read text data from file', async () => {
      const filepath = join(TEST_DIR, 'read-test.txt');
      await writeToFile('Hello World', filepath);

      const result = await readFromFile(filepath);
      expect(result).toBe('Hello World');
    });

    it('should read compressed JSON data from file', async () => {
      const filepath = join(TEST_DIR, 'read-test.json.gz');
      const data = { compressed: true, data: 'test' };
      await writeToFile(data, filepath);

      const result = await readFromFile(filepath);
      expect(result).toEqual(data);
    });

    it('should throw error for non-existent file', async () => {
      await expect(readFromFile(join(TEST_DIR, 'non-existent.json'))).rejects.toThrow();
    });
  });
});

describe('Utility Functions', () => {
  describe('randomNumber', () => {
    it('should return number within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomNumber(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
      }
    });

    it('should throw error when minVal > maxVal', () => {
      expect(() => randomNumber(10, 5)).toThrow('minVal (10) cannot be greater than maxVal (5)');
    });

    it('should return exact value when min equals max', () => {
      const result = randomNumber(5, 5);
      expect(result).toBe(5);
    });

    it('should return integer values', () => {
      for (let i = 0; i < 50; i++) {
        const result = randomNumber(1, 100);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should include boundary values', () => {
      // Run many times to increase probability of hitting boundaries
      const results = new Set();
      for (let i = 0; i < 1000; i++) {
        results.add(randomNumber(1, 3));
      }
      expect(results.has(1)).toBe(true);
      expect(results.has(3)).toBe(true);
    });
  });

  describe('pause', () => {
    it('should throw error for negative seconds', () => {
      expect(() => pause(-1)).toThrow('Seconds cannot be negative');
    });

    it('should resolve after specified time', async () => {
      const start = Date.now();
      await pause(0.1); // 100ms
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    it('should resolve immediately for 0 seconds', async () => {
      const start = Date.now();
      await pause(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('should return a promise', () => {
      const result = pause(0);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('setLogLevel', () => {
    it('should accept valid log levels', () => {
      expect(() => setLogLevel('debug')).not.toThrow();
      expect(() => setLogLevel('info')).not.toThrow();
      expect(() => setLogLevel('warn')).not.toThrow();
      expect(() => setLogLevel('error')).not.toThrow();
    });

    it('should be case-insensitive', () => {
      expect(() => setLogLevel('DEBUG')).not.toThrow();
      expect(() => setLogLevel('INFO')).not.toThrow();
    });
  });
});

describe('callAPI', () => {
  it('should return success result when API call succeeds', async () => {
    const mockMethod = vi.fn().mockResolvedValue({ data: 'test' });
    const filepath = join(TEST_DIR, 'api-result.json');

    const result = await callAPI(mockMethod, filepath);

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(mockMethod).toHaveBeenCalled();
  });

  it('should pass params to API method', async () => {
    const mockMethod = vi.fn().mockResolvedValue({ data: 'test' });
    const filepath = join(TEST_DIR, 'api-params.json');
    const params = { page: 1, filter: { edible: true } };

    await callAPI(mockMethod, filepath, params);

    expect(mockMethod).toHaveBeenCalledWith(params);
  });

  it('should call method without params when null', async () => {
    const mockMethod = vi.fn().mockResolvedValue({ data: 'test' });
    const filepath = join(TEST_DIR, 'api-no-params.json');

    await callAPI(mockMethod, filepath, null);

    expect(mockMethod).toHaveBeenCalledWith();
  });

  it('should return error result when API call fails with continueOnError=true', async () => {
    const mockMethod = vi.fn().mockRejectedValue(new Error('API error'));
    const filepath = join(TEST_DIR, 'api-error.json');

    const result = await callAPI(mockMethod, filepath, null, true);

    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should throw error when API call fails with continueOnError=false', async () => {
    const mockMethod = vi.fn().mockRejectedValue(new Error('API error'));
    const filepath = join(TEST_DIR, 'api-throw.json');

    await expect(callAPI(mockMethod, filepath, null, false)).rejects.toThrow('API error');
  });

  it('should handle HTTP errors with status codes', async () => {
    const httpError = new Error('Not Found');
    httpError.response = { status: 404 };
    const mockMethod = vi.fn().mockRejectedValue(httpError);
    const filepath = join(TEST_DIR, 'api-http-error.json');

    const result = await callAPI(mockMethod, filepath, null, true);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.errorType).toBe('HTTPError');
  });

  it('should return success when API returns null data', async () => {
    const mockMethod = vi.fn().mockResolvedValue(null);
    const filepath = join(TEST_DIR, 'api-null.json');

    const result = await callAPI(mockMethod, filepath);

    expect(result.success).toBe(true);
  });
});

describe('Plant Data Functions', () => {
  describe('trimPlantSynonyms', () => {
    it('should return input unchanged if not an array', () => {
      expect(trimPlantSynonyms(null)).toBeNull();
      expect(trimPlantSynonyms(undefined)).toBeUndefined();
      expect(trimPlantSynonyms('string')).toBe('string');
    });

    it('should trim synonyms to default max of 5', () => {
      const plants = [{
        scientific_name: 'Test Plant',
        synonyms: ['syn1', 'syn2', 'syn3', 'syn4', 'syn5', 'syn6', 'syn7']
      }];

      const result = trimPlantSynonyms(plants);

      expect(result[0].synonyms).toHaveLength(5);
    });

    it('should trim synonyms to custom max', () => {
      const plants = [{
        scientific_name: 'Test Plant',
        synonyms: ['syn1', 'syn2', 'syn3', 'syn4', 'syn5']
      }];

      const result = trimPlantSynonyms(plants, 3);

      expect(result[0].synonyms).toHaveLength(3);
    });

    it('should not modify plants with fewer synonyms than max', () => {
      const plants = [{
        scientific_name: 'Test Plant',
        synonyms: ['syn1', 'syn2']
      }];

      const result = trimPlantSynonyms(plants);

      expect(result[0].synonyms).toHaveLength(2);
    });

    it('should not modify original array', () => {
      const plants = [{
        scientific_name: 'Test Plant',
        synonyms: ['syn1', 'syn2', 'syn3', 'syn4', 'syn5', 'syn6']
      }];

      trimPlantSynonyms(plants);

      expect(plants[0].synonyms).toHaveLength(6);
    });

    it('should handle plants without synonyms property', () => {
      const plants = [{ scientific_name: 'Test Plant' }];

      const result = trimPlantSynonyms(plants);

      expect(result[0].synonyms).toBeUndefined();
    });
  });

  describe('findFirstSourceWithUrl', () => {
    it('should return null for null input', () => {
      expect(findFirstSourceWithUrl(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(findFirstSourceWithUrl(undefined)).toBeNull();
    });

    it('should return null for non-array input', () => {
      expect(findFirstSourceWithUrl('string')).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(findFirstSourceWithUrl([])).toBeNull();
    });

    it('should return first source with URL', () => {
      const sources = [
        { name: 'Source 1' },
        { name: 'Source 2', url: 'https://example.com' },
        { name: 'Source 3', url: 'https://other.com' }
      ];

      const result = findFirstSourceWithUrl(sources);

      expect(result.name).toBe('Source 2');
      expect(result.url).toBe('https://example.com');
    });

    it('should return null if no sources have URLs', () => {
      const sources = [
        { name: 'Source 1' },
        { name: 'Source 2' }
      ];

      expect(findFirstSourceWithUrl(sources)).toBeNull();
    });

    it('should skip null source entries', () => {
      const sources = [null, { name: 'Valid', url: 'https://test.com' }];

      const result = findFirstSourceWithUrl(sources);

      expect(result.url).toBe('https://test.com');
    });
  });

  describe('flattenPlantData', () => {
    const mockPaginatedData = {
      id: 123,
      common_name: 'Test Plant',
      slug: 'test-plant',
      scientific_name: 'Testus plantus',
      year: 2020,
      bibliography: 'Test Bibliography',
      author: 'Test Author',
      status: 'accepted',
      rank: 'species',
      family_common_name: 'Test Family',
      genus_id: 456,
      image_url: 'https://example.com/image.jpg',
      observations: 'Test observations',
      vegetable: false,
      synonyms: ['syn1', 'syn2', 'syn3', 'syn4', 'syn5', 'syn6', 'syn7']
    };

    const mockDetailedData = {
      main_species: {
        rank: 'species',
        observations: 'Detailed observations',
        duration: ['Annual'],
        edible_part: ['Leaves'],
        edible: true,
        images: {
          flower: [
            { image_url: 'https://example.com/flower1.jpg', copyright: 'Copyright 1' },
            { image_url: 'https://example.com/flower2.jpg', copyright: 'Copyright 2' },
            { image_url: 'https://example.com/flower3.jpg', copyright: 'Copyright 3' }
          ]
        },
        distributions: {
          native: [
            { name: 'North America', species_count: 100 },
            { name: 'Europe', species_count: 50 }
          ],
          introduced: [
            { name: 'Asia', species_count: 30 }
          ]
        },
        flower: { color: ['Red'], conspicuous: true },
        foliage: { texture: 'Smooth', color: ['Green'], leaf_retention: true },
        fruit_or_seed: { conspicuous: true, color: ['Yellow'], shape: 'Round', seed_persistence: true },
        sources: [
          { name: 'Source 1' },
          { name: 'Source 2', url: 'https://source.com' }
        ],
        specifications: {
          ligneous_type: 'Herbaceous',
          growth_form: 'Forb',
          growth_habit: 'Single stem',
          growth_rate: 'Rapid',
          average_height: { cm: 50 },
          maximum_height: { cm: 100 },
          nitrogen_fixation: 'None',
          shape_and_orientation: 'Erect',
          toxicity: 'None'
        },
        growth: {
          description: 'Test growth',
          sowing: 'Spring',
          days_to_harvest: 90,
          row_spacing: { cm: 30 },
          spread: { cm: 40 },
          ph_maximum: 7.5,
          ph_minimum: 6.0,
          light: 8,
          atmospheric_humidity: 6,
          growth_months: ['Mar', 'Apr', 'May'],
          bloom_months: ['Jun', 'Jul'],
          fruit_months: ['Aug', 'Sep'],
          minimum_precipitation: { mm: 500 },
          maximum_precipitation: { mm: 1000 },
          minimum_root_depth: { cm: 20 },
          minimum_temperature: { deg_f: 32, deg_c: 0 },
          maximum_temperature: { deg_f: 100, deg_c: 38 },
          soil_nutriments: 6,
          soil_salinity: 2,
          soil_texture: 5,
          soil_humidity: 6
        },
        genus: { name: 'Testus' },
        family: { name: 'Testaceae' }
      }
    };

    it('should include root properties from paginated data', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.id).toBe(123);
      expect(result.common_name).toBe('Test Plant');
      expect(result.scientific_name).toBe('Testus plantus');
      expect(result.slug).toBe('test-plant');
    });

    it('should trim synonyms to 5', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.synonyms).toHaveLength(5);
    });

    it('should extract genus name', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.genus).toBe('Testus');
    });

    it('should extract family name', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.family).toBe('Testaceae');
    });

    it('should flatten flower properties with prefix', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.flower_color).toEqual(['Red']);
      expect(result.flower_conspicuous).toBe(true);
    });

    it('should flatten foliage properties with prefix', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.foliage_texture).toBe('Smooth');
      expect(result.foliage_color).toEqual(['Green']);
    });

    it('should flatten fruit properties with prefix', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.fruit_conspicuous).toBe(true);
      expect(result.fruit_color).toEqual(['Yellow']);
      expect(result.fruit_shape).toBe('Round');
    });

    it('should flatten specifications with spec_ prefix', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.spec_ligneous_type).toBe('Herbaceous');
      expect(result.spec_growth_form).toBe('Forb');
      expect(result.spec_average_height_cm).toBe(50);
    });

    it('should flatten growth properties with growth_ prefix', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.growth_description).toBe('Test growth');
      expect(result.growth_days_to_harvest).toBe(90);
      expect(result.growth_ph_minimum).toBe(6.0);
    });

    it('should find first source with URL', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.source).toBeDefined();
      expect(result.source.url).toBe('https://source.com');
    });

    it('should trim images to 2 per type', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.images.flower).toHaveLength(2);
    });

    it('should include distributions', () => {
      const result = flattenPlantData(mockPaginatedData, mockDetailedData);

      expect(result.distributions.native).toBeDefined();
      expect(result.distributions.introduced).toBeDefined();
    });

    it('should handle missing main_species gracefully', () => {
      const result = flattenPlantData(mockPaginatedData, {});

      expect(result.id).toBe(123);
      expect(result.genus).toBeUndefined();
    });

    it('should handle string genus instead of object', () => {
      const detailedWithStringGenus = {
        main_species: {
          genus: 'Testus'
        }
      };

      const result = flattenPlantData(mockPaginatedData, detailedWithStringGenus);

      expect(result.genus).toBe('Testus');
    });
  });
});
