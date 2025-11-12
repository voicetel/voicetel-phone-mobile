// ========================================
// CALL HANDLER MODULE
// ========================================

window.makeCall = async function () {
  // Reset audio flags for new call
  window.audioStarted = false;

  // iOS only: Reset CallKit-specific flags
  const isIOS = window.Capacitor?.getPlatform() === "ios";
  if (isIOS) {
    window.callKitAudioSessionActive = false;
    window.pendingAudioStart = false;
    window.__answeringInProgress = false;
    window.__callKitAnswered = false;
  }

  let number = document.getElementById("callNumber").value;
  const originalNumber = number;
  number = number.replace(/\D/g, "");

  if (originalNumber !== number && originalNumber.length > 0) {
    window.log(`Sanitized number: "${originalNumber}" → "${number}"`);
  }

  if (!number) {
    alert("Please enter a number to call");
    return;
  }

  if (!window.isRegistered || !userAgent) {
    alert("Please register first");
    return;
  }

  if (window.incomingSession) {
    alert("Please answer or decline the incoming call first");
    return;
  }

  const callerID = document.getElementById("callerID").value.replace(/\D/g, "");
  if (callerID && !window.validateNorthAmericanNumber(callerID)) {
    alert(
      "Please enter a valid 10-digit North American phone number for Caller ID",
    );
    document.getElementById("callerIDError").style.display = "block";
    return;
  }

  try {
    const displayName =
      document.getElementById("displayName").value || window.registeredUsername;
    const hideCallerID = document.getElementById("hideCallerID").checked;

    const domain = SIP_DOMAIN;
    const uri = `sip:${number}@${domain}`;

    const options = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false,
        },
      },
    };

    options.extraHeaders = [];

    let pAssertedIdentity;
    if (callerID && window.validateNorthAmericanNumber(callerID)) {
      const formattedNumber = "+1" + callerID;
      pAssertedIdentity = `"${displayName}" <sip:${formattedNumber}@${SIP_DOMAIN}>`;
      window.log(`Setting caller ID: ${displayName} ${formattedNumber}`);
    } else {
      pAssertedIdentity = `"${displayName}" <sip:${window.registeredUsername}@${SIP_DOMAIN}>`;
      window.log(
        `Using default caller ID: ${displayName} ${window.registeredUsername}`,
      );
    }

    options.extraHeaders.push("P-Asserted-Identity: " + pAssertedIdentity);
    options.extraHeaders.push("P-Preferred-Identity: " + pAssertedIdentity);

    if (hideCallerID) {
      options.extraHeaders.push("Privacy: id");
      window.log("Caller ID privacy enabled");
    } else {
      options.extraHeaders.push("Privacy: none");
    }

    if (isIOS && window.Capacitor?.Plugins?.CallService) {
      try {
        await window.Capacitor.Plugins.CallService.startOutgoingCall({
          callNumber: number,
        });
      } catch (err) {
        // Continue anyway - fallback to non-CallKit
      }
    }

    window.currentSession = userAgent.invite(uri, options);
    window.__callDirection = "outgoing";
    window.__originalCallNumber = number; // Store original number for call history

    // WebSocket progress sniff for ringing parity
    let sessionRingingStarted = false;
    if (currentSession.request) {
      const callId = currentSession.request.callId;
      window.webSocketMessageHandler = function (e) {
        if (e && e.data && e.data.includes(callId)) {
          const lines = e.data.split("\r\n");
          for (let line of lines) {
            if (line.startsWith("SIP/2.0")) {
              window.log(line);
              if (
                !sessionRingingStarted &&
                (line.includes("180 Ringing") ||
                  line.includes("183 Session Progress"))
              ) {
                window.startRinging();
                sessionRingingStarted = true;
              }
              if (sessionRingingStarted && line.includes("200 OK")) {
                window.stopRinging();
                sessionRingingStarted = false;
              }
              break;
            }
          }
        }
      };
      if (userAgent.transport && userAgent.transport.ws) {
        userAgent.transport.ws.addEventListener(
          "message",
          webSocketMessageHandler,
        );
        currentSession.on("terminated", () => {
          if (sessionRingingStarted) {
            window.stopRinging();
            sessionRingingStarted = false;
          }
          if (
            userAgent.transport &&
            userAgent.transport.ws &&
            window.webSocketMessageHandler
          ) {
            userAgent.transport.ws.removeEventListener(
              "message",
              webSocketMessageHandler,
            );
            window.webSocketMessageHandler = null;
          }
        });
        currentSession.on("failed", () => {
          if (sessionRingingStarted) {
            window.stopRinging();
            sessionRingingStarted = false;
          }
          if (
            userAgent.transport &&
            userAgent.transport.ws &&
            window.webSocketMessageHandler
          ) {
            userAgent.transport.ws.removeEventListener(
              "message",
              webSocketMessageHandler,
            );
            window.webSocketMessageHandler = null;
          }
        });
      }
    }

    window.setupSessionHandlers(window.currentSession);

    window.log(`Calling ${number}...`);
    window.log("SIP INVITE sent");
    window.showCallControls();
  } catch (error) {
    window.log(`Call failed: ${error.message}`);
    console.error(error);
    // Clean up on error - clear currentSession if it was set
    if (window.currentSession) {
      window.currentSession = null;
      window.hideCallControls();
    }
  }
};

