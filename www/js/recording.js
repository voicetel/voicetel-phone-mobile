// ========================================
// RECORDING MODULE
// ========================================

window.startRecording = async function() {
				if (window.isRecording) {
					window.log("Recording already in progress");
					return;
				}

				// Check if recording is enabled in settings
				const recordingEnabled =
					document.getElementById("enableCallRecording")?.checked ||
					false;
				if (!recordingEnabled) {
					window.log("Call recording is disabled in settings");
					return;
				}

				try {
					const pc =
						currentSession.sessionDescriptionHandler.peerConnection;

					if (!pc) {
						throw new Error("PeerConnection not available");
					}

					window.log("Checking audio tracks...");

					// Create audio context for mixing
					window.recordingAudioContext = new (window.AudioContext ||
						window.webkitAudioContext)();
					window.recordingDestination =
						recordingAudioContext.createMediaStreamDestination();
					window.recordingStream = recordingDestination.stream;

					let tracksAdded = 0;

					// Get remote audio tracks (what we hear)
					const receivers = pc.getReceivers();
					window.log(`Found ${receivers.length} receivers`);
					receivers.forEach((receiver, idx) => {
						if (receiver.track && receiver.track.kind === "audio") {
							window.log(
								`Adding remote audio track ${idx}: ${receiver.track.id}, enabled: ${receiver.track.enabled}, muted: ${receiver.track.muted}`,
							);
							try {
								const remoteSource =
									recordingAudioContext.createMediaStreamSource(
										new MediaStream([receiver.track]),
									);
								remoteSource.connect(window.recordingDestination);
								tracksAdded++;
							} catch (e) {
								window.log(
									`Failed to add remote track ${idx}: ${e.message}`,
								);
								console.error("Remote track error:", e);
							}
						}
					});

					// Get local audio tracks (what we say)
					const senders = pc.getSenders();
					window.log(`Found ${senders.length} senders`);
					senders.forEach((sender, idx) => {
						if (sender.track && sender.track.kind === "audio") {
							window.log(
								`Adding local audio track ${idx}: ${sender.track.id}, enabled: ${sender.track.enabled}, muted: ${sender.track.muted}`,
							);
							try {
								const localSource =
									recordingAudioContext.createMediaStreamSource(
										new MediaStream([sender.track]),
									);
								localSource.connect(window.recordingDestination);
								tracksAdded++;
							} catch (e) {
								window.log(
									`Failed to add local track ${idx}: ${e.message}`,
								);
								console.error("Local track error:", e);
							}
						}
					});

					if (tracksAdded === 0) {
						throw new Error(
							"No audio tracks available for recording",
						);
					}

					window.log(
						`Connected ${tracksAdded} audio tracks to recording stream`,
					);
					window.log(
						`Recording stream has ${recordingStream.getAudioTracks().length} tracks`,
					);

					// Check if MediaRecorder is available
					if (!window.MediaRecorder) {
						throw new Error("MediaRecorder not supported");
					}

					if (!MediaRecorder.isTypeSupported) {
						throw new Error(
							"MediaRecorder.isTypeSupported not available",
						);
					}

					// Find supported MIME type
					// Prefer M4A (MP4/AAC) on iOS; WebM on other platforms
					const isIOS =
						(window.Capacitor &&
							typeof window.Capacitor.getPlatform ===
								"function" &&
							window.Capacitor.getPlatform() === "ios") ||
						/\(iPad|iPhone|iPod\)/.test(navigator.userAgent);
					const options = isIOS
						? [
								"audio/mp4;codecs=mp4a.40.2", // M4A/AAC
								"audio/mp4",
								"audio/aac",
								"audio/webm;codecs=opus",
								"audio/webm",
								"audio/ogg;codecs=opus",
								"audio/wav",
							]
						: [
								"audio/webm;codecs=opus",
								"audio/webm",
								"audio/ogg;codecs=opus",
								"audio/mp4;codecs=mp4a.40.2",
								"audio/mp4",
								"audio/mpeg",
								"audio/wav",
							];

					window.log("Checking supported audio formats...");
					let mimeType = null;
					for (let option of options) {
						const supported = MediaRecorder.isTypeSupported(option);
						window.log(`  ${option}: ${supported ? "✓" : "✗"}`);
						if (supported && !mimeType) {
							mimeType = option;
						}
					}

					if (!mimeType) {
						// Fallback to platform-default
						mimeType = isIOS ? "audio/mp4" : "audio/webm";
						window.log(
							`No preferred format supported, using default: ${mimeType}`,
						);
					} else {
						window.log(`Selected MIME type: ${mimeType}`);
					}

					// Verify the stream has tracks before creating MediaRecorder
					if (recordingStream.getTracks().length === 0) {
						throw new Error("Recording stream has no tracks");
					}

					// Create MediaRecorder
					window.recordedChunks = [];
					window.log("Creating MediaRecorder...");
					window.mediaRecorder = new MediaRecorder(window.recordingStream, {
						mimeType: mimeType,
					});

					mediaRecorder.ondataavailable = (event) => {
						if (event.data && event.data.size > 0) {
							recordedChunks.push(event.data);
							window.log(
								`Recording data chunk: ${event.data.size} bytes (total chunks: ${recordedChunks.length})`,
							);
						}
					};

					mediaRecorder.onstop = async () => {
						window.log(
							`Recording stopped. Total chunks: ${recordedChunks.length}, total size: ${recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`,
						);
						await saveRecording();
					};

					mediaRecorder.onerror = (event) => {
						window.log(
							`Recording error: ${event.error || "Unknown error"}`,
						);
						console.error("Recording error:", event);
						window.isRecording = false;
					};

					// Store call info for recording metadata
					window.recordingCallStartTime = callStartTime || Date.now();
					window.recordingCallerNumber =
						window.__callDirection === "outgoing"
							? __originalCallNumber || "Unknown"
							: __incomingRaw || window.__incomingDisplay || "Unknown";
					window.recordingCallDirection = __callDirection || "unknown";

					// Start recording
					window.log("Starting MediaRecorder...");
					mediaRecorder.start(1000); // Collect data every second
					window.isRecording = true;
					window.log("Recording started successfully");
				} catch (error) {
					window.log(`Failed to start recording: ${error.message}`);
					console.error("Recording start error:", error);
					window.isRecording = false;

					// Clean up on error
					if (window.recordingAudioContext) {
						try {
							recordingAudioContext.close();
						} catch (e) {}
						window.recordingAudioContext = null;
						window.recordingDestination = null;
						window.recordingStream = null;
					}
				}
			}

