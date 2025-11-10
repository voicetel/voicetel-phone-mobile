# VoiceTel Phone - JavaScript API Documentation

**Version:** 3.5.6  
**Last Updated:** November 10, 2024

This document provides a comprehensive reference for all JavaScript functions and modules in the VoiceTel Phone application.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Module Loading](#module-loading)
- [Configuration](#configuration)
- [Global Variables](#global-variables)
- [Helper Functions](#helper-functions)
- [Storage Management](#storage-management)
- [UI Management](#ui-management)
- [Audio Management](#audio-management)
- [Call Management](#call-management)
- [SIP Registration](#sip-registration)
- [Contact Management](#contact-management)
- [Call History](#call-history)
- [Call Recording](#call-recording)
- [Native Integration](#native-integration)
- [Event Handlers](#event-handlers)

---

## Architecture Overview

The application uses a modular JavaScript architecture with 16 separate modules loaded dynamically in dependency order:

```
loader.js → config.js → helpers.js → storage.js → globals.js → ui-manager.js
→ audio.js → native-integration.js → recording.js → call-controls.js
→ contacts.js → history.js → sip-manager.js → call-handler.js
→ event-handlers.js → app.js
```

All functions are exposed on the global `window` object for cross-module communication.

---

## Module Loading

### loader.js

Dynamically loads all JavaScript modules in the correct dependency order.

#### Functions

**`loadScript(src)`**
- **Description:** Loads a single script file dynamically
- **Parameters:**
  - `src` (string) - Script path relative to document
- **Returns:** Promise that resolves when script loads
- **Internal use only**

**`loadModules()`**
- **Description:** Loads all modules sequentially
- **Returns:** Promise that resolves when all modules are loaded
- **Internal use only**

---

## Configuration

### config.js

Defines global constants for the application.

#### Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `window.APP_VERSION` | string | "3.5.6" | Application version |
| `window.SIP_DOMAIN` | string | "tls.voicetel.com" | SIP domain |
| `window.SIP_SERVER` | string | "wss://tls.voicetel.com:443" | WebSocket SIP server URL |
| `window.SIP_REGISTRATION_EXPIRES_SEC` | number | 300 | SIP registration expiry in seconds |
| `window.USERNAME_LENGTH` | number | 10 | Required username length |
| `window.INCOMING_CALL_TIMEOUT_MS` | number | 30000 | Auto-decline timeout (30s) |
| `window.DTMF_DURATION_MS` | number | 250 | DTMF tone duration |
| `window.DTMF_INTERDIGIT_MS` | number | 70 | DTMF inter-digit gap |

---

## Global Variables

### globals.js

Defines application state variables.

#### Variables

| Variable | Type | Initial | Description |
|----------|------|---------|-------------|
| `window.userAgent` | object/null | null | SIP.js UserAgent instance |
| `window.currentSession` | object/null | null | Active call session |
| `window.incomingSession` | object/null | null | Incoming call session |
| `window.isRegistered` | boolean | false | SIP registration status |
| `window.registeredUsername` | string/null | null | Currently registered username |
| `window.isMuted` | boolean | false | Call mute status |
| `window.activeCall` | boolean | false | Active call flag |
| `window.contactsList` | array | [] | Loaded device contacts |
| `window.audioStarted` | boolean | false | WebRTC audio started flag |
| `window.callKitAudioSessionActive` | boolean | false | iOS CallKit audio session flag |
| `window.pendingAudioStart` | boolean | false | Pending audio start flag |
| `window.registrationPromise` | Promise/null | null | Active registration promise |
| `window.unregistrationPromise` | Promise/null | null | Active unregistration promise |
| `window.incomingCallTimeout` | number/null | null | Incoming call timeout ID |
| `window.reRegisterTimeout` | number/null | null | Re-registration timeout ID |
| `window.saveConfigTimeout` | number/null | null | Config save debounce timeout ID |
| `window.callTimer` | number/null | null | Call duration timer interval ID |

---

## Helper Functions

### helpers.js

Utility functions used throughout the application.

#### Functions

**`window.isValidUsername(username)`**
- **Description:** Validates username format (10 numeric digits)
- **Parameters:**
  - `username` (string) - Username to validate
- **Returns:** boolean - true if valid

**`window.validateNorthAmericanNumber(number)`**
- **Description:** Validates 10-digit North American phone number
- **Parameters:**
  - `number` (string) - Phone number to validate
- **Returns:** boolean - true if valid

**`window.formatPhoneNumber(number)`**
- **Description:** Formats phone number for display (e.g., "(555) 123-4567")
- **Parameters:**
  - `number` (string) - Raw phone number
- **Returns:** string - Formatted phone number

**`window.sanitizeNumber(number)`**
- **Description:** Removes all non-numeric characters except +
- **Parameters:**
  - `number` (string) - Raw input
- **Returns:** string - Sanitized number

**`window.debounce(func, wait)`**
- **Description:** Creates a debounced function
- **Parameters:**
  - `func` (function) - Function to debounce
  - `wait` (number) - Milliseconds to wait
- **Returns:** function - Debounced function

**`window.getPlatform()`**
- **Description:** Gets current platform (android/ios/web)
- **Returns:** string - Platform identifier

**`window.isCallActive()`**
- **Description:** Checks if a call is currently active
- **Returns:** boolean - true if call is active

---

## Storage Management

### storage.js

Manages all local data persistence using localforage.

#### Object: `window.Storage`

**`window.Storage.saveConfig()`**
- **Description:** Saves application configuration to local storage
- **Returns:** Promise<void>
- **Reads from:** Form fields (username, password, displayName, etc.)
- **Saves:** Configuration object with all settings
- **Side effects:** Shows "Settings saved locally" notification

**`window.Storage.loadConfig()`**
- **Description:** Loads configuration from local storage
- **Returns:** Promise<void>
- **Side effects:** Populates form fields, triggers auto-register if enabled

**`window.Storage.clearAll()`**
- **Description:** Clears all saved data (config, history, recordings)
- **Returns:** Promise<void>

**`window.Storage.addCallToHistory(type, number, duration, recording)`**
- **Description:** Adds a call entry to history
- **Parameters:**
  - `type` (string) - "incoming", "outgoing", "missed", or "declined"
  - `number` (string) - Phone number
  - `duration` (string) - Call duration (e.g., "01:23")
  - `recording` (string, optional) - Recording filename
- **Returns:** Promise<void>

**`window.Storage.getHistory()`**
- **Description:** Retrieves call history (last 100 calls)
- **Returns:** Promise<Array> - Array of call history objects

**`window.Storage.clearHistory()`**
- **Description:** Clears all call history
- **Returns:** Promise<void>

**`window.Storage.addRecordingToHistory(recording)`**
- **Description:** Adds recording metadata to history
- **Parameters:**
  - `recording` (object) - Recording metadata
- **Returns:** Promise<void>

**`window.Storage.getRecordings()`**
- **Description:** Retrieves recording metadata (last 50 recordings)
- **Returns:** Promise<Array> - Array of recording objects

**`window.Storage.clearRecordings()`**
- **Description:** Clears recording metadata
- **Returns:** Promise<void>

**`window.Storage.updateCallHistoryWithRecording(filename)`**
- **Description:** Links recording to most recent call history entry
- **Parameters:**
  - `filename` (string) - Recording filename
- **Returns:** Promise<void>

---

## UI Management

### ui-manager.js

Manages UI updates and view switching.

#### Functions

**`window.log(message)`**
- **Description:** Adds message to event log UI (last 10 messages)
- **Parameters:**
  - `message` (string) - Log message
- **Side effects:** Updates DOM, logs to console

**`window.updateStatus(text, registered)`**
- **Description:** Updates status indicator
- **Parameters:**
  - `text` (string) - Status text
  - `registered` (boolean) - Whether registered (adds CSS class)

**`window.setView(view)`**
- **Description:** Switches to specified view
- **Parameters:**
  - `view` (string) - "phone", "settings", "log", "contacts", or "history"
- **Side effects:** Shows/hides sections, updates active tab

**`window.showPhone()`**
- **Description:** Switches to phone view

**`window.showContacts()`**
- **Description:** Switches to contacts view

**`window.showSettings()`**
- **Description:** Switches to settings view

**`window.showLog()`**
- **Description:** Switches to event log view

**`window.showHistory()`**
- **Description:** Switches to call history view, renders history

**`window.showCallControls()`**
- **Description:** Shows in-call controls UI
- **Side effects:** Hides dialpad, starts wake lock, starts call service

**`window.hideCallControls()`**
- **Description:** Hides in-call controls UI
- **Side effects:** Shows dialpad, releases wake lock, stops call service

**`window.showDialpad()`**
- **Description:** Shows dialpad layer

**`window.hideDialpad()`**
- **Description:** Hides dialpad layer

**`window.hideIncomingCallUI()`**
- **Description:** Hides incoming call overlay

**`window.updateEventLogVisibility()`**
- **Description:** Shows/hides event log based on settings
- **Reads from:** hideEventLog checkbox

**`window.clearAllData()`**
- **Description:** Clears all form fields and stored data
- **Returns:** Promise<void>

---

## Audio Management

### audio.js

Manages audio playback and ringing.

#### Functions

**`window.startRinging()`**
- **Description:** Starts playing ringtone with vibration pattern
- **Side effects:** Plays audio, vibrates device (if available)

**`window.stopRinging()`**
- **Description:** Stops ringtone and vibration

**`window.tryStartWebRTCAudio()`**
- **Description:** Attempts to start WebRTC audio playback
- **Returns:** Promise<void>
- **Note:** Handles platform-specific audio session requirements

**`window.setupAudioSession()`**
- **Description:** Configures audio session for call handling

**`window.setupBluetoothAudio()`**
- **Description:** Sets up Bluetooth audio monitoring and routing

**`window.handleBluetoothAudio()`**
- **Description:** Handles Bluetooth audio device connection/routing

**`window.configureAudioSession()`**
- **Description:** Configures platform audio session for telephony

---

## Call Management

### call-handler.js

Manages call lifecycle and WebRTC media.

#### Functions

**`window.makeCall()`**
- **Description:** Initiates an outgoing call
- **Reads from:** callNumber input, callerID input, hideCallerID checkbox
- **Side effects:** Creates SIP session, shows call controls, starts ringing
- **Validates:** Phone number format, registration status, caller ID format

**`window.handleIncomingCall(session)`**
- **Description:** Handles incoming SIP INVITE
- **Parameters:**
  - `session` (object) - SIP.js session object
- **Side effects:** Shows incoming call UI, starts ringing, sets 30s timeout

**`window.answerCall()`**
- **Description:** Answers incoming call
- **Side effects:** Transfers session to currentSession, shows call controls

**`window.declineCall()`**
- **Description:** Declines/rejects incoming call
- **Side effects:** Sends SIP 486 Busy, adds to history as "declined"

**`window.setupSessionHandlers(session)`**
- **Description:** Attaches event handlers to SIP session
- **Parameters:**
  - `session` (object) - SIP.js session object
- **Handlers:** progress, accepted, terminated, failed, rejected, bye, trackAdded

**`window.setupIncomingSessionHandlers(session)`**
- **Description:** Attaches event handlers specific to incoming sessions
- **Parameters:**
  - `session` (object) - SIP.js session object

---

## SIP Registration

### sip-manager.js

Manages SIP registration and re-registration.

#### Functions

**`window.register()`**
- **Description:** Registers with SIP server
- **Returns:** Promise<void>
- **Reads from:** sipServer, username, password, displayName inputs
- **Side effects:** Creates UserAgent, registers, updates UI
- **Handles:** Concurrent registration prevention via promise locking

**`window.unregister()`**
- **Description:** Unregisters from SIP server
- **Returns:** Promise<void>
- **Side effects:** Stops UserAgent, updates UI, clears session state

**`window.reRegister()`**
- **Description:** Re-registers after app foreground/background
- **Returns:** Promise<void>
- **Checks:** Active call state, CallService running status
- **Debounces:** 500ms to prevent multiple re-registration attempts

**`window.executeReRegister()`**
- **Description:** Executes actual re-registration logic
- **Returns:** Promise<void>
- **Note:** Called by reRegister() after debounce period

**`window.setupWebSocketMonitoring()`**
- **Description:** Monitors WebSocket connection health
- **Side effects:** Checks connection every 5 seconds, marks as disconnected if closed

---

## Contact Management

### contacts.js

Manages device contact integration.

#### Functions

**`window.loadContacts()`**
- **Description:** Loads contacts from device
- **Returns:** Promise<void>
- **Requires:** Contacts permission
- **Side effects:** Populates contactsList, renders contacts UI

**`window.renderContacts()`**
- **Description:** Renders contacts list in UI
- **Reads from:** contactsList global variable
- **Side effects:** Updates contacts section DOM

**`window.callContact(number)`**
- **Description:** Initiates call to contact
- **Parameters:**
  - `number` (string) - Phone number to call
- **Side effects:** Fills callNumber input, switches to phone view, makes call

**`window.clearContacts()`**
- **Description:** Clears loaded contacts from memory
- **Side effects:** Empties contactsList, re-renders UI

**`window.setupContactSearch()`**
- **Description:** Sets up contact search input handler
- **Side effects:** Adds input event listener for real-time filtering

---

## Call History

### history.js

Manages call history display and playback.

#### Functions

**`window.renderCallHistory()`**
- **Description:** Renders call history list with recordings
- **Returns:** Promise<void>
- **Reads from:** Storage.getHistory()
- **Side effects:** Updates callHistory section DOM, loads recording audio sources

**`window.clearHistory()`**
- **Description:** Clears call history
- **Returns:** Promise<void>
- **Side effects:** Clears storage, re-renders UI

**`window.clearRecordings()`**
- **Description:** Deletes all recording files and metadata
- **Returns:** Promise<void>
- **Side effects:** Removes files via plugin, clears storage, updates history

**`window.redial(number)`**
- **Description:** Redials a number from history
- **Parameters:**
  - `number` (string) - Phone number to redial
- **Side effects:** Fills callNumber input, switches to phone view, makes call if registered

---

## Call Recording

### recording.js

Manages call recording functionality.

#### Functions

**`window.startRecording()`**
- **Description:** Starts recording current call
- **Returns:** Promise<void>
- **Requirements:** Active call, recording enabled
- **Side effects:** Captures audio streams, sends to native plugin

**`window.stopRecording()`**
- **Description:** Stops recording and saves file
- **Returns:** Promise<void>
- **Side effects:** Stops recording, saves file, adds to history

---

## Native Integration

### native-integration.js

Integrates with Capacitor native plugins.

#### Functions

**`window.setupAppStateListeners()`**
- **Description:** Sets up app state change listeners (foreground/background)
- **Side effects:** Triggers re-registration on app resume

**`window.requestWakeLock()`**
- **Description:** Requests screen wake lock during calls
- **Platform:** Android/Web

**`window.releaseWakeLock()`**
- **Description:** Releases screen wake lock

**`window.startCallService(number)`**
- **Description:** Starts Android foreground service for call
- **Parameters:**
  - `number` (string) - Phone number being called
- **Platform:** Android only

**`window.stopCallService()`**
- **Description:** Stops Android foreground service
- **Platform:** Android only

**`window.isCallServiceRunning()`**
- **Description:** Checks if call service is running
- **Returns:** Promise<boolean>
- **Platform:** Android only

**`showIncomingCallNotification(callerName, callerNumber)`**
- **Description:** Shows native notification for incoming call
- **Parameters:**
  - `callerName` (string) - Caller's name
  - `callerNumber` (string) - Caller's number
- **Returns:** Promise<void>
- **Platform:** Android only

**`dismissIncomingCallNotification()`**
- **Description:** Dismisses incoming call notification
- **Platform:** Android only

**`reportCallConnected()`**
- **Description:** Reports call connected to CallKit (stops ringtone)
- **Returns:** Promise<void>
- **Platform:** iOS only

---

## Event Handlers

### event-handlers.js

Sets up all UI event listeners (replaces inline onclick handlers).

#### Functions

**`window.setupEventHandlers()`**
- **Description:** Attaches all event listeners to UI elements
- **Attaches listeners for:**
  - Navigation buttons (Phone, Contacts, History, Log, Settings)
  - Registration buttons (Register, Unregister)
  - Call control buttons (Call, Hangup, Mute, Answer, Decline)
  - Dialpad buttons (0-9, *, #, Clear)
  - Contact buttons (Load, Refresh, Clear)
  - History buttons (Refresh, Clear History, Clear Recordings)
  - Clear All Data button
  - Redial buttons (dynamically created)
- **Note:** Uses proper addEventListener instead of inline onclick

---

## Call Controls

### call-controls.js

Manages in-call control functions.

#### Functions

**`window.hangup()`**
- **Description:** Ends current call
- **Side effects:** Sends BYE, clears session, stops recording, updates history

**`window.toggleMute()`**
- **Description:** Toggles call mute status
- **Side effects:** Mutes/unmutes local audio, updates UI

**`window.sendDTMF(digit)`**
- **Description:** Sends DTMF tone during call
- **Parameters:**
  - `digit` (string) - Digit to send (0-9, *, #)
- **Methods:** RFC 2833 telephone-event or SIP INFO fallback

**`window.appendNumber(digit)`**
- **Description:** Adds digit to dialpad input and sends DTMF if in call
- **Parameters:**
  - `digit` (string) - Digit to append

**`window.clearNumber()`**
- **Description:** Clears dialpad input field

**`startCallTimer()`**
- **Description:** Starts call duration timer
- **Side effects:** Updates UI every second with call duration

**`stopCallTimer()`**
- **Description:** Stops call duration timer

**`endCall()`**
- **Description:** Handles call termination cleanup
- **Side effects:** Stops recording, stops timer, updates history, clears session

---

## Application Initialization

### app.js

Initializes the application and sets up global event listeners.

#### Functions

**`initializeApp()`**
- **Description:** Main application initialization function
- **Async:** Yes
- **Steps:**
  1. Validates SIP.js library loaded
  2. Sets application title and version
  3. Initializes SIP server configuration
  4. Loads saved configuration
  5. Sets up app state listeners
  6. Sets up audio session
  7. Sets up WebSocket monitoring
  8. Sets up contact search
  9. Loads contacts
  10. Defines navigation functions
  11. Sets up event handlers
  12. Sets up Bluetooth audio
  13. Sets up input validation
  14. Sets up auto-save listeners
  15. Sets up keyboard shortcuts
  16. Sets up keyboard detection for dialpad

**`setupKeyboardDetection()`**
- **Description:** Detects soft keyboard show/hide to toggle dialpad visibility
- **Uses:** Visual Viewport API (iOS/Android) with focus/blur fallback
- **Side effects:** Hides dialpad buttons when keyboard appears, shows when dismissed

**`cleanupAllResources()`**
- **Description:** Cleans up all resources on app close
- **Side effects:** Clears timeouts, closes sessions, resets state

---

## Usage Examples

### Making a Call

```javascript
// User enters number and clicks call button
document.getElementById("callNumber").value = "5551234567";
await window.register(); // Must be registered first
window.makeCall();
```

### Answering an Incoming Call

```javascript
// When incoming call arrives, handleIncomingCall is called automatically
// User clicks answer button
window.answerCall();
```

### Sending DTMF

```javascript
// During active call
window.sendDTMF("1"); // Sends digit 1
window.sendDTMF("#"); // Sends # key
```

### Accessing Call History

```javascript
// Get all call history
const history = await window.Storage.getHistory();
console.log(history);
// [
//   { type: "outgoing", number: "5551234567", duration: "01:23", timestamp: "2024-11-10T..." },
//   { type: "incoming", number: "5559876543", duration: "05:45", timestamp: "2024-11-09T..." }
// ]
```

### Loading Contacts

```javascript
// Load device contacts (requires permission)
await window.loadContacts();
console.log(window.contactsList);
// Call a contact
window.callContact("5551234567");
```

---

## Error Handling

All async functions use try-catch blocks and log errors to both:
- `window.log()` - User-visible event log
- `console.error()` - Browser console for debugging

Example error handling pattern:
```javascript
try {
  await window.register();
} catch (error) {
  window.log("Registration failed: " + error.message);
  console.error("Registration error:", error);
}
```

---

## Platform Detection

Use `window.getPlatform()` to detect current platform:

```javascript
const platform = window.getPlatform();
if (platform === "ios") {
  // iOS-specific code
} else if (platform === "android") {
  // Android-specific code
} else {
  // Web browser fallback
}
```

---

## Best Practices

1. **Always check registration status** before making calls:
   ```javascript
   if (!window.isRegistered) {
     alert("Please register first");
     return;
   }
   ```

2. **Use async/await** for all storage operations:
   ```javascript
   await window.Storage.saveConfig();
   ```

3. **Check for active calls** before allowing actions:
   ```javascript
   if (window.isCallActive()) {
     alert("Call already in progress");
     return;
   }
   ```

4. **Clean up resources** properly:
   ```javascript
   if (window.currentSession) {
     window.hangup();
   }
   ```

5. **Handle platform differences**:
   ```javascript
   if (window.Capacitor?.isNativePlatform()) {
     // Native code
   } else {
     // Web fallback
   }
   ```

---

## Troubleshooting

### Function not found errors
- Ensure all modules are loaded: Check browser console for load errors
- Verify function is called with `window.` prefix: `window.register()` not `register()`

### Call not connecting
- Check registration status: `window.isRegistered` should be `true`
- Verify WebSocket connection: Check event log for "SIP/2.0 200 OK"
- Check network: Ensure WebSocket can connect to SIP server

### Audio not working
- Check browser permissions: Microphone permission required
- Verify audio elements: Inspect `<audio id="remoteAudio">` element
- Platform-specific: iOS requires user interaction before audio playback

### Storage not persisting
- Check "Save credentials" checkbox is enabled
- Verify browser storage is not full or disabled
- Check browser console for localforage errors

---

## Version History

- **3.5.6** (2024-11-10) - Modularized architecture, removed inline onclick, race condition fixes
- **3.5.5** (2024-10-15) - Call recording improvements
- **3.5.0** (2024-09-01) - Initial public release

---

For more information, see [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).