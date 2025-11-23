# 1.0.0 (2025-11-23)


### Bug Fixes

* add missing package files for npm release ([d70d685](https://github.com/aself101/trefle-api/commit/d70d68581cc81f6a4252d3de8846fc046d90bd9d))


### Features

* initial release of trefle-api ([b0165fc](https://github.com/aself101/trefle-api/commit/b0165fc85b71aaf6e1f4a66217cd2415d89ca27e))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-23

### Added
- Initial release of trefle-api
- `TrefleAPI` class for programmatic access to all Trefle API endpoints
- Full CLI tool (`trefle`) for command-line data fetching
- Support for all Trefle API endpoints:
  - Plants (list, search, details)
  - Species (list, search, details)
  - Taxonomy (kingdoms, subkingdoms, divisions, division classes, division orders, families, genus)
  - Distribution zones
  - Corrections
- Filtering and ordering support for list endpoints
- Pagination support with configurable page limits
- Multiple output formats (JSON, CSV, TSV)
- Rate limiting (120 requests/minute)
- Dry-run mode for testing without API calls
- Data transformation utilities (trim synonyms, flatten plant data)
- Winston-based logging with configurable log levels
- Comprehensive test suite (156 tests)

### Documentation
- Full README with installation, usage examples, and API reference
- JSDoc documentation for all public methods
