/**
 * Trefle API Configuration
 *
 * Handles authentication token management and API configuration settings.
 * Token should be stored in .env file as TREFLE_API_TOKEN.
 *
 * To obtain a token:
 * 1. Create an account at https://trefle.io/
 * 2. Confirm your email address
 * 3. Retrieve your token from your account dashboard
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Trefle API Base URL
export const BASE_URL = 'https://trefle.io/api/v1';

// Rate limit: 120 requests per minute
export const RATE_LIMIT = 120;

/**
 * Retrieve Trefle API token from environment variables.
 *
 * @returns {string} The Trefle API access token
 * @throws {Error} If TREFLE_API_TOKEN is not set in environment variables
 *
 * @example
 * const token = getTrefleToken();
 */
export function getTrefleToken() {
  const token = process.env.TREFLE_API_TOKEN;

  if (!token) {
    throw new Error(
      'TREFLE_API_TOKEN not found in environment variables. ' +
      'Please add it to your .env file. ' +
      'Get your token at https://trefle.io/'
    );
  }

  return token;
}

/**
 * Validate that the token appears to be in correct format.
 * Trefle tokens are typically alphanumeric strings.
 *
 * @param {string} token - The token string to validate
 * @returns {boolean} True if token format appears valid, false otherwise
 */
export function validateTokenFormat(token) {
  if (!token) {
    return false;
  }

  // Basic validation - token should be non-empty alphanumeric string
  // Trefle tokens are typically long alphanumeric strings
  if (token.length < 10) {
    return false;
  }

  return true;
}
