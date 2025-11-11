// VoiceTel Phone Mobile - Configuration
// Constants and application configuration

// Make all constants globally accessible via window object
// This allows them to be used across all modules loaded via separate script tags

// Timing Constants
window.INCOMING_CALL_TIMEOUT_MS = 30000;
window.DTMF_DURATION_MS = 250;
window.DTMF_INTERTONE_GAP_MS = 100;
window.SIP_REGISTRATION_EXPIRES_SEC = 180;
window.USERNAME_LENGTH = 10;

// Application Version
window.APP_VERSION = window.VOICETEL_VERSION || "3.5.6.2";

// SIP Server Configuration
window.SIP_DOMAIN = window.VOICETEL_SIP_DOMAIN || "tls.voicetel.com";
window.SIP_SERVER = window.VOICETEL_SIP_SERVER || "wss://tls.voicetel.com:443";

// Make constants accessible without window prefix for convenience
// These create global variables that reference the window properties
INCOMING_CALL_TIMEOUT_MS = window.INCOMING_CALL_TIMEOUT_MS;
DTMF_DURATION_MS = window.DTMF_DURATION_MS;
DTMF_INTERTONE_GAP_MS = window.DTMF_INTERTONE_GAP_MS;
SIP_REGISTRATION_EXPIRES_SEC = window.SIP_REGISTRATION_EXPIRES_SEC;
USERNAME_LENGTH = window.USERNAME_LENGTH;
APP_VERSION = window.APP_VERSION;
SIP_DOMAIN = window.SIP_DOMAIN;
SIP_SERVER = window.SIP_SERVER;
