// ========================================
// SIP MANAGER MODULE
// ========================================

window.register = async function() {
				if (typeof SIP === "undefined") {
					alert(
						"SIP.js library is not loaded. Please refresh the page.",
					);
					window.log("Error: SIP.js library not available");
					return;
				}

				// If registration is already in progress, return the existing promise
				if (window.registrationPromise) {
					window.log(
						"Registration already in progress - waiting for completion",
					);
					return window.registrationPromise;
				}

				// If currently unregistering, wait for it to complete first
				if (window.unregistrationPromise) {
					window.log(
						"Unregistration in progress - waiting for completion before registering",
					);
					try {
						await unregistrationPromise;
					} catch (error) {
						window.log(
							`Error waiting for unregistration: ${error.message}`,
						);
					}
				}

				const server = document.getElementById("sipServer").value;
				const username = document.getElementById("username").value;
				const password = document.getElementById("password").value;
				const displayName =
					document.getElementById("displayName").value || username;
				const callerID = document.getElementById("callerID").value;

				if (!server || !username || !password) {
					alert("Please fill in all required fields");
					return Promise.reject(new Error("Missing required fields"));
				}

				if (!window.isValidUsername(username)) {
					alert("Username must be exactly 10 numeric digits");
					document.getElementById("usernameError").style.display =
						"block";
					return Promise.reject(new Error("Invalid username"));
				}

				// Create and store the registration promise
				window.registrationPromise = new Promise((resolve, reject) => {
					window.registeredUsername = username;

					window.log("Starting registration...");
					window.log(`Connecting to VoiceTel server (${SIP_DOMAIN})...`);

					const uri = `sip:${username}@${SIP_DOMAIN}`;

					const transportOptions = {
						wsServers: [server],
						traceSip: true,
						wsServerMaxReconnectionAttempts: 0,
						wsServerReconnectionTimeout: 0,
					};

					const userAgentOptions = {
						uri: uri,
						transportOptions: transportOptions,
						authorizationUser: username,
						password: password,
						displayName: displayName,
						userAgentString: `VoiceTel/${APP_VERSION}`,
						register: true,
						registerOptions: {
							registrar: `sip:${SIP_DOMAIN}`,
							expires: SIP_REGISTRATION_EXPIRES_SEC,
						},
						sessionDescriptionHandlerFactoryOptions: {
							constraints: {
								audio: true,
								video: false,
							},
							peerConnectionOptions: {
								rtcConfiguration: {
									iceServers: [
										{
											urls: "stun:stun.l.google.com:19302",
										},
										{
											urls: "stun:stun1.l.google.com:19302",
										},
									],
								},
							},
						},
						hackWssInTransport: false,
						hackIpInContact: true,
						dtmfType: "rtp",
					};

					try {
						window.userAgent = new SIP.UA(userAgentOptions);

						// Set up one-time event handlers for this registration attempt
						const onRegistered = () => {
							window.isRegistered = true;
							window.registrationPromise = null; // Clear promise on success
							window.updateStatus("Registered", true);
							window.log("Successfully registered");
							window.log("SIP/2.0 200 OK");

							document.getElementById("registerBtn").disabled =
								true;
							document.getElementById("unregisterBtn").disabled =
								false;
							document.getElementById("callBtn").disabled = false;

							if (
								"Notification" in window &&
								Notification.permission === "default"
							) {
								Notification.requestPermission().then(
									(permission) => {
										if (permission === "granted") {
											window.log(
												"Desktop notifications enabled for incoming calls",
											);
										}
									},
								);
							}

							// Remove one-time handlers
							userAgent.off("registered", onRegistered);
							userAgent.off(
								"registrationFailed",
								onRegistrationFailed,
							);

							resolve();
						};

						const onRegistrationFailed = (response, cause) => {
							window.registrationPromise = null; // Clear promise on failure
							window.isRegistered = false;

							if (
								response &&
								response.status_code &&
								response.reason_phrase
							) {
								window.log(
									`SIP/2.0 ${response.status_code} ${response.reason_phrase}`,
								);
							}
							window.log(`Registration failed: ${cause}`);
							window.updateStatus("Registration Failed");

							// Remove one-time handlers
							userAgent.off("registered", onRegistered);
							userAgent.off(
								"registrationFailed",
								onRegistrationFailed,
							);

							// Clean up userAgent on failure
							if (window.userAgent) {
								try {
									userAgent.stop();
								} catch (e) {
									window.log(
										`Error stopping userAgent: ${e.message}`,
									);
								}
								window.userAgent = null;
							}

							reject(new Error(`Registration failed: ${cause}`));
						};

						// Attach one-time handlers
						userAgent.once("registered", onRegistered);
						userAgent.once(
							"registrationFailed",
							onRegistrationFailed,
						);

						// Set up persistent event handlers (not one-time)
						userAgent.on("unregistered", () => {
							window.log("SIP/2.0 200 OK (Unregistered)");
						});

						userAgent.on("invite", (session) => {
							const callerInfo =
								session.remoteIdentity.displayName ||
								session.remoteIdentity.uri.user;
							window.log(`Incoming call from ${callerInfo}`);

							if (
								"Notification" in window &&
								Notification.permission === "granted"
							) {
								new Notification("VoiceTel Phone", {
									body: `Incoming call from ${callerInfo}`,
									icon: "📞",
									requireInteraction: true,
								});
							}

							handleIncomingCall(session);
						});

						userAgent.start();
					} catch (error) {
						window.registrationPromise = null; // Clear promise on error
						window.log(`Registration failed: ${error.message}`);
						window.updateStatus("Registration Failed");
						console.error(error);
						reject(error);
					}
				});

				return window.registrationPromise;
			}

