// VoiceTel Phone Mobile - Storage Manager
// Handles all local storage operations using localforage

// Configure localforage
localforage.config({
	name: "VoiceTel",
	storeName: "config",
});

// Storage Manager Object - Make it globally accessible
window.Storage = {
	CONFIG_KEY: "voicetel_config",
	HISTORY_KEY: "voicetel_history",
	RECORDINGS_KEY: "voicetel_recordings",

	/**
	 * Save application configuration to local storage
	 */
	async saveConfig() {
		try {
			const saveEnabled =
				document.getElementById("saveCredentials").checked;

			if (!saveEnabled) {
				await localforage.removeItem(this.CONFIG_KEY);
				return;
			}

			const config = {
				username: document.getElementById("username").value,
				password: document.getElementById("password").value,
				displayName: document.getElementById("displayName").value,
				callerID: document.getElementById("callerID").value,
				hideCallerID: document.getElementById("hideCallerID").checked,
				registerOnStartup:
					document.getElementById("registerOnStartup").checked,
				hideEventLog: document.getElementById("hideEventLog").checked,
				enableCallRecording: document.getElementById(
					"enableCallRecording",
				).checked,
				saveCredentials: true,
			};

			await localforage.setItem(this.CONFIG_KEY, config);

			// Show saved indicator in settings
			const info = document.getElementById("storageInfo");
			if (info) {
				info.textContent = "✅ Settings saved locally";
				info.style.display = "block";
				info.style.color = "#4caf50";
				info.style.padding = "10px";
				info.style.marginTop = "10px";
				info.style.backgroundColor = "#e8f5e9";
				info.style.borderRadius = "4px";
				info.style.border = "1px solid #4caf50";
				setTimeout(() => {
					info.style.display = "none";
				}, 3000);
			}

			// Also log to event log
			window.log("✅ Configuration saved locally");
		} catch (e) {
			console.error("Save failed:", e);
			window.log("Failed to save configuration");
		}
	},

	/**
	 * Load application configuration from local storage
	 */
	async loadConfig() {
		try {
			const config = await localforage.getItem(this.CONFIG_KEY);

			if (!config) return;

			// Restore form fields
			const usernameEl = document.getElementById("username");
			const passwordEl = document.getElementById("password");
			const displayNameEl = document.getElementById("displayName");
			const callerIDEl = document.getElementById("callerID");

			if (config.username && usernameEl) {
				usernameEl.value = config.username;
			}
			if (config.password && passwordEl) {
				passwordEl.value = config.password;
			}
			if (config.displayName && displayNameEl) {
				displayNameEl.value = config.displayName;
			}
			if (config.callerID && callerIDEl) {
				callerIDEl.value = config.callerID;
			}

			// Restore checkboxes
			const hideCallerIDEl = document.getElementById("hideCallerID");
			const registerOnStartupEl =
				document.getElementById("registerOnStartup");
			const hideEventLogEl = document.getElementById("hideEventLog");
			const enableCallRecordingEl = document.getElementById(
				"enableCallRecording",
			);
			const saveCredentialsEl =
				document.getElementById("saveCredentials");

			if (hideCallerIDEl)
				hideCallerIDEl.checked = config.hideCallerID || false;
			if (registerOnStartupEl)
				registerOnStartupEl.checked = config.registerOnStartup || false;
			if (hideEventLogEl)
				hideEventLogEl.checked = config.hideEventLog || false;
			if (enableCallRecordingEl)
				enableCallRecordingEl.checked =
					config.enableCallRecording || false;
			if (saveCredentialsEl)
				saveCredentialsEl.checked = config.saveCredentials || false;

			window.log("Configuration loaded from local storage");

			// Update event log visibility based on setting
			if (typeof window.updateEventLogVisibility === "function") {
				window.updateEventLogVisibility();
			} else {
				console.warn("updateEventLogVisibility function not available");
			}

			// Auto-register if enabled
			if (
				config.registerOnStartup &&
				config.username &&
				config.password
			) {
				setTimeout(() => {
					window.log("Auto-registering...");
					if (typeof window.register === "function") {
						window.log(
							"Calling register function for auto-registration",
						);
						window.register();
					} else {
						console.error("register function not available!");
					}
				}, 500);
			}
		} catch (e) {
			console.error("Load failed:", e);
		}
	},

	/**
	 * Clear all saved data
	 */
	async clearAll() {
		await localforage.removeItem(this.CONFIG_KEY);
		await localforage.removeItem(this.HISTORY_KEY);
		window.log("All saved data cleared");
	},

	/**
	 * Add a call to history
	 * @param {string} type - Call type (incoming, outgoing, missed, declined)
	 * @param {string} number - Phone number
	 * @param {string} duration - Call duration
	 * @param {string} recording - Recording filename (optional)
	 */
	async addCallToHistory(type, number, duration, recording = null) {
		try {
			const history = (await localforage.getItem(this.HISTORY_KEY)) || [];
			history.unshift({
				type,
				number,
				duration,
				timestamp: new Date().toISOString(),
				recording: recording || null,
			});

			// Keep last 100 calls
			if (history.length > 100) {
				history.length = 100;
			}

			await localforage.setItem(this.HISTORY_KEY, history);
		} catch (e) {
			console.error("History save failed:", e);
		}
	},

	/**
	 * Update most recent call history entry with recording filename
	 * @param {string} filename - Recording filename
	 */
	async updateCallHistoryWithRecording(filename) {
		try {
			const history = await this.getHistory();
			if (history.length > 0 && !history[0].recording) {
				history[0].recording = filename;
				await localforage.setItem(this.HISTORY_KEY, history);
				window.log(`Recording ${filename} linked to call history`);
			}
		} catch (e) {
			console.error("Failed to update call history with recording:", e);
		}
	},

	/**
	 * Get call history
	 * @returns {Promise<Array>} Array of call history entries
	 */
	async getHistory() {
		return (await localforage.getItem(this.HISTORY_KEY)) || [];
	},

	/**
	 * Clear call history
	 */
	async clearHistory() {
		await localforage.removeItem(this.HISTORY_KEY);
	},

	/**
	 * Add recording metadata to history
	 * @param {Object} recording - Recording metadata object
	 */
	async addRecordingToHistory(recording) {
		try {
			const recordings =
				(await localforage.getItem(this.RECORDINGS_KEY)) || [];
			recordings.unshift(recording);

			// Keep last 50 recordings
			if (recordings.length > 50) {
				recordings.length = 50;
			}

			await localforage.setItem(this.RECORDINGS_KEY, recordings);
		} catch (e) {
			console.error("Recording metadata save failed:", e);
		}
	},

	/**
	 * Get all recordings metadata
	 * @returns {Promise<Array>} Array of recording metadata
	 */
	async getRecordings() {
		return (await localforage.getItem(this.RECORDINGS_KEY)) || [];
	},

	/**
	 * Clear recordings metadata
	 */
	async clearRecordings() {
		await localforage.removeItem(this.RECORDINGS_KEY);
	},
};
