// VoiceTel Phone Mobile - Helper Functions
// Reusable utility functions to reduce code duplication

/**
 * Check if there's an active call (incoming or current session)
 * @returns {boolean} True if there's an active call
 */
window.isCallActive = function() {
	if (window.incomingSession) return true;
	if (!window.currentSession) return false;

	const hasRequest =
		window.currentSession.request !== null &&
		window.currentSession.request !== undefined;
	const hasDialog =
		window.currentSession.dialog !== null &&
		window.currentSession.dialog !== undefined;
	const hasPeerConnection =
		window.currentSession.sessionDescriptionHandler?.peerConnection !==
			null &&
		window.currentSession.sessionDescriptionHandler?.peerConnection !==
			undefined;

	return hasRequest || hasDialog || hasPeerConnection;
}

/**
 * Get the current platform (web, ios, or android)
 * @returns {string} Platform identifier
 */
window.getPlatform = function() {
	if (!window.Capacitor) return "web";
	if (typeof window.Capacitor.getPlatform === "function") {
		return window.Capacitor.getPlatform();
	}
	if (window.Capacitor.isNativePlatform?.()) {
		return /\(iPad|iPhone|iPod\)/.test(navigator.userAgent)
			? "ios"
			: "android";
	}
	return "web";
}

/**
 * Format phone numbers consistently
 * @param {string} number - Phone number to format
 * @returns {string} Formatted phone number
 */
window.formatPhoneNumber = function(number) {
	if (!number) return "";
	const cleanNumber = number.replace(/\D/g, "");

	if (cleanNumber.length === 10) {
		// US format: (555) 123-4567
		return `(${cleanNumber.slice(0, 3)}) ${cleanNumber.slice(3, 6)}-${cleanNumber.slice(6)}`;
	} else if (cleanNumber.length === 11 && cleanNumber.startsWith("1")) {
		// 11 digits starting with 1: show as 10-digit format (555) 123-4567
		return `(${cleanNumber.slice(1, 4)}) ${cleanNumber.slice(4, 7)}-${cleanNumber.slice(7)}`;
	} else if (cleanNumber.length === 7) {
		// Local format: 123-4567
		return `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3)}`;
	} else if (cleanNumber.length > 11) {
		// International format: +XX XXX XXX XXXX
		const countryCode = cleanNumber.slice(0, cleanNumber.length - 10);
		const areaCode = cleanNumber.slice(
			cleanNumber.length - 10,
			cleanNumber.length - 7,
		);
		const firstPart = cleanNumber.slice(
			cleanNumber.length - 7,
			cleanNumber.length - 4,
		);
		const lastPart = cleanNumber.slice(cleanNumber.length - 4);
		return `+${countryCode} ${areaCode} ${firstPart} ${lastPart}`;
	}
	return number;
}

/**
 * Extract contact name from various contact data structures
 * Handles different formats returned by different platforms
 * @param {Object} contact - Contact object
 * @returns {string} Extracted contact name or "Unknown"
 */
window.extractContactName = function(contact) {
	if (!contact) return "Unknown";
	if (!contact.name) return contact.displayName || "Unknown";

	if (typeof contact.name === "string") return contact.name;
	if (contact.name.display) return contact.name.display;
	if (contact.name.given || contact.name.family) {
		return `${contact.name.given || ""} ${contact.name.family || ""}`.trim();
	}
	if (contact.name.givenName || contact.name.familyName) {
		return `${contact.name.givenName || ""} ${contact.name.familyName || ""}`.trim();
	}
	if (contact.name.displayName) return contact.name.displayName;

	return "Unknown";
}

/**
 * Clean up WebSocket message handler
 * Removes event listener to prevent memory leaks
 */
window.cleanupWebSocketHandler = function() {
	if (window.userAgent?.transport?.ws && window.webSocketMessageHandler) {
		window.userAgent.transport.ws.removeEventListener(
			"message",
			window.webSocketMessageHandler,
		);
		window.webSocketMessageHandler = null;
	}
}

/**
 * Check if CallForegroundService is running (active call indicator)
 * @returns {Promise<boolean>} True if service is running
 */
window.isCallServiceRunning = async function() {
	if (!window.Capacitor?.isNativePlatform()) return false;
	if (!window.Capacitor.Plugins?.CallService) return false;

	try {
		const CallService = window.Capacitor.Plugins.CallService;
		const result = await CallService.isServiceRunning();
		return result?.isRunning === true;
	} catch (err) {
		console.error("Failed to check service status:", err);
		return false;
	}
}

/**
 * Validate username (must be exactly 10 digits)
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
window.isValidUsername = function(username) {
	return (
		username &&
		/^\d{10}$/.test(username) &&
		username.length === window.USERNAME_LENGTH
	);
}

/**
 * Validate North American phone number format
 * @param {string} number - Phone number to validate
 * @returns {boolean} True if valid
 */
window.validateNorthAmericanNumber = function(number) {
	const cleaned = number.replace(/\D/g, "");
	if (cleaned.length !== 10) return false;
	const npaFirstDigit = parseInt(cleaned[0]);
	const nxxFirstDigit = parseInt(cleaned[3]);
	return (
		npaFirstDigit >= 2 &&
		npaFirstDigit <= 9 &&
		nxxFirstDigit >= 2 &&
		nxxFirstDigit <= 9
	);
}

/**
 * Format call duration in MM:SS format
 * @param {number} durationInSeconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
window.formatCallDuration = function(durationInSeconds) {
	const minutes = Math.floor(durationInSeconds / 60);
	const seconds = durationInSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type string
 * @returns {string} File extension
 */
window.getFileExtensionFromMimeType = function(mimeType) {
	if (!mimeType) return "webm";
	if (mimeType.includes("webm")) return "webm";
	if (mimeType.includes("ogg")) return "ogg";
	if (mimeType.includes("mp4")) return "m4a";
	if (mimeType.includes("aac")) return "m4a";
	if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
	if (mimeType.includes("wav")) return "wav";
	return "webm";
}

/**
 * Safely escape quotes in strings for HTML attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
window.escapeQuotes = function(str) {
	if (typeof str !== "string") return "";
	return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

/**
 * Log message to console and UI
 * @param {string} message - Message to log
 */
window.log = function(message) {
	// Log to console for logcat capture
	console.log(message);

	const logDiv = document.getElementById("log");
	if (!logDiv) return;

	const entry = document.createElement("div");
	entry.className = "log-entry";
	const timestamp = new Date().toLocaleTimeString();
	entry.textContent = `[${timestamp}] ${message}`;
	logDiv.insertBefore(entry, logDiv.firstChild);

	// Keep only last 10 entries
	while (logDiv.children.length > 10) {
		logDiv.removeChild(logDiv.lastChild);
	}
}

/**
 * Update status display
 * @param {string} text - Status text
 * @param {boolean} registered - Whether user is registered
 */
window.updateStatus = function(text, registered = false) {
	const statusEl = document.getElementById("status");
	if (!statusEl) return;

	statusEl.textContent = text;
	if (registered) {
		statusEl.classList.add("registered");
	} else {
		statusEl.classList.remove("registered");
	}
}