window.unregister = async function() {
				// If unregistration already in progress, return the existing promise
				if (window.unregistrationPromise) {
					window.log(
						"Unregistration already in progress - waiting for completion",
					);
					return window.unregistrationPromise;
				}

				// If registration is in progress, wait for it to complete first
				if (window.registrationPromise) {
					window.log(
						"Registration in progress - waiting for completion before unregistering",
					);
					try {
						await registrationPromise;
					} catch (error) {
						// Continue with unregistration even if registration failed
						window.log(
							`Registration completed with error: ${error.message}`,
						);
					}
				}

				window.unregistrationPromise = new Promise((resolve, reject) => {
					try {
						// Clean up WebSocket event listeners
						window.cleanupWebSocketHandler();

						if (window.userAgent) {
							userAgent.unregister();
							userAgent.stop();
							window.userAgent = null;
						}

						window.isRegistered = false;
						window.registeredUsername = null;
						window.unregistrationPromise = null; // Clear promise on success
						window.updateStatus("Disconnected");
						window.log("Unregistered successfully");

						document.getElementById("registerBtn").disabled = false;
						document.getElementById("unregisterBtn").disabled =
							true;
						document.getElementById("callBtn").disabled = true;

						resolve();
					} catch (error) {
						window.unregistrationPromise = null; // Clear promise on error
						window.log(`Unregister failed: ${error.message}`);
						console.error(error);
						reject(error);
					}
				});

				return window.unregistrationPromise;
			}

