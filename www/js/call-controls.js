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

  // iOS only: End CallKit call if active (but only if not triggered FROM CallKit)
  if (
    isIOS &&
    window.Capacitor?.Plugins?.CallService &&
    !window.__hangupFromCallKit
  ) {
    window.log("📱 [iOS] Ending CallKit call...");
    window.Capacitor.Plugins.CallService.stopCall()
      .then(() => {
        window.log("✅ [iOS] CallKit call ended successfully");
      })
      .catch((err) => {
        window.log("❌ [iOS] Error ending CallKit call: " + err.message);
        console.error("Error ending CallKit call:", err);
      });
  }

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

  // iOS only: Update CallKit mute state (but only if not already updating from CallKit)
  const isIOS = window.Capacitor?.getPlatform() === "ios";
  if (
    isIOS &&
    window.Capacitor?.Plugins?.CallService &&
    !window.__updatingMuteFromCallKit
  ) {
    window.Capacitor.Plugins.CallService.setCallMuted({ muted: window.isMuted })
      .then(() => {
        window.log(`✅ [iOS] CallKit mute state updated: ${window.isMuted}`);
      })
      .catch((err) => {
        window.log(
          `⚠️ [iOS] Failed to update CallKit mute state: ${err.message}`,
        );
      });
  }
};

window.toggleHold = function () {
  if (!window.currentSession || !currentSession.sessionDescriptionHandler)
    return;

  const pc = currentSession.sessionDescriptionHandler.peerConnection;

  // Toggle the hold state first
  window.isOnHold = !isOnHold;

  // Get all senders (audio and video)
  const senders = pc.getSenders();

  senders.forEach((sender) => {
    if (sender.track) {
      // When on hold, disable the track; when resuming, enable it
      sender.track.enabled = !window.isOnHold;
    }
  });

  // Update UI
  const holdBtn = document.getElementById("holdBtn");
  if (holdBtn) {
    holdBtn.textContent = window.isOnHold ? "Resume" : "Hold";
  }
  window.log(window.isOnHold ? "Call on hold" : "Call resumed");

  // iOS only: Update CallKit hold state (but only if not already updating from CallKit)
  const isIOS = window.Capacitor?.getPlatform() === "ios";
  if (
    isIOS &&
    window.Capacitor?.Plugins?.CallService &&
    !window.__updatingHoldFromCallKit
  ) {
    window.Capacitor.Plugins.CallService.setCallHeld({
      onHold: window.isOnHold,
    })
      .then(() => {
        window.log(`✅ [iOS] CallKit hold state updated: ${window.isOnHold}`);
      })
      .catch((err) => {
        window.log(
          `⚠️ [iOS] Failed to update CallKit hold state: ${err.message}`,
        );
      });
  }
};

window.endCall = async function () {
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
