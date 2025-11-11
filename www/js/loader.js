// ========================================
// MODULE LOADER
// ========================================
// Dynamically loads all JavaScript modules in the correct dependency order

(function () {
  "use strict";

  // Define modules in dependency order
  const modules = [
    "js/iosrtc-init.js",
    "js/config.js",
    "js/helpers.js",
    "js/storage.js",
    "js/globals.js",
    "js/ui-manager.js",
    "js/audio.js",
    "js/native-integration.js",
    "js/recording.js",
    "js/call-controls.js",
    "js/contacts.js",
    "js/history.js",
    "js/sip-manager.js",
    "js/call-handler.js",
    "js/event-handlers.js",
    "js/app.js",
  ];

  let loadedCount = 0;

  /**
   * Load a script dynamically
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false; // Maintain order
      script.onload = () => {
        loadedCount++;
        resolve();
      };
      script.onerror = () => {
        console.error(`Failed to load: ${src}`);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load all modules sequentially
   */
  async function loadModules() {
    try {
      // Load modules sequentially to maintain dependency order
      for (const module of modules) {
        await loadScript(module);
      }

      // Verify critical components loaded
      if (typeof window.log !== "function") {
        console.error("window.log is not a function!");
      }

      if (!window.Storage) {
        console.error("window.Storage is undefined!");
      }
    } catch (error) {
      console.error("Module loading failed:", error);
      alert("Failed to load application modules. Please refresh the page.");
    }
  }

  // Start loading when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadModules);
  } else {
    // DOM already loaded
    loadModules();
  }
})();
