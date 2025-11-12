// ========================================
// CALL CONTROLS MODULE
// ========================================

window.hangup = function () {
  window.log("🔴 Hangup function called");
  window.log(`   currentSession exists: ${!!window.currentSession}`);

  const isIOS = window.Capacitor?.getPlatform() === "ios";

  if (window.currentSession) {
    if (currentSession.hasAnswer) {
      currentSession.bye();
      window.log("SIP BYE sent");
    } else {
      currentSession.cancel();
      window.log("SIP CANCEL sent");
    }
    window.log("Hanging up...");
  } else {
    window.log("⚠️ No currentSession to hang up");
  }

  // iOS only: CallKit cleanup is handled by endCall() to ensure recording stops first
  // Don't call stopCall() here to avoid race condition with recording

  // Reset audio started flag for next call
  window.audioStarted = false;

  // iOS only: Reset CallKit-specific flags
  if (isIOS) {
    window.callKitAudioSessionActive = false;
    window.pendingAudioStart = false;
    window.__answeringInProgress = false;
    window.__callKitAnswered = false;
  }

  window.log("🔴 Hangup function completed");
};

window.toggleMute = function () {
  if (!window.currentSession || !currentSession.sessionDescriptionHandler)
    return;

  const pc = currentSession.sessionDescriptionHandler.peerConnection;
  const senders = pc.getSenders();

  // Toggle the mute state first
  window.isMuted = !isMuted;

  // Now set track enabled to the opposite of isMuted (enabled when NOT muted)
  senders.forEach((sender) => {
    if (sender.track && sender.track.kind === "audio") {
      sender.track.enabled = !window.isMuted;
    }
  });

  document.getElementById("muteBtn").textContent = isMuted ? "Unmute" : "Mute";
  window.log(window.isMuted ? "Muted" : "Unmuted");

  // Update native platform mute state (but only if not already updating from native)
  const isIOS = window.Capacitor?.getPlatform() === "ios";
  const isAndroid = window.Capacitor?.getPlatform() === "android";

  if (
    window.Capacitor?.Plugins?.CallService &&
    !window.__updatingMuteFromCallKit
  ) {
    window.Capacitor.Plugins.CallService.setCallMuted({ muted: window.isMuted })
      .then(() => {
        window.log(
          `✅ [${isIOS ? "iOS" : "Android"}] Native mute state updated: ${window.isMuted}`,
        );
      })
      .catch((err) => {
        window.log(
          `⚠️ [${isIOS ? "iOS" : "Android"}] Failed to update native mute state: ${err.message}`,
        );
      });
  }
};

window.toggleHold = function () {
  if (!window.currentSession || !currentSession.sessionDescriptionHandler)
    return;

  // Toggle the hold state first
  window.isOnHold = !isOnHold;

  // Use SIP.js hold/unhold methods to send proper re-INVITE
  if (window.isOnHold) {
    window.log("📞 Placing call on hold (sending re-INVITE)...");
    currentSession
      .hold()
      .then(() => {
        window.log("✅ Call placed on hold successfully");
        // Update UI
        const holdBtn = document.getElementById("holdBtn");
        if (holdBtn) {
          holdBtn.textContent = "Resume";
        }

        // Update native platform hold state
        const isIOS = window.Capacitor?.getPlatform() === "ios";
        const isAndroid = window.Capacitor?.getPlatform() === "android";

        if (
          window.Capacitor?.Plugins?.CallService &&
          !window.__updatingHoldFromCallKit
        ) {
          window.Capacitor.Plugins.CallService.setCallHeld({
            onHold: true,
          })
            .then(() => {
              window.log(
                `✅ [${isIOS ? "iOS" : "Android"}] Native hold state updated: true`,
              );
            })
            .catch((err) => {
              window.log(
                `⚠️ [${isIOS ? "iOS" : "Android"}] Failed to update native hold state: ${err.message}`,
              );
            });
        }
      })
      .catch((error) => {
        window.log(`❌ Failed to place call on hold: ${error.message}`);
        console.error("Hold error:", error);
        // Revert state on failure
        window.isOnHold = false;
      });
  } else {
    window.log("📞 Resuming call (sending re-INVITE)...");
    currentSession
      .unhold()
      .then(() => {
        window.log("✅ Call resumed successfully");
        // Update UI
        const holdBtn = document.getElementById("holdBtn");
        if (holdBtn) {
          holdBtn.textContent = "Hold";
        }

        // Update native platform hold state
        const isIOS = window.Capacitor?.getPlatform() === "ios";
        const isAndroid = window.Capacitor?.getPlatform() === "android";

        if (
          window.Capacitor?.Plugins?.CallService &&
          !window.__updatingHoldFromCallKit
        ) {
          window.Capacitor.Plugins.CallService.setCallHeld({
            onHold: false,
          })
            .then(() => {
              window.log(
                `✅ [${isIOS ? "iOS" : "Android"}] Native hold state updated: false`,
              );
            })
            .catch((err) => {
              window.log(
                `⚠️ [${isIOS ? "iOS" : "Android"}] Failed to update native hold state: ${err.message}`,
              );
            });
        }
      })
      .catch((error) => {
        window.log(`❌ Failed to resume call: ${error.message}`);
        console.error("Unhold error:", error);
        // Revert state on failure
        window.isOnHold = true;
      });
  }
};

