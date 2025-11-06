# Changelog

All notable changes to VoiceTel Phone will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.6] - 2025-11-06

### Fixed
- **CRITICAL: Fixed calls dropping during re-registration** - Calls no longer drop when SIP registration refreshes or when app is backgrounded/foregrounded
- **Fixed registration race conditions** - Implemented promise-based queue system to ensure only one registration occurs at a time
- **Fixed concurrent registration attempts** - Multiple register() calls now properly queue instead of creating duplicate registrations
- **Fixed memory leaks** - Event handlers now properly cleaned up using .once() and explicit removal
- **Fixed re-registration during active calls** - Re-registration completely skipped during active calls; SIP.js handles registration refresh automatically

### Changed
- **Registration expiry reduced to 180 seconds** (from 300 seconds) - Faster failure detection and recovery
- **Improved logging** - Added clear messages explaining when re-registration is skipped and why
- **Enhanced re-registration logic** - Now only recreates UserAgent when WebSocket is actually dead and no active call is in progress

### Technical Details
- Replaced boolean `isRegistering` flag with `registrationPromise` for atomic state management
- Added `unregistrationPromise` to properly sequence register/unregister operations
- Changed from persistent `.on()` handlers to one-time `.once()` handlers with explicit cleanup
- Re-registration now properly awaits unregister() completion before calling register()
- WebSocket monitoring now clears registration promise when connection dies
- Trust SIP.js automatic re-registration when transport is healthy (per RFC 3261)

## [3.5.5] - 2025-11-06

### Fixed
- Fix horizontal scrolling during calls and button layout issues
- Standardize scrolling behavior for all sections (event log, call history, contacts)
- Prevent horizontal scrolling on iOS WebView
- Remove invalid webkit-playsinline attributes and improve blob URL handling
- Add proper MIME type detection for WebM and OGG audio files in VTCallService

## Previous Versions

See git history for changes in versions 3.5.4 and earlier.

---

## Legend

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes
