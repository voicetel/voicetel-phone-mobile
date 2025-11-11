// ========================================
// EVENT HANDLERS MODULE
// ========================================
// Attaches all event listeners to UI elements
// This replaces inline onclick handlers with proper event listeners

window.setupEventHandlers = function () {
  // Header navigation buttons
  const phoneBtn = document.querySelector('.header-toggle[title="Phone"]');
  const contactsBtn = document.querySelector(
    '.header-toggle[title="Contacts"]',
  );
  const historyBtn = document.querySelector(
    '.header-toggle[title="Call History"]',
  );
  const logBtn = document.querySelector('.header-toggle[title="Event Log"]');
  const settingsBtn = document.querySelector(
    '.header-toggle[title="Settings"]',
  );

  if (phoneBtn) {
    phoneBtn.addEventListener("click", () => {
      if (typeof window.showPhone === "function") {
        window.showPhone();
      } else {
        console.error("window.showPhone is not a function!");
      }
    });
  }
  if (contactsBtn) {
    contactsBtn.addEventListener("click", () => {
      if (typeof window.showContacts === "function") {
        window.showContacts();
      } else {
        console.error("window.showContacts is not a function!");
      }
    });
  }
  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      if (typeof window.showHistory === "function") {
        window.showHistory();
      } else {
        console.error("window.showHistory is not a function!");
      }
    });
  }
  if (logBtn) {
    logBtn.addEventListener("click", () => {
      if (typeof window.showLog === "function") {
        window.showLog();
      } else {
        console.error("window.showLog is not a function!");
      }
    });
  }
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (typeof window.showSettings === "function") {
        window.showSettings();
      } else {
        console.error("window.showSettings is not a function!");
      }
    });
  }

  // Settings - Register/Unregister buttons
  const registerBtn = document.getElementById("registerBtn");
  const unregisterBtn = document.getElementById("unregisterBtn");

  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      window.register();
    });
  }

  if (unregisterBtn) {
    unregisterBtn.addEventListener("click", () => {
      window.unregister();
    });
  }

  // Settings - Clear All Data button
  const buttons = document.querySelectorAll("button");
  buttons.forEach((btn) => {
    if (btn.textContent.includes("Clear All Saved Data")) {
      btn.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all saved data?")) {
          window.clearAllData();
        }
      });
    }
  });

  // Call controls
  const callBtn = document.getElementById("callBtn");
  const hangupBtn = document.getElementById("hangupBtn");
  const muteBtn = document.getElementById("muteBtn");
  const showDialpadBtn = document.getElementById("showDialpadBtn");

  if (callBtn) {
    callBtn.addEventListener("click", () => {
      window.makeCall();
    });
  }

  if (hangupBtn) {
    hangupBtn.addEventListener("click", () => {
      window.hangup();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      window.toggleMute();
    });
  }

  const holdBtn = document.getElementById("holdBtn");
  if (holdBtn) {
    holdBtn.addEventListener("click", () => {
      window.toggleHold();
    });
  }

  if (showDialpadBtn) {
    showDialpadBtn.addEventListener("click", () => {
      window.showDialpad();
    });
  }

  // Incoming call buttons
  const answerBtn = document.querySelector(".btn-answer");
  const declineBtn = document.querySelector(".btn-decline");

  if (answerBtn) {
    answerBtn.addEventListener("click", () => {
      window.log("📱 In-app ANSWER button pressed");
      if (typeof window.answerCall === "function") {
        window.answerCall();
      } else {
        console.error("window.answerCall is not a function!");
      }
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      window.log("📱 In-app DECLINE button pressed");
      if (typeof window.declineCall === "function") {
        window.declineCall();
      } else {
        console.error("window.declineCall is not a function!");
      }
    });
  }

  // Dialpad buttons - select all buttons inside .dialpad div
  const dialpadButtons = document.querySelectorAll(".dialpad button");
  dialpadButtons.forEach((btn) => {
    const digit = btn.textContent.trim();
    btn.addEventListener("click", () => {
      window.appendNumber(digit);
    });
  });

  // Clear number button
  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      window.clearNumber();
    });
  }

  // Contacts buttons - find by text content
  buttons.forEach((btn) => {
    const text = btn.textContent.trim();

    if (text.includes("Load Contacts")) {
      btn.addEventListener("click", () => {
        window.loadContacts();
      });
    }

    if (text.includes("Clear") && btn.closest("#contactsSection")) {
      btn.addEventListener("click", () => {
        window.clearContacts();
      });
    }

    if (text.includes("Refresh") && btn.closest("#historySection")) {
      btn.addEventListener("click", () => {
        window.renderCallHistory();
      });
    }

    if (text.includes("Clear History")) {
      btn.addEventListener("click", () => {
        if (confirm("Clear all call history?")) {
          window.clearHistory();
        }
      });
    }

    if (text.includes("Clear Recordings")) {
      btn.addEventListener("click", () => {
        if (confirm("Clear all recordings metadata?")) {
          window.clearRecordings();
        }
      });
    }

    if (text.includes("Refresh") && btn.closest("#contactsSection")) {
      btn.addEventListener("click", () => {
        window.loadContacts();
      });
    }
  });
};