window.handleIncomingCall = function (session) {
  // Reset audio flags for new incoming call
  window.audioStarted = false;

  // iOS only: Reset CallKit-specific flags
  const isIOS = window.Capacitor?.getPlatform() === "ios";
  if (isIOS) {
    window.callKitAudioSessionActive = false;
    window.pendingAudioStart = false;
    window.__answeringInProgress = false;
    window.__callKitAnswered = false;
  }

  window.__incomingRaw = null;
  window.__incomingDisplay = null;

  if (window.currentSession) {
    window.log("Auto-rejecting incoming call - already in a call");
    session.reject();
    window.log("SIP/2.0 486 Busy Here");
    return;
  }

  window.incomingSession = session;
  window.log("SIP INVITE received");

  const callerUri =
    session.remoteIdentity &&
    session.remoteIdentity.uri &&
    session.remoteIdentity.uri.user
      ? session.remoteIdentity.uri.user
      : "Unknown";
  window.__incomingRaw = callerUri;
  const callerName = session.remoteIdentity.displayName || "Unknown";

  const formattedNumber = window.formatPhoneNumber(callerUri);

  document.getElementById("incomingCallerName").textContent = callerName;
  document.getElementById("incomingCallerNumber").textContent = formattedNumber;
  window.__incomingDisplay = formattedNumber;

  document.getElementById("incomingCall").classList.add("active");
  window.hideDialpad();
  window.startRinging();
  window.log("SIP/2.0 180 Ringing");

  window.log("SIP INVITE received - awaiting answer");
  window.log(`Incoming call from ${callerName} ${formattedNumber}`);
  window.log("Press Enter to answer or Escape to decline");

  // Show incoming call notification (Android)
  // Don't await - fire and forget to avoid blocking the call handling
  showIncomingCallNotification(callerName, formattedNumber).catch((err) => {
    window.log("Error in showIncomingCallNotification: " + err.message);
    console.error("Notification error:", err);
  });

  // Clear any existing incoming call timeout before setting new one
  if (window.incomingCallTimeout) {
    clearTimeout(window.incomingCallTimeout);
    window.incomingCallTimeout = null;
  }

  window.incomingCallTimeout = setTimeout(() => {
    if (window.incomingSession) {
      window.log("Auto-declining unanswered call after 30 seconds");
      window.declineCall();
    }
  }, INCOMING_CALL_TIMEOUT_MS);

  window.setupIncomingSessionHandlers(session);
};

