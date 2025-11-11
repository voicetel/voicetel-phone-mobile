// ========================================
// IOSRTC INITIALIZATION MODULE
// ========================================
// Initializes cordova-plugin-iosrtc for iOS devices
// This replaces the WebView WebRTC with native iOS WebRTC for CallKit integration

(function () {
  "use strict";

  console.log("🔧 iosrtc-init.js loading...");

  // Set a flag to indicate iosrtc is being initialized
  window.IOSRTC_ACTIVE = false;

  // Initialize iosrtc when deviceready fires
  function initializeIOSRTC() {
    // Check if we have the plugin
    if (
      !window.cordova ||
      !window.cordova.plugins ||
      !window.cordova.plugins.iosrtc
    ) {
      console.log(
        "ℹ️ cordova-plugin-iosrtc not available (not iOS or plugin not installed)",
      );
      return;
    }

    console.log("🚀 Initializing cordova-plugin-iosrtc...");

    try {
      const iosrtc = window.cordova.plugins.iosrtc;

      // CRITICAL: Configure for CallKit integration
      // This must be done BEFORE registerGlobals()
      console.log("🔧 Configuring iosrtc for CallKit...");

      // Enable manual audio device initialization for CallKit
      // This prevents iosrtc from managing the audio session automatically
      if (iosrtc.useManualAudio !== undefined) {
        iosrtc.useManualAudio = true;
        console.log("✅ Manual audio mode enabled");
      }

      // Initially disable audio until CallKit activates the session
      if (iosrtc.isAudioEnabled !== undefined) {
        iosrtc.isAudioEnabled = false;
        console.log("✅ Audio initially disabled (will enable when CallKit activates)");
      }

      // Register iosrtc globals - this replaces window.RTCPeerConnection, etc.
      iosrtc.registerGlobals();
      console.log("✅ iosrtc globals registered (WebRTC APIs replaced with native)");

      // Enable debug logging (optional - comment out for production)
      if (iosrtc.debug && iosrtc.debug.enable) {
        iosrtc.debug.enable("iosrtc*");
        console.log("✅ iosrtc debug enabled");
      }

      // Store reference to iosrtc for later use
      window.iosrtc = iosrtc;

      // Set flag
      window.IOSRTC_ACTIVE = true;

      console.log("✅ iosrtc initialized successfully for CallKit integration");
      console.log("   - Manual audio mode: ENABLED");
      console.log("   - Audio initially: DISABLED");
      console.log("   - Will enable audio when CallKit activates session");
    } catch (error) {
      console.error("❌ Failed to initialize iosrtc:", error);
      window.IOSRTC_ACTIVE = false;
    }
  }

  // Wait for deviceready event
  document.addEventListener("deviceready", initializeIOSRTC, false);
})();