window.reRegister = async function() {
				window.log("=== RE-REGISTER FUNCTION CALLED ===");

				// Check for notification flag
				if (window.__skipReRegisterForNotification === true) {
					window.log(
						"RE-REGISTER: Returning from notification tap (active call) - skipping",
					);
					return;
				}

				// Check if CallForegroundService is running (most reliable check)
				if (await isCallServiceRunning()) {
					window.log(
						"RE-REGISTER: CallForegroundService is running (active call) - skipping",
					);
					if (window.reRegisterTimeout) {
						clearTimeout(window.reRegisterTimeout);
						window.reRegisterTimeout = null;
					}
					return;
				}

				// Check if there's an active call using helper function
				if (isCallActive()) {
					window.log(
						"RE-REGISTER: Active call detected - skipping re-registration",
					);
					return;
				}

				window.log(
					"App brought to foreground - WebSocket may have been killed, checking if re-registration needed...",
				);

				// Clear any existing timeout
				if (window.reRegisterTimeout) {
					clearTimeout(window.reRegisterTimeout);
					window.log("Cleared previous re-registration timeout");
				}

				// Debounce re-registration - only execute after 500ms of no new calls
				window.reRegisterTimeout = setTimeout(async () => {
					// Re-check notification flag
					if (window.__skipReRegisterForNotification === true) {
						window.log(
							"RE-REGISTER: Notification flag detected during debounce - skipping",
						);
						return;
					}

					// Re-check service and active call
					if ((await isCallServiceRunning()) || isCallActive()) {
						window.log(
							"RE-REGISTER: Active call detected during debounce - skipping",
						);
						return;
					}

					executeReRegister();
				}, 500);

				window.log(
					"Re-registration debounced - will execute in 500ms if no new calls",
				);
			}

window.executeReRegister = async function() {
				window.log("=== EXECUTING RE-REGISTER ===");

				// If registration already in progress, skip
				if (window.registrationPromise) {
					window.log(
						"Registration already in progress - skipping re-registration",
					);
					return;
				}

				// Final check for active call
				if (isCallActive()) {
					window.log("Active call detected - skipping re-registration");
					return;
				}

				const username = document.getElementById("username").value;
				const password = document.getElementById("password").value;

				if (!username || !password) {
					window.log("No credentials available for re-registration");
					return;
				}

				window.log(
					"No active call - checking if re-registration is needed...",
				);

				// Check if we're already registered and the connection seems healthy
				if (window.isRegistered && window.userAgent?.transport?.ws) {
					const ws = userAgent.transport.ws;
					if (ws.readyState === WebSocket.OPEN) {
						window.log(
							"WebSocket connection is healthy (readyState: OPEN)",
						);
						window.log(
							"SIP.js will automatically refresh registration - no action needed",
						);
						return;
					} else {
						window.log(
							"WebSocket connection is not open (readyState: " +
								ws.readyState +
								") - will re-register",
						);
					}
				}

				window.log("Re-registering with fresh WebSocket connection...");

				// Clean up any existing connection first
				if (window.userAgent) {
					try {
						await window.unregister();
						window.log("Cleaned up old connection");
					} catch (err) {
						window.log("Error cleaning up old connection: " + err);
					}
				}

				// Final check before registering
				if (isCallActive()) {
					window.log(
						"Active call detected during cleanup - aborting re-registration",
					);
					return;
				}

				// Now register with proper promise handling
				try {
					window.log("Registering with fresh WebSocket connection...");
					await window.register();
					window.log("Re-registration completed successfully");
				} catch (error) {
					window.log("Re-registration failed: " + error.message);
				}
			}

window.setupWebSocketMonitoring = function() {
				window.log("Setting up WebSocket connection monitoring...");

				// Monitor WebSocket connection status
				setInterval(() => {
					if (window.userAgent && window.isRegistered) {
						// Check if WebSocket is still connected
						if (userAgent.transport && userAgent.transport.ws) {
							if (
								userAgent.transport.ws.readyState ===
									WebSocket.CLOSED ||
								userAgent.transport.ws.readyState ===
									WebSocket.CLOSING
							) {
								window.log(
									"WebSocket connection lost - will re-register on next foreground",
								);
								// Mark as not registered so re-registration will happen
								window.isRegistered = false;
								// IMPORTANT: Clear registration promise if WebSocket died
								window.registrationPromise = null;
							}
						}
					}
				}, 5000); // Check every 5 seconds
			}