window.setupIncomingSessionHandlers = function (session) {
  // Track if this incoming call was answered
  let wasAnswered = false;

  session.on("terminated", () => {
    if (window.incomingCallTimeout) {
      clearTimeout(window.incomingCallTimeout);
      window.incomingCallTimeout = null;
    }
    window.hideIncomingCallUI();
    dismissIncomingCallNotification();

    // Only add "missed" if it was NOT answered and NOT manually declined
    if (!wasAnswered && !session.__declinedByUser) {
      window.log("Incoming call ended by caller (missed)");
      const num =
        __incomingRaw && window.__incomingRaw !== "Unknown"
          ? __incomingRaw
          : __incomingDisplay || "Unknown";
      window.Storage.addCallToHistory("missed", num, "00:00");
    }

    // Notify CallKit that incoming call terminated (caller hung up before answer)
    const isIOS = window.Capacitor?.getPlatform() === "ios";
    if (isIOS && window.Capacitor?.Plugins?.CallService) {
      window.Capacitor.Plugins.CallService.stopCall()
        .then(() => {
          window.log(
            "✅ [iOS] CallKit notified unanswered incoming call terminated",
          );
        })
        .catch(() => {});
    }

    window.incomingSession = null;
  });

  session.on("failed", () => {
    if (window.incomingCallTimeout) {
      clearTimeout(window.incomingCallTimeout);
      window.incomingCallTimeout = null;
    }
    window.hideIncomingCallUI();
    dismissIncomingCallNotification();
    window.log("Incoming call failed");

    // Notify CallKit that unanswered incoming call failed
    const isIOS = window.Capacitor?.getPlatform() === "ios";
    if (isIOS && window.Capacitor?.Plugins?.CallService) {
      window.Capacitor.Plugins.CallService.stopCall()
        .then(() => {
          window.log(
            "✅ [iOS] CallKit notified unanswered incoming call failed",
          );
        })
        .catch(() => {});
    }

    window.incomingSession = null;
  });

  session.on("rejected", () => {
    if (window.incomingCallTimeout) {
      clearTimeout(window.incomingCallTimeout);
      window.incomingCallTimeout = null;
    }
    window.hideIncomingCallUI();
    dismissIncomingCallNotification();
    window.log("Incoming call was rejected");

    // Notify CallKit that unanswered incoming call was rejected by remote
    const isIOS = window.Capacitor?.getPlatform() === "ios";
    if (isIOS && window.Capacitor?.Plugins?.CallService) {
      window.Capacitor.Plugins.CallService.stopCall()
        .then(() => {
          window.log(
            "✅ [iOS] CallKit notified unanswered incoming call rejected",
          );
        })
        .catch(() => {});
    }

    window.incomingSession = null;
  });

  // Mark as answered when accepted
  session.on("accepted", () => {
    wasAnswered = true;
  });
};

