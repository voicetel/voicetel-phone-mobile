// ========================================
// APPLICATION INITIALIZATION
// ========================================

// Initialize application
async function initializeApp() {
	if (typeof SIP === "undefined") {
		console.error("SIP.js library failed to load");
		window.log("Error: SIP.js library not loaded");
		alert(
			"SIP.js library failed to load. Please check your internet connection and refresh.",
		);
		return;
	}

	document.title = `VoiceTel Phone v${APP_VERSION}`;
	window.log(`VoiceTel Phone v${APP_VERSION} ready`);
	window.log("Using local storage");
	window.log("SIP.js " + (SIP.version || "0.15.x") + " loaded");

	// Initialize SIP server hidden field and info display
	const sipServerEl = document.getElementById("sipServer");
	if (sipServerEl) sipServerEl.value = SIP_SERVER;
	window.log(`Server: ${SIP_DOMAIN} (${SIP_SERVER})`);

	// Load saved configuration
	await window.Storage.loadConfig();

	// Setup app state listeners for re-registration
	window.setupAppStateListeners();

	// Setup audio session for lock screen continuity
	window.setupAudioSession();

	// Setup WebSocket connection monitoring
	window.setupWebSocketMonitoring();

	// Setup contact search functionality
	window.setupContactSearch();

	// Auto-load contacts on startup
	window.loadContacts();

	// Define navigation functions BEFORE setting up event handlers
	window.showPhone = () => window.setView("phone");
	window.showContacts = () => window.setView("contacts");
	window.showSettings = () => window.setView("settings");
	window.showLog = () => window.setView("log");
	window.showHistory = () => window.setView("history");

	// Setup all event handlers (replaces inline onclick handlers)
	window.setupEventHandlers();

	// Ensure event log visibility is set correctly after everything is loaded
	setTimeout(() => {
		window.updateEventLogVisibility();
	}, 100);

	// Setup Bluetooth audio
	window.setupBluetoothAudio();

	// Setup input handlers
	document.getElementById("username").addEventListener("input", function (e) {
		const value = e.target.value.replace(/\D/g, "");
		e.target.value = value.substring(0, USERNAME_LENGTH);

		const errorEl = document.getElementById("usernameError");
		if (value && value.length !== USERNAME_LENGTH) {
			errorEl.style.display = "block";
		} else {
			errorEl.style.display = "none";
		}
	});

	document.getElementById("callerID").addEventListener("input", function (e) {
		const value = e.target.value.replace(/\D/g, "");
		e.target.value = value.substring(0, USERNAME_LENGTH);

		const errorEl = document.getElementById("callerIDError");
		if (value && !window.validateNorthAmericanNumber(value)) {
			errorEl.style.display = "block";
		} else {
			errorEl.style.display = "none";
		}
	});

	// Auto-save on change
	[
		"username",
		"password",
		"displayName",
		"callerID",
		"hideCallerID",
		"saveCredentials",
		"registerOnStartup",
		"hideEventLog",
		"enableCallRecording",
	].forEach((id) => {
		const el = document.getElementById(id);
		if (el) {
			// Use 'change' event for checkboxes and 'blur' for text/password fields
			const isCheckbox = el.type === "checkbox";
			const eventType = isCheckbox ? "change" : "blur";

			el.addEventListener(eventType, () => {
				window.Storage.saveConfig();
				// Update event log visibility when hideEventLog changes
				if (id === "hideEventLog") {
					window.updateEventLogVisibility();
				}
			});

			// Also listen to 'input' for immediate feedback on text fields
			if (!isCheckbox) {
				el.addEventListener("input", () => {
					// Debounce saves on input to avoid too many saves while typing
					clearTimeout(window.saveConfigTimeout);
					window.saveConfigTimeout = setTimeout(() => {
						window.Storage.saveConfig();
					}, 1000); // Save 1 second after user stops typing
				});
			}
		} else {
			console.warn(`Element not found: ${id}`);
		}
	});

	// Keyboard shortcuts for incoming calls
	document.addEventListener("keydown", function (e) {
		if (window.incomingSession) {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				window.answerCall();
			} else if (e.key === "Escape") {
				e.preventDefault();
				window.declineCall();
			}
		}
	});

	// Setup keyboard detection for hiding/showing dialpad
	setupKeyboardDetection();
}

