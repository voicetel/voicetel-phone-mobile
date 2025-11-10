// ========================================
// NATIVE INTEGRATION MODULE
// ========================================

window.startCallService = async function (callNumber) {
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.CallService
    ) {
      const CallService = window.Capacitor.Plugins.CallService;
      await CallService.startCall({
        callNumber: callNumber || "",
      });
      window.log("Android call service started");
    }
  } catch (error) {
    window.log("Failed to start call service: " + error.message);
    console.error("CallService error:", error);
  }
};

window.stopCallService = async function () {
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.CallService
    ) {
      const CallService = window.Capacitor.Plugins.CallService;
      await CallService.stopCall();
      window.log("Android call service stopped");
    }
  } catch (error) {
    window.log("Failed to stop call service: " + error.message);
    console.error("CallService error:", error);
  }
};

window.updateCallServiceNumber = async function (callNumber) {
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.CallService
    ) {
      const CallService = window.Capacitor.Plugins.CallService;
      await CallService.updateCallNumber({
        callNumber: callNumber || "",
      });
      window.log("Android call service number updated");
    }
  } catch (error) {
    window.log("Failed to update call service number: " + error.message);
  }
};

window.showIncomingCallNotification = async function (
  callerName,
  callerNumber,
) {
  window.log(
    `[CallKit] showIncomingCallNotification called: name=${callerName}, number=${callerNumber}`,
  );
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins
    ) {
      window.log(`[CallKit] Checking for plugins...`);
      window.log(
        `[CallKit] CallService exists: ${!!window.Capacitor.Plugins.CallService}`,
      );
      window.log(
        `[CallKit] CallService exists: ${!!window.Capacitor.Plugins.CallService}`,
      );

      // Use CallService on all platforms
      const CallService = window.Capacitor.Plugins.CallService;

      if (CallService) {
        window.log(
          `[CallKit] Plugin found, calling showIncomingCallNotification...`,
        );
        await CallService.showIncomingCallNotification({
          callerName: callerName || "Unknown",
          callerNumber: callerNumber || "",
        });
        window.log("✅ [CallKit] Incoming call notification displayed");
      } else {
        window.log("⚠️ [CallKit] No CallService plugin available");
      }
    } else {
      window.log("⚠️ [CallKit] Not native platform or Capacitor not available");
    }
  } catch (error) {
    window.log("Failed to show incoming call notification: " + error.message);
    console.error("Notification error:", error);
  }
};

window.dismissIncomingCallNotification = async function () {
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins
    ) {
      // Use CallService on all platforms
      const CallService = window.Capacitor.Plugins.CallService;
      if (CallService) {
        await CallService.dismissIncomingCallNotification();
        window.log("Incoming call notification dismissed");
      }
    }
  } catch (error) {
    window.log(
      "Failed to dismiss incoming call notification: " + error.message,
    );
    console.error("Notification error:", error);
  }
};

window.reportCallConnected = async function () {
  try {
    if (
      window.Capacitor &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins
    ) {
      // Use CallService on all platforms
      const CallService = window.Capacitor.Plugins.CallService;
      if (CallService) {
        // iOS: reportCallConnected stops CallKit ringtone
        // Android: dismissIncomingCallNotification stops notification vibration
        const platform = window.getPlatform();
        if (platform === "ios" && CallService.reportCallConnected) {
          // iOS - report call as connected to stop CallKit ringtone
          await CallService.reportCallConnected();
          window.log("Call reported as connected to CallKit");
        } else {
          // Android - dismiss notification to stop vibration/ringing
          await CallService.dismissIncomingCallNotification();
          window.log("Incoming call notification dismissed (Android)");
        }
      }
    }
  } catch (error) {
    window.log("Failed to report call connected: " + error.message);
    console.error("Notification error:", error);
  }
};