window.stopRecording = async function() {
				if (!window.isRecording || !mediaRecorder) {
					return null;
				}

				try {
					// Generate filename before stopping (so we can use it for history entry)
					const callerNumber = recordingCallerNumber || "Unknown";
					const filenameTimestamp = new Date()
						.toISOString()
						.replace(/[:.]/g, "-");
					const filename = `call-${callerNumber}-${filenameTimestamp}.${getFileExtension(mediaRecorder.mimeType)}`;
					window.currentRecordingFilename = filename;

					if (mediaRecorder.state === "recording") {
						mediaRecorder.stop();
					}

					window.isRecording = false;
					window.log("Recording stopped, saving file...");

					// Clean up audio context
					if (window.recordingAudioContext) {
						recordingAudioContext.close();
						window.recordingAudioContext = null;
						window.recordingDestination = null;
						window.recordingStream = null;
					}

					// Wait a bit for saveRecording to complete (it's called from MediaRecorder's onstop event)
					// Then clear metadata and return filename
					await new Promise((resolve) => setTimeout(resolve, 500));

					const savedFilename = currentRecordingFilename;

					// Clear recording metadata
					window.recordingCallStartTime = null;
					window.recordingCallerNumber = null;
					window.recordingCallDirection = null;
					window.currentRecordingFilename = null;

					return savedFilename;
				} catch (error) {
					window.log(`Failed to stop recording: ${error.message}`);
					console.error("Recording stop error:", error);
					window.isRecording = false;
					window.currentRecordingFilename = null;
					return null;
				}
			}

