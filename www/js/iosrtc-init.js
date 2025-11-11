// ========================================
// IOSRTC INITIALIZATION MODULE
// ========================================
// Initializes cordova-plugin-iosrtc for iOS devices
// This replaces the WebView WebRTC with native iOS WebRTC for CallKit integration

(function () {
  "use strict";

  window.IOSRTC_ACTIVE = false;

  function initializeIOSRTC() {
    if (
      !window.cordova ||
      !window.cordova.plugins ||
      !window.cordova.plugins.iosrtc
    ) {
      return;
    }

    try {
      const iosrtc = window.cordova.plugins.iosrtc;

      if (iosrtc.useManualAudio !== undefined) {
        iosrtc.useManualAudio = true;
      }

      if (iosrtc.isAudioEnabled !== undefined) {
        iosrtc.isAudioEnabled = false;
      }

      iosrtc.registerGlobals();

      window.iosrtc = iosrtc;
      window.IOSRTC_ACTIVE = true;
    } catch (error) {
      window.IOSRTC_ACTIVE = false;
    }
  }

  // Wait for deviceready event
  document.addEventListener("deviceready", initializeIOSRTC, false);
})();