window.setupAppStateListeners = function () {
  window.log("Setting up app state listeners...");

  // Always set up visibility change listener as primary method
  document.addEventListener("visibilitychange", async function () {
    window.log(
      "Visibility change detected - document.hidden: " + document.hidden,
    );
    if (!document.hidden) {
      window.log(
        "App brought to foreground (visibility) - WebSocket may have been killed, checking if re-registration needed...",
      );
      await window.reRegister(); // AWAIT the async function to ensure service check completes
    } else {
      window.log(
        "App moved to background (visibility) - WebSocket will likely be killed",
      );
    }
  });

  window.log("Visibility change listener added");

  // Try to set up Capacitor listeners if available (only once)
  setTimeout(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      window.log("Capacitor detected - setting up native app state listeners");

      // Try to access Capacitor App API
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const App = window.Capacitor.Plugins.App;

        // Listen for app state changes (only one listener)
        App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            window.log(
              "App brought to foreground (Capacitor) - checking registration",
            );
            await window.reRegister(); // AWAIT the async function to ensure service check completes
          } else {
            window.log("App moved to background (Capacitor)");
          }
        });

        window.log("Capacitor app state listeners configured");
      } else {
        window.log("Capacitor App plugin not available");
      }
    } else {
      window.log("Not running on native platform - using visibility API only");
    }
  }, 2000);
};

/**
 * Handle notification actions (Answer/Decline from notification)
 * Called by native platform when user taps notification action buttons
 */
window.handleNotificationAction = function (action, data) {
  window.log("Notification action received: " + action);

  if (action === "ANSWER_CALL") {
    window.log("✅ [CallKit] Answer button pressed in CallKit");
    window.__callKitAnswered = true; // Flag to prevent duplicate notifications
    if (window.incomingSession) {
      window.answerCall();
    } else {
      window.log("No incoming call to answer");
    }
  } else if (action === "DECLINE_CALL") {
    if (window.incomingSession) {
      window.declineCall();
    } else {
      window.log("No incoming call to decline");
    }
  } else if (action === "HANGUP") {
    if (window.currentSession) {
      window.hangup();
    } else {
      window.log("No active call to hang up");
    }
  } else if (action === "AUDIO_SESSION_ACTIVATED") {
    window.log("✅ [CallKit] Audio session activated");
    window.callKitAudioSessionActive = true;

    // Try to start audio now that session is active
    window.tryStartWebRTCAudio();

    // If audio didn't start yet (session not ready), retry after a short delay
    if (!window.audioStarted && window.currentSession && window.activeCall) {
      window.log("🔄 [CallKit] Retrying audio start in 200ms...");
      setTimeout(() => {
        if (
          !window.audioStarted &&
          window.currentSession &&
          window.activeCall
        ) {
          window.log("🔄 [CallKit] Second attempt to start audio...");
          window.tryStartWebRTCAudio();
        }
      }, 200);

      // Final retry after 500ms if still not started
      setTimeout(() => {
        if (
          !window.audioStarted &&
          window.currentSession &&
          window.activeCall
        ) {
          window.log("🔄 [CallKit] Final attempt to start audio...");
          window.tryStartWebRTCAudio();

          // If still not working, try to manually setup audio
          if (!window.audioStarted) {
            window.log("⚠️ [CallKit] Forcing audio setup...");
            try {
              const pc =
                window.currentSession.sessionDescriptionHandler.peerConnection;
              if (pc) {
                const remoteStream = new MediaStream();
                pc.getReceivers().forEach((receiver) => {
                  if (receiver.track) {
                    remoteStream.addTrack(receiver.track);
                  }
                });

                const remoteAudio = document.getElementById("remoteAudio");
                if (remoteAudio) {
                  remoteAudio.srcObject = remoteStream;
                  remoteAudio.volume = 1.0;
                  remoteAudio.muted = false;
                  remoteAudio
                    .play()
                    .then(() => {
                      window.log("✅ [CallKit] Forced audio setup successful");
                      window.audioStarted = true;
                    })
                    .catch((err) => {
                      window.log(
                        "❌ [CallKit] Forced audio play failed: " + err.message,
                      );
                    });
                }
              }
            } catch (e) {
              window.log(
                "❌ [CallKit] Error forcing audio setup: " + e.message,
              );
            }
          }
        }
      }, 500);
    }
  } else if (action === "AUDIO_SESSION_DEACTIVATED") {
    window.log("ℹ️ [CallKit] Audio session deactivated");
    window.callKitAudioSessionActive = false;
  } else if (action === "MUTE_CALL") {
    window.log("🔇 [CallKit] Mute button pressed in CallKit");
    // Update in-app mute state to match CallKit
    if (!window.isMuted) {
      window.toggleMute();
    }
  } else if (action === "UNMUTE_CALL") {
    window.log("🔊 [CallKit] Unmute button pressed in CallKit");
    // Update in-app mute state to match CallKit
    if (window.isMuted) {
      window.toggleMute();
    }
  }
};
