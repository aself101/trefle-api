/**
 * Configuration Tests
 * Tests for Trefle API configuration and token management
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BASE_URL, RATE_LIMIT, getTrefleToken, validateTokenFormat } from '../config.js';

describe('Configuration Constants', () => {
  describe('BASE_URL', () => {
    it('should be defined', () => {
      expect(BASE_URL).toBeDefined();
    });

    it('should be the correct Trefle API URL', () => {
      expect(BASE_URL).toBe('https://trefle.io/api/v1');
    });

    it('should use HTTPS', () => {
      expect(BASE_URL.startsWith('https://')).toBe(true);
    });

    it('should include API version', () => {
      expect(BASE_URL).toContain('/api/v1');
    });
  });

  describe('RATE_LIMIT', () => {
    it('should be defined', () => {
      expect(RATE_LIMIT).toBeDefined();
    });

    it('should be 120 requests per minute', () => {
      expect(RATE_LIMIT).toBe(120);
    });

    it('should be a positive number', () => {
      expect(RATE_LIMIT).toBeGreaterThan(0);
    });
  });
});

describe('Configuration Functions', () => {
  describe('getTrefleToken', () => {
    const originalEnvToken = process.env.TREFLE_API_TOKEN;

    afterEach(() => {
      // Restore original environment variable
      if (originalEnvToken) {
        process.env.TREFLE_API_TOKEN = originalEnvToken;
      } else {
        delete process.env.TREFLE_API_TOKEN;
      }
    });

    it('should return token from environment variable', () => {
      process.env.TREFLE_API_TOKEN = 'test-token-12345';
      const result = getTrefleToken();
      expect(result).toBe('test-token-12345');
    });

    it('should throw error when token is not set', () => {
      delete process.env.TREFLE_API_TOKEN;
      expect(() => getTrefleToken()).toThrow('TREFLE_API_TOKEN not found');
    });

    it('should throw error with helpful message about .env file', () => {
      delete process.env.TREFLE_API_TOKEN;
      expect(() => getTrefleToken()).toThrow('Please add it to your .env file');
    });

    it('should throw error with trefle.io URL', () => {
      delete process.env.TREFLE_API_TOKEN;
      expect(() => getTrefleToken()).toThrow('https://trefle.io/');
    });

    it('should return token when set to valid value', () => {
      process.env.TREFLE_API_TOKEN = 'usr-abc123def456';
      const token = getTrefleToken();
      expect(token).toBe('usr-abc123def456');
    });
  });

  describe('validateTokenFormat', () => {
    it('should return false for null token', () => {
      expect(validateTokenFormat(null)).toBe(false);
    });

    it('should return false for undefined token', () => {
      expect(validateTokenFormat(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validateTokenFormat('')).toBe(false);
    });

    it('should return false for token shorter than 10 characters', () => {
      expect(validateTokenFormat('short')).toBe(false);
      expect(validateTokenFormat('123456789')).toBe(false);
    });

    it('should return true for token exactly 10 characters', () => {
      expect(validateTokenFormat('1234567890')).toBe(true);
    });

    it('should return true for token longer than 10 characters', () => {
      expect(validateTokenFormat('this-is-a-valid-token')).toBe(true);
      expect(validateTokenFormat('usr-0MJbmxyYaTioa-plUBUwmnRyn')).toBe(true);
    });

    it('should accept alphanumeric tokens with special characters', () => {
      expect(validateTokenFormat('usr-abc123-def456-ghi789')).toBe(true);
    });
  });
});