window.saveRecording = async function() {
				if (recordedChunks.length === 0) {
					window.log("No recording data to save");
					return;
				}

				try {
					const blob = new Blob(window.recordedChunks, {
						type: mediaRecorder.mimeType,
					});

					// Convert blob to base64 (handle large files properly)
					const base64 = await new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onloadend = () => {
							const base64String = reader.result.split(",")[1]; // Remove data:audio/webm;base64, prefix
							resolve(base64String);
						};
						reader.onerror = reject;
						reader.readAsDataURL(blob);
					});

					// Use filename generated in window.stopRecording() or generate new one
					const callerNumber = recordingCallerNumber || "Unknown";
					const callTimestamp = recordingCallStartTime
						? new Date(window.recordingCallStartTime).toISOString()
						: new Date().toISOString();
					const filename =
						currentRecordingFilename ||
						(() => {
							const filenameTimestamp = new Date()
								.toISOString()
								.replace(/[:.]/g, "-");
							return `call-${callerNumber}-${filenameTimestamp}.${getFileExtension(mediaRecorder.mimeType)}`;
						})();

					// Save to native platform
					const isNative =
						window.Capacitor &&
						((window.Capacitor.isNativePlatform &&
							window.Capacitor.isNativePlatform()) ||
							(window.Capacitor.getPlatform &&
								window.Capacitor.getPlatform() !== "web"));

					if (isNative) {
						const CallService =
							window.Capacitor.Plugins?.CallService;
						const Filesystem = window.Capacitor.Plugins?.Filesystem;

						// Try native plugin first (saves to Application Support on iOS)
						if (CallService?.saveRecording) {
							try {
								await CallService.saveRecording({
									filename: filename,
									data: base64,
									mimeType: mediaRecorder.mimeType,
								});
								window.log(`Recording saved: ${filename}`);

								await window.Storage.updateCallHistoryWithRecording(
									filename,
								);
								await window.Storage.addRecordingToHistory({
									filename: filename,
									callerNumber: callerNumber,
									direction:
										recordingCallDirection || "unknown",
									timestamp: callTimestamp,
									duration: getCallDuration(),
								});
								return;
							} catch (error) {
								console.error(
									"Native plugin save failed:",
									error,
								);
							}
						}

						// Fallback to Filesystem plugin (saves to Documents on iOS)
						if (Filesystem?.writeFile) {
							try {
								await Filesystem.mkdir({
									path: "CallRecordings",
									directory: "DATA",
									recursive: true,
								}).catch(() => {});

								// Write base64 data (Capacitor auto-decodes to binary)
								await Filesystem.writeFile({
									path: `CallRecordings/${filename}`,
									data: base64,
									directory: "DATA",
								});

								window.log(`Recording saved: ${filename}`);
								await window.Storage.updateCallHistoryWithRecording(
									filename,
								);
								await window.Storage.addRecordingToHistory({
									filename: filename,
									callerNumber: callerNumber,
									direction:
										recordingCallDirection || "unknown",
									timestamp: callTimestamp,
									duration: getCallDuration(),
								});
								return;
							} catch (error) {
								console.error("Filesystem save failed:", error);
							}
						}
					}

					// Web fallback: download file
					downloadRecording(blob, filename);
				} catch (error) {
					window.log(`Failed to save recording: ${error.message}`);
					console.error("Recording stop error:", error);
					window.isRecording = false;
					window.currentRecordingFilename = null;
				}
			}

window.downloadRecording = function(blob, filename) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				window.log(`Recording downloaded: ${filename}`);
			}

window.getFileExtension = function(mimeType) {
				if (mimeType.includes("webm")) return "webm";
				if (mimeType.includes("ogg")) return "ogg";
				if (mimeType.includes("mp4")) return "m4a"; // MP4 audio is typically M4A
				if (mimeType.includes("aac")) return "m4a"; // Prefer .m4a container naming for AAC
				if (mimeType.includes("mpeg") || mimeType.includes("mp3"))
					return "mp3";
				if (mimeType.includes("wav")) return "wav";
				return "webm";
			}

window.getCallDuration = function() {
				if (!window.callStartTime) return "00:00";
				const duration = Math.floor(
					(Date.now() - callStartTime) / 1000,
				);
				const minutes = Math.floor(duration / 60);
				const seconds = duration % 60;
				return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
			}