window.answerCall = async function () {
  if (!window.incomingSession) {
    window.log("No incoming call to answer");
    return;
  }

  const isIOS = window.Capacitor?.getPlatform() === "ios";

  if (isIOS && window.__answeringInProgress) {
    window.log("⚠️ Answer already in progress, ignoring duplicate");
    return;
  }

  if (isIOS) {
    window.__answeringInProgress = true;
  }

  if (window.incomingCallTimeout) {
    clearTimeout(window.incomingCallTimeout);
    window.incomingCallTimeout = null;
  }

  window.stopRinging();

  if (isIOS) {
    const calledFromCallKit =
      window.callKitAudioSessionActive || window.__callKitAnswered;

    window.log(
      `📱 Answering call - Called from CallKit: ${calledFromCallKit}, Audio session active: ${window.callKitAudioSessionActive}`,
    );

    if (!calledFromCallKit) {
      // User pressed RTC button, need to notify CallKit
      window.log("📱 RTC button pressed - notifying CallKit...");
      try {
        if (window.Capacitor?.Plugins?.CallService) {
          // Set flag to prevent loop when CallKit delegate calls answerCall() again
          window.__callKitAnswered = true;

          await window.Capacitor.Plugins.CallService.reportCallConnected({
            isOutgoing: false,
          });
          window.log("✅ CallKit notified of answer");
          // Give CallKit a moment to activate audio session
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (err) {
        window.log("⚠️ Failed to notify CallKit: " + err.message);
      }
    }

    // Wait for audio session to be ready (with shorter timeout)
    let audioReady = window.callKitAudioSessionActive;
    const maxWait = 2000;
    const startTime = Date.now();

    if (!audioReady) {
      window.log("⏳ Waiting for CallKit audio session...");
      while (!audioReady && Date.now() - startTime < maxWait) {
        if (window.callKitAudioSessionActive) {
          audioReady = true;
          window.log("✅ CallKit audio session ready");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!audioReady) {
        window.log("⚠️ Timeout waiting for CallKit audio - proceeding anyway");
      }
    }
  } else {
    // Android - report call connected to stop notification ringtone
    reportCallConnected().catch((err) => {
      console.error("Error reporting call connected:", err);
    });
  }

  window.currentSession = incomingSession;
  window.incomingSession = null;
  window.__callDirection = "incoming";
  window.__answeredIncoming = true;
  window.activeCall = true;

  window.hideIncomingCallUI();
  window.setupSessionHandlers(window.currentSession);

  currentSession.accept();
  window.showCallControls();
  window.log("Call answered");
  window.log("SIP/2.0 200 OK");

  // Reset answering flag immediately after session is established
  if (isIOS) {
    window.__answeringInProgress = false;
  }
};

window.declineCall = async function () {
  if (!window.incomingSession) {
    window.log("No incoming call to decline");
    return;
  }

  const isIOS = window.Capacitor?.getPlatform() === "ios";

  window.log(
    `📱 Declining call - Triggered from CallKit: ${window.__decliningFromCallKit || false}`,
  );

  if (window.incomingCallTimeout) {
    clearTimeout(window.incomingCallTimeout);
    window.incomingCallTimeout = null;
  }

  window.stopRinging();

  // Mark as declined by user before rejecting
  incomingSession.__declinedByUser = true;

  // Record as declined
  const num =
    __incomingRaw && window.__incomingRaw !== "Unknown"
      ? __incomingRaw
      : __incomingDisplay ||
        document.getElementById("incomingCallerNumber").textContent ||
        "Unknown";
  window.Storage.addCallToHistory("declined", num, "00:00");

  // Send SIP rejection
  incomingSession.reject({
    statusCode: 486,
    reasonPhrase: "Busy Here",
  });

  window.log("Call declined");
  window.log("SIP/2.0 486 Busy Here");

  // Notify CallKit if not already done
  if (isIOS && !window.__decliningFromCallKit) {
    window.log("📱 RTC button pressed - notifying CallKit to end call...");
    try {
      if (window.Capacitor?.Plugins?.CallService) {
        await window.Capacitor.Plugins.CallService.stopCall();
        window.log("✅ CallKit notified of decline");
      }
    } catch (err) {
      window.log("⚠️ Failed to notify CallKit: " + err.message);
    }
  }

  window.hideIncomingCallUI();
  window.incomingSession = null;

  // Reset audio flags
  if (isIOS) {
    window.audioStarted = false;
    window.callKitAudioSessionActive = false;
    window.pendingAudioStart = false;
    window.__answeringInProgress = false;
    window.__callKitAnswered = false;
  }
};

window.setupSessionHandlers = function (session) {
  if (!session || typeof session.on !== "function") {
    window.log("Session does not support event listeners");
    return;
  }

  // Manage ringing state for this session
  let ringingStarted = false;

  session.on("progress", (response) => {
    if (response && response.status_code && response.reason_phrase) {
      window.log(`SIP/2.0 ${response.status_code} ${response.reason_phrase}`);
      if (
        !ringingStarted &&
        (response.status_code === 180 || response.status_code === 183)
      ) {
        window.startRinging();
        ringingStarted = true;

        // Report to native platform that remote is ringing (for outgoing calls)
        const isIOS = window.Capacitor?.getPlatform() === "ios";
        const isAndroid = window.Capacitor?.getPlatform() === "android";

        if (
          window.Capacitor?.Plugins?.CallService &&
          window.__callDirection === "outgoing"
        ) {
          if (isIOS) {
            window.Capacitor.Plugins.CallService.reportOutgoingCallStartedConnecting()
              .then(() => {
                window.log(
                  "✅ [iOS] CallKit notified call started connecting (ringing)",
                );
              })
              .catch((err) => {
                window.log(
                  "⚠️ [iOS] Failed to notify CallKit ringing: " + err.message,
                );
              });
          } else if (isAndroid) {
            window.Capacitor.Plugins.CallService.updateCallState({
              state: "ringing",
            })
              .then(() => {
                window.log("✅ [Android] Notification updated: Ringing");
              })
              .catch((err) => {
                window.log(
                  "⚠️ [Android] Failed to update notification: " + err.message,
                );
              });
          }
        }
      }
      if (response.status_code === 183) {
        const remoteAudio = document.getElementById("remoteAudio");
        if (remoteAudio) {
          remoteAudio.volume = 0;
          window.log("Early media muted during ringing");
        }
      }
    }
  });

  session.on("terminated", (message, cause) => {
    if (ringingStarted) {
      window.stopRinging();
      ringingStarted = false;
    }
    window.log("Call ended" + (cause ? ": " + cause : ""));
    endCall();
  });

  session.on("failed", (response, cause) => {
    if (response && response.status_code && response.reason_phrase) {
      window.log(`SIP/2.0 ${response.status_code} ${response.reason_phrase}`);
    }

    if (cause && cause.includes("SESSION_DESCRIPTION_HANDLER_ERROR")) {
      window.log("⚠️ Media negotiation failed - incompatible media format");
      alert(
        "Call failed: Media format incompatibility.\nContact VoiceTel support for WebRTC configuration.",
      );
    } else {
      window.log("Call failed: " + (cause || "Unknown error"));
    }
    if (ringingStarted) {
      window.stopRinging();
      ringingStarted = false;
    }
    endCall();
  });

  session.on("rejected", (response, cause) => {
    if (response && response.status_code && response.reason_phrase) {
      window.log(`SIP/2.0 ${response.status_code} ${response.reason_phrase}`);
    }
    window.log("Call rejected" + (cause ? ": " + cause : ""));
    if (ringingStarted) {
      window.stopRinging();
      ringingStarted = false;
    }
    endCall();
  });

  session.on("bye", (request) => {
    window.log("SIP BYE received");
    window.log("Call ended by remote");
    if (ringingStarted) {
      window.stopRinging();
      ringingStarted = false;
    }
    endCall();
  });

  // Monitor ICE connection state as backup detection for remote hangup
  // This catches cases where SIP BYE doesn't fire properly (especially with iosrtc)
  if (
    session.sessionDescriptionHandler &&
    session.sessionDescriptionHandler.peerConnection
  ) {
    const pc = session.sessionDescriptionHandler.peerConnection;
    let connectionWasEstablished = false;

    const handleConnectionStateChange = () => {
      const state = pc.iceConnectionState;
      window.log(`ICE connection state: ${state}`);

      if (state === "connected" || state === "completed") {
        connectionWasEstablished = true;
      }

      // If connection was established and then goes to disconnected/failed/closed,
      // and we still have an active call, treat this as remote hangup
      if (
        connectionWasEstablished &&
        (state === "disconnected" || state === "failed" || state === "closed")
      ) {
        if (window.activeCall && window.currentSession === session) {
          window.log(
            "⚠️ ICE connection lost - call ended by remote (detected via ICE state)",
          );
          // Remove this listener to prevent duplicate calls
          pc.removeEventListener(
            "iceconnectionstatechange",
            handleConnectionStateChange,
          );
          // Give SIP BYE handler a moment to fire first
          setTimeout(() => {
            // Only call endCall if we're still in active call (SIP BYE might have already handled it)
            if (window.activeCall && window.currentSession === session) {
              window.log("🔴 Ending call due to ICE disconnection");
              if (ringingStarted) {
                window.stopRinging();
                ringingStarted = false;
              }
              endCall();
            }
          }, 500);
        }
      }
    };

    pc.addEventListener(
      "iceconnectionstatechange",
      handleConnectionStateChange,
    );

    // Clean up listener when session ends
    session.on("terminated", () => {
      pc.removeEventListener(
        "iceconnectionstatechange",
        handleConnectionStateChange,
      );
    });
  }

  session.on("accepted", (response) => {
    if (response && response.status_code && response.reason_phrase) {
      window.log(`SIP/2.0 ${response.status_code} ${response.reason_phrase}`);
    }

    if (ringingStarted) {
      window.stopRinging();
      ringingStarted = false;
    }
    window.activeCall = true;
    window.log("Call connected");

    // Report to native platform that call is now connected
    const isIOS = window.Capacitor?.getPlatform() === "ios";
    const isAndroid = window.Capacitor?.getPlatform() === "android";

    if (window.Capacitor?.Plugins?.CallService) {
      if (isIOS) {
        // For outgoing calls: Always report connected
        // For incoming calls: Only if NOT answered from CallKit (to avoid error 4)
        const shouldReport =
          window.__callDirection === "outgoing" ||
          (window.__callDirection === "incoming" && !window.__callKitAnswered);

        if (shouldReport) {
          const isOutgoing = window.__callDirection === "outgoing";
          window.Capacitor.Plugins.CallService.reportCallConnected({
            isOutgoing: isOutgoing,
          })
            .then(() => {
              window.log(
                `✅ [iOS] CallKit notified ${isOutgoing ? "outgoing" : "incoming"} call is connected`,
              );
            })
            .catch((err) => {
              window.log("⚠️ [iOS] Failed to notify CallKit: " + err.message);
            });
        }
      } else if (isAndroid) {
        window.Capacitor.Plugins.CallService.updateCallState({
          state: "connected",
        })
          .then(() => {
            window.log("✅ [Android] Notification updated: Connected");
          })
          .catch((err) => {
            window.log(
              "⚠️ [Android] Failed to update notification: " + err.message,
            );
          });
      }
    }

    // Try to start audio now that call is active
    window.tryStartWebRTCAudio();

    // Handle Bluetooth audio routing
    handleBluetoothAudio();

    // Configure audio session for lock screen continuity
    configureAudioSession();

    // Auto-start recording if enabled (only when call is answered/connected)
    const recordingEnabled =
      document.getElementById("enableCallRecording")?.checked || false;
    if (recordingEnabled && window.activeCall && session === currentSession) {
      // Wait for audio tracks to be fully ready after call is answered
      const recordingDelay = 500;
      window.log(
        `⏳ Recording will auto-start in ${recordingDelay}ms after call connected`,
      );
      setTimeout(async () => {
        // Double-check call is still active before starting recording
        if (
          window.activeCall &&
          window.currentSession &&
          window.currentSession === session
        ) {
          await window.startRecording();
        }
      }, recordingDelay);
    }

    if (
      window.currentSession &&
      currentSession.sessionDescriptionHandler &&
      currentSession.sessionDescriptionHandler.peerConnection
    ) {
      const pc = currentSession.sessionDescriptionHandler.peerConnection;
      const remoteDesc = pc.remoteDescription;
      if (remoteDesc && remoteDesc.sdp) {
        if (remoteDesc.sdp.includes("telephone-event")) {
          window.log("Remote supports RFC 2833 telephone-event");
        } else {
          window.log(
            "⚠️ Remote does NOT support telephone-event - will use SIP INFO for DTMF",
          );
        }
      }
    }

    document.getElementById("callNumber").value = "";
    document.getElementById("callNumber").placeholder =
      "Type or press dialpad for DTMF";
    document.getElementById("callNumber").focus();
    startCallTimer();
    document.getElementById("callStatus").textContent = "Call in progress";

    if (isIOS && !callKitAudioSessionActive) {
      window.pendingAudioStart = true;
    } else {
      try {
        const pc = session.sessionDescriptionHandler.peerConnection;
        const remoteStream = new MediaStream();
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            remoteStream.addTrack(receiver.track);
          }
        });

        const remoteAudio = document.getElementById("remoteAudio");
        remoteAudio.srcObject = remoteStream;
        remoteAudio.volume = 1.0;
        remoteAudio.muted = false;
        remoteAudio.play().catch((err) => {
          window.log("Error playing remote audio: " + err.message);
        });
      } catch (e) {
        window.log("Error setting up audio: " + e.message);
      }
    }
  });

  session.on("trackAdded", () => {
    const isIOS = window.Capacitor?.getPlatform() === "ios";

    // Early media muting while ringing (desktop parity)
    if (ringingStarted) {
      try {
        const pc = session.sessionDescriptionHandler.peerConnection;
        const remoteStream = new MediaStream();
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            remoteStream.addTrack(receiver.track);
          }
        });

        const remoteAudio = document.getElementById("remoteAudio");
        remoteAudio.srcObject = remoteStream;
        remoteAudio.volume = 0;
        window.log("Early media audio track muted");
      } catch (e) {
        window.log("Error handling early media track: " + e.message);
      }
    } else if (window.activeCall) {
      // Call is active - ensure audio is playing
      if (isIOS && !callKitAudioSessionActive) {
        window.log(
          "⏳ [CallKit] Waiting for audio session activation in trackAdded...",
        );
        window.pendingAudioStart = true;
      } else {
        try {
          const pc = session.sessionDescriptionHandler.peerConnection;
          const remoteStream = new MediaStream();
          pc.getReceivers().forEach((receiver) => {
            if (receiver.track) {
              remoteStream.addTrack(receiver.track);
            }
          });

          const remoteAudio = document.getElementById("remoteAudio");
          remoteAudio.srcObject = remoteStream;
          remoteAudio.volume = 1.0;
          remoteAudio.muted = false;
          remoteAudio.play().catch((err) => {
            window.log(
              "Error playing remote audio in trackAdded: " + err.message,
            );
          });
        } catch (e) {
          window.log("Error handling track: " + e.message);
        }
      }
    }
  });
};
