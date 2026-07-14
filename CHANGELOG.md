# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Backend selection guide with BYOK vs Cursor REST vs SDK bridge (`docs/BACKEND-SELECTION.md`)
- BYOK provider-direct design (`docs/BYOK.md`)
- SDK bridge design for TypeScript and Python (`docs/SDK-BRIDGE.md`)
- Revised architecture: `BackendRouter` with three backends (`docs/DESIGN.md`)
- Initial plugin design documentation (`docs/DESIGN.md`)
- Cursor Cloud Agents API integration guide (`docs/API-INTEGRATION.md`)
- Development guide with planned project structure (`docs/DEVELOPMENT.md`)
- Chat UI/UX specification (`docs/UX.md`)
- Documentation index (`docs/README.md`)
- Expanded root `README.md` with architecture overview

### Changed

- Default recommended backend is now **BYOK** (`openai-compatible`) for Phase 1 MVP
- Cursor SDK documented as optional sidecar, not rejected
- Phased delivery reordered: BYOK → REST → bridge
