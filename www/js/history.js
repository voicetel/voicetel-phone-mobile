// ========================================
// HISTORY MODULE
// ========================================

window.renderCallHistory = async function () {
	const el = document.getElementById("callHistory");
	if (!el) return;

	const history = await window.Storage.getHistory();

	if (history.length === 0) {
		el.innerHTML = `
						<div class="contact-item" style="text-align: center; padding: 20px; color: #666;">
							<p style="font-size: 14px;">No call history yet</p>
						</div>
					`;
		return;
	}

	el.innerHTML = "";
	history.forEach((item, index) => {
		let icon = "❓"; // Default for unknown
		let callType = "Unknown";

		if (item.type === "incoming") {
			icon = "⬇️"; // Incoming answered call
			callType = "Incoming";
		} else if (item.type === "outgoing") {
			icon = "⬆️"; // Outgoing call
			callType = "Outgoing";
		} else if (item.type === "missed") {
			icon = "🔴"; // Missed call (rang but not answered)
			callType = "Missed";
		} else if (item.type === "declined") {
			icon = "⛔"; // Declined call (explicitly rejected)
			callType = "Declined";
		}

		// Format phone number consistently
		const cleanNumber = item.number.replace(/\D/g, "");
		const displayNumber = window.formatPhoneNumber(item.number);

		const timestamp = new Date(item.timestamp).toLocaleString();
		const safeNumber = cleanNumber
			.replace(/'/g, "\\'")
			.replace(/"/g, '\\"');

		// Check if this call has a recording (stored directly in history entry)
		const recordingFilename = item.recording || null;

		const historyDiv = document.createElement("div");
		historyDiv.className = "contact-item";
		historyDiv.style.cssText = `
						padding: 16px 20px;
						border-bottom: 1px solid #f0f0f0;
						cursor: pointer;
						transition: all 0.2s ease;
						background: white;
					`;

		// Create the history display HTML
		let recordingHTML = "";
		if (recordingFilename) {
			recordingHTML = `
							<div style="margin-top: 8px; margin-left: 30px;">
								<audio
									id="history-recording-${index}"
									controls
									playsinline
									style="width: 100%; max-width: 350px; height: 32px;"
									preload="metadata"
								>
									Your browser does not support the audio element.
								</audio>
							</div>
						`;
		}

		const historyHTML = `
						<div style="padding: 6px 0;">
							<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
								<span style="font-size: 18px;">${icon}</span>
								<div style="flex: 1;">
									<button class="redial-btn" data-number="${safeNumber}"
										style="background: none; border: none; color: #007bff; text-decoration: underline; cursor: pointer; font-family: monospace; font-size: 12px; padding: 0; text-align: left; font-weight: 600;">
										${displayNumber}
									</button>
									<div style="font-size: 10px; color: #888; text-transform: capitalize; margin-top: 2px;">
										${callType.toLowerCase()}
									</div>
								</div>
							</div>
							<div style="font-size: 10px; color: #666; margin-left: 30px;">
								${timestamp}
							</div>
							${recordingHTML}
						</div>
					`;

		historyDiv.innerHTML = historyHTML;

		historyDiv.addEventListener("mouseenter", () => {
			historyDiv.style.backgroundColor = "#f5f5f5";
		});
		historyDiv.addEventListener("mouseleave", () => {
			historyDiv.style.backgroundColor = "transparent";
		});

		// Add event listener for redial button
		const redialBtn = historyDiv.querySelector(".redial-btn");
		if (redialBtn) {
			redialBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const number = redialBtn.getAttribute("data-number");
				if (number) {
					window.redial(number);
				}
			});
		}

		el.appendChild(historyDiv);

		// Load recording audio source if available
		if (recordingFilename) {
			setTimeout(async () => {
				const audioEl = document.getElementById(
					`history-recording-${index}`,
				);
				if (!audioEl) return;

				try {
					if (
						window.Capacitor &&
						window.Capacitor.isNativePlatform()
					) {
						const platform = getPlatform();

						// Single path: CallService on all platforms
						const { CallService } = window.Capacitor.Plugins;
						if (!CallService)
							throw new Error("CallService not available");

						const result = await CallService.getRecordingFileUrl({
							filename: recordingFilename,
						});

						if (result && result.url) {
							// Convert data URL to blob URL for both platforms to avoid size limits
							// This is more memory efficient and works better for long recordings
							const match = result.url.match(
								/^data:([^;]+);base64,(.+)$/,
							);
							if (match) {
								const mimeType = match[1];
								const base64Data = match[2];

								// Decode base64 to binary
								const bytes = atob(base64Data);
								const arr = new Uint8Array(bytes.length);
								for (let i = 0; i < bytes.length; i++) {
									arr[i] = bytes.charCodeAt(i);
								}

								// Create blob URL (more efficient than data URLs for large files)
								const blob = new Blob([arr], {
									type: mimeType,
								});
								const blobUrl = URL.createObjectURL(blob);

								// Clean up old blob URL if exists
								if (audioEl._oldBlobUrl) {
									URL.revokeObjectURL(audioEl._oldBlobUrl);
								}
								audioEl._oldBlobUrl = blobUrl;
								audioEl.src = blobUrl;
							} else {
								// Fallback: use URL directly if not a data URL
								audioEl.src = result.url;
							}
						}

						audioEl.addEventListener(
							"error",
							(e) => {
								console.error(
									"Recording playback error:",
									audioEl.error,
								);
							},
							{ once: true },
						);
					}
				} catch (error) {
					console.error("Error loading recording:", error);
				}
			}, 100);
		}
	});
};

window.clearHistory = async function () {
	await window.Storage.clearHistory();
	window.renderCallHistory();
};

window.clearRecordings = async function () {
	try {
		// Get all recordings from metadata storage
		const recordings = await window.Storage.getRecordings();

		// Get all history entries to find recording filenames
		const history = await window.Storage.getHistory();
		const historyRecordings = history
			.filter((item) => item.recording)
			.map((item) => item.recording);

		// Combine all recording filenames (remove duplicates)
		const allRecordings = [
			...new Set([
				...recordings.map((r) => r.filename),
				...historyRecordings,
			]),
		];

		window.log(`Deleting ${allRecordings.length} recording files...`);

		// Delete all recording files via native plugin
		let deletedCount = 0;
		if (
			window.Capacitor &&
			window.Capacitor.isNativePlatform() &&
			window.Capacitor.Plugins &&
			window.Capacitor.Plugins.CallService
		) {
			const CallService = window.Capacitor.Plugins.CallService;
			for (const filename of allRecordings) {
				try {
					const result = await CallService.deleteRecordingFile({
						filename,
					});
					if (result && result.success) {
						deletedCount++;
					}
				} catch (error) {
					console.error(`Failed to delete ${filename}:`, error);
				}
			}
		}

		// Clear recordings metadata storage
		await window.Storage.clearRecordings();

		// Remove recording field from all history entries
		for (const item of history) {
			if (item.recording) {
				delete item.recording;
			}
		}
		await localforage.setItem(window.Storage.HISTORY_KEY, history);

		window.log(`Deleted ${deletedCount} recording files.`);

		// Refresh call history display
		window.renderCallHistory();
	} catch (error) {
		window.log(`Failed to clear recordings: ${error.message}`);
		console.error("Clear recordings error:", error);
	}
};

window.redial = function (num) {
	try {
		document.getElementById("callNumber").value = (num || "").replace(
			/[^0-9+]/g,
			"",
		);
		window.setView("phone");
		if (window.isRegistered) {
			window.makeCall();
		}
	} catch (e) {
		console.error("Redial failed:", e);
	}
	return false;
};