// Detect soft keyboard show/hide and toggle dialpad visibility
function setupKeyboardDetection() {
	const callNumberInput = document.getElementById("callNumber");
	const dialpadButtons = document.querySelector(".dialpad");

	if (!callNumberInput || !dialpadButtons) {
		return;
	}

	let isDialpadVisible = true;
	let keyboardVisible = false;

	// Use Visual Viewport API (works on iOS and Android)
	if (window.visualViewport) {
		const viewport = window.visualViewport;
		let initialHeight = viewport.height;

		viewport.addEventListener("resize", () => {
			const currentHeight = viewport.height;
			const heightDiff = initialHeight - currentHeight;

			// Keyboard is shown if viewport height decreased significantly (> 150px)
			if (heightDiff > 150) {
				if (!keyboardVisible && isDialpadVisible) {
					dialpadButtons.style.display = "none";
					keyboardVisible = true;
				}
			} else {
				// Keyboard is hidden
				if (keyboardVisible && isDialpadVisible) {
					dialpadButtons.style.display = "grid";
					keyboardVisible = false;
				}
			}
		});

		// Track when dialpad layer is shown/hidden
		const observer = new MutationObserver(() => {
			const dialpadLayer = document.getElementById("dialpadLayer");
			if (dialpadLayer) {
				isDialpadVisible =
					dialpadLayer.style.display !== "none" &&
					window.getComputedStyle(dialpadLayer).display !== "none";

				// If dialpad layer is hidden, reset keyboard state
				if (!isVisible && keyboardVisible) {
					keyboardVisible = false;
				}
			}
		});

		const dialpadLayer = document.getElementById("dialpadLayer");
		if (dialpadLayer) {
			observer.observe(dialpadLayer, {
				attributes: true,
				attributeFilter: ["style"],
			});
		}
	} else {
		// Fallback for browsers without Visual Viewport API
		// Use focus/blur as fallback (less reliable)
		callNumberInput.addEventListener("focus", () => {
			if (isDialpadVisible) {
				setTimeout(() => {
					dialpadButtons.style.display = "none";
					keyboardVisible = true;
				}, 300);
			}
		});

		callNumberInput.addEventListener("blur", () => {
			if (keyboardVisible && isDialpadVisible) {
				setTimeout(() => {
					dialpadButtons.style.display = "grid";
					keyboardVisible = false;
				}, 300);
			}
		});
	}
}

// Run initialization when DOM is ready (or immediately if already loaded)
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeApp);
} else {
	initializeApp();
}

// Cleanup function for proper resource management
function cleanupAllResources() {
	// Clear all timeouts
	if (window.incomingCallTimeout) {
		clearTimeout(window.incomingCallTimeout);
		window.incomingCallTimeout = null;
	}

	// Clean up WebSocket event listeners
	window.cleanupWebSocketHandler();

	// Clean up SIP sessions
	if (window.incomingSession) {
		try {
			incomingSession.reject();
		} catch (e) {}
		window.incomingSession = null;
	}
	if (window.currentSession) {
		try {
			currentSession.bye();
		} catch (e) {}
		window.currentSession = null;
	}
	if (window.userAgent) {
		try {
			userAgent.stop();
		} catch (e) {}
		window.userAgent = null;
	}

	// Reset all state
	window.isRegistered = false;
	window.registeredUsername = null;
	window.__callDirection = null;
	window.__answeredIncoming = false;
	window.__incomingRaw = null;
	window.__incomingDisplay = null;
}

// Cleanup on window close
window.addEventListener("beforeunload", () => {
	cleanupAllResources();
});