window.endCall = async function () {
  // Prevent multiple simultaneous calls (bye + terminated events can both trigger this)
  if (window.__endCallInProgress) {
    window.log("⚠️ endCall already in progress, skipping duplicate call");
    return;
  }
  window.__endCallInProgress = true;

  // Clean up resources
  window.cleanupWebSocketHandler();

  // Release wake lock when call ends
  releaseWakeLock();
  // Stop call timer
  stopCallTimer();

  // Stop Android foreground service
  stopCallService();

  // Stop recording if active and get filename (must be done before saving history)
  let recordingFilename = null;
  if (window.isRecording) {
    recordingFilename = await window.stopRecording();
  }

  // Save call to history (with recording filename if available)
  try {
    if (window.__callDirection === "outgoing") {
      const num = __originalCallNumber || "Unknown";
      window.Storage.addCallToHistory(
        "outgoing",
        num,
        "Connected",
        recordingFilename,
      );
    } else if (window.__callDirection === "incoming") {
      const num =
        __incomingRaw && window.__incomingRaw !== "Unknown"
          ? __incomingRaw
          : __incomingDisplay || "Unknown";
      window.Storage.addCallToHistory(
        "incoming",
        num,
        "Connected",
        recordingFilename,
      );
    }
  } catch (e) {
    console.error("Failed to save call history:", e);
  }

  window.currentSession = null;
  window.__callDirection = null;
  window.__answeredIncoming = false;
  window.activeCall = false;

  window.audioStarted = false;

  const isIOSEndCall = window.Capacitor?.getPlatform() === "ios";
  if (isIOSEndCall) {
    // End CallKit call if it's still active
    if (window.Capacitor?.Plugins?.CallService) {
      window.Capacitor.Plugins.CallService.stopCall()
        .then(() => {
          window.log("✅ [iOS] CallKit call ended from endCall()");
        })
        .catch((err) => {
          window.log("⚠️ [iOS] CallKit already ended or error: " + err.message);
        });
    }

    window.callKitAudioSessionActive = false;
    window.pendingAudioStart = false;
    window.__answeringInProgress = false;
    window.__callKitAnswered = false;

    if (window.localAudioTrack) {
      try {
        window.localAudioTrack.stop();
      } catch (e) {
        // Error stopping audio track
      }
      window.localAudioTrack = null;
    }
  }

  window.hideCallControls();
  window.isMuted = false;
  window.isOnHold = false;
  window.__updatingMuteFromCallKit = false;
  window.__updatingHoldFromCallKit = false;
  window.__decliningFromCallKit = false;
  window.__hangupFromCallKit = false;
  document.getElementById("muteBtn").textContent = "Mute";
  const holdBtn = document.getElementById("holdBtn");
  if (holdBtn) {
    holdBtn.textContent = "Hold";
  }

  // Reset the guard flag at the very end
  window.__endCallInProgress = false;
  document.getElementById("callStatus").textContent = "Call in progress";
  document.getElementById("callNumber").placeholder =
    "Enter number to dial / DTMF during call";

  // Hide the "Show Dialpad" button when call ends
  const showDialpadBtn = document.getElementById("showDialpadBtn");
  if (showDialpadBtn) {
    showDialpadBtn.style.display = "none";
  }

  // Handle Bluetooth audio disconnect
  handleBluetoothDisconnect();
};

window.startCallTimer = function () {
  window.callStartTime = Date.now();
  window.callTimer = setInterval(updateCallDuration, 1000);
};

window.stopCallTimer = function () {
  if (window.callTimer) {
    clearInterval(window.callTimer);
    window.callTimer = null;
  }
  document.getElementById("callDuration").textContent = "00:00";
};

window.updateCallDuration = function () {
  if (!window.callStartTime) return;
  const duration = Math.floor((Date.now() - callStartTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  document.getElementById("callDuration").textContent =
    `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

window.appendNumber = function (num) {
  const input = document.getElementById("callNumber");

  if (window.currentSession) {
    const isEstablished =
      currentSession.dialog ||
      (currentSession.sessionDescriptionHandler &&
        currentSession.sessionDescriptionHandler.peerConnection);

    if (isEstablished) {
      if (sendDTMF(num)) {
        input.value = input.value + num;
      }
      return;
    }
  }

  input.value = input.value + num;
};

window.clearNumber = function () {
  document.getElementById("callNumber").value = "";
};

window.sendDTMF = function (digit) {
  if (!window.currentSession && !__answeredIncoming) {
    window.log("No active session for DTMF");
    return false;
  }

  const isEstablished =
    currentSession.dialog ||
    (currentSession.sessionDescriptionHandler &&
      currentSession.sessionDescriptionHandler.peerConnection);

  if (!isEstablished) {
    window.log("Call not fully established for DTMF");
    return false;
  }

  try {
    const options = {
      duration: DTMF_DURATION_MS,
      interToneGap: DTMF_INTERTONE_GAP_MS,
    };

    currentSession.dtmf(digit, options);
    window.log(`DTMF sent: ${digit} (${DTMF_DURATION_MS}ms duration)`);

    return true;
  } catch (error) {
    window.log(`DTMF failed: ${error.message}`);
    console.error("DTMF error:", error);
    return false;
  }
};
