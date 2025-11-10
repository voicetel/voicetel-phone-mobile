// ========================================
// GLOBAL VARIABLES
// ========================================
// All variables declared as direct window properties to be accessible across all modules
// DO NOT use let/const/var - those create script-scoped variables
// Direct assignment to window makes them truly global

// Global variables for SIP
window.registeredUsername = null;
window.userAgent = null;
window.currentSession = null;
window.incomingSession = null;
window.incomingCallTimeout = null;
window.isRegistered = false;
window.isMuted = false;
window.callTimer = null;
window.callStartTime = null;
window.ringingAudio = null;
window.registrationPromise = null;
window.unregistrationPromise = null;
window.reRegisterTimeout = null;
window.activeCall = false;
window.isRecording = false;
window.mediaRecorder = null;
window.recordedChunks = [];
window.recordingStream = null;
window.recordingAudioContext = null;
window.recordingDestination = null;
window.recordingCallStartTime = null;
window.recordingCallerNumber = null;
window.recordingCallDirection = null;
window.currentRecordingFilename = null;

// Bluetooth audio management
window.bluetoothAudioContext = null;
window.bluetoothAudioGain = null;

// Event listener cleanup tracking
window.activeEventListeners = new Set();
window.webSocketMessageHandler = null;

// Call tracking for history
window.__callDirection = null;
window.__answeredIncoming = false;
window.__originalCallNumber = null;
window.__incomingRaw = null;
window.__incomingDisplay = null;

// Contacts list
window.contactsList = [];

// Audio session state (iOS)
window.callKitAudioSessionActive = false;
window.pendingAudioStart = false;
window.audioStarted = false;

// Wake lock
window.wakeLock = null;
