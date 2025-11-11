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

    if (!calledFromCallKit) {
      try {
        if (window.Capacitor?.Plugins?.CallService) {
          await window.Capacitor.Plugins.CallService.reportCallConnected();
        }
      } catch (err) {
        // Failed to notify CallKit
      }
    }
    let audioReady = window.callKitAudioSessionActive;
    const maxWait = 3000;
    const startTime = Date.now();
    let checkCount = 0;

    while (!audioReady && Date.now() - startTime < maxWait) {
      checkCount++;
      if (window.callKitAudioSessionActive) {
        audioReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
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
  if (isIOS) {
    setTimeout(() => {
      window.__answeringInProgress = false;
    }, 1000);
  }
};

window.declineCall = async function () {
  if (!window.incomingSession) {
    window.log("No incoming call to decline");
    return;
  }

  if (window.incomingCallTimeout) {
    clearTimeout(window.incomingCallTimeout);
    window.incomingCallTimeout = null;
  }

  window.stopRinging();

  const isIOS = window.Capacitor?.getPlatform() === "ios";
  if (isIOS) {
    await dismissIncomingCallNotification();
  }

  // Record as declined (this is correct for a manual press)
  const num =
    __incomingRaw && window.__incomingRaw !== "Unknown"
      ? __incomingRaw
      : __incomingDisplay ||
        document.getElementById("incomingCallerNumber").textContent ||
        "Unknown";
  window.Storage.addCallToHistory("declined", num, "00:00");

  incomingSession.__declinedByUser = true;

  incomingSession.reject({
    statusCode: 486,
    reasonPhrase: "Busy Here",
  });

  window.hideIncomingCallUI();
  window.log("Call declined");
  window.log("SIP/2.0 486 Busy Here");
  window.incomingSession = null;

  // Reset audio flags
  window.audioStarted = false;
  window.callKitAudioSessionActive = false;
  window.pendingAudioStart = false;
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
      // Wait a bit for audio tracks to be fully ready after call is answered
      setTimeout(async () => {
        // Double-check call is still active before starting recording
        if (
          window.activeCall &&
          window.currentSession &&
          window.currentSession === session
        ) {
          await window.startRecording();
        }
      }, 500); // Small delay to ensure audio tracks are ready
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

    const isIOS = window.Capacitor?.getPlatform() === "ios";
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
