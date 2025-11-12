// ========================================
// UI MANAGER MODULE
// ========================================

window.log = function (message) {
  // Log to console for logcat capture
  console.log(message);

  const logDiv = document.getElementById("log");
  if (!logDiv) return;

  const entry = document.createElement("div");
  entry.className = "log-entry";
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logDiv.insertBefore(entry, logDiv.firstChild);

  // Limit to 100 entries in DOM
  while (logDiv.children.length > 100) {
    logDiv.removeChild(logDiv.lastChild);
  }

  // Persist to localStorage
  try {
    const logs = [];
    for (let i = 0; i < Math.min(logDiv.children.length, 100); i++) {
      logs.push(logDiv.children[i].textContent);
    }
    localStorage.setItem("eventLog", JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to persist log:", e);
  }
};

// Restore event log from localStorage
window.restoreEventLog = function () {
  try {
    const logDiv = document.getElementById("log");
    if (!logDiv) return;

    const stored = localStorage.getItem("eventLog");
    if (stored) {
      const logs = JSON.parse(stored);
      logDiv.innerHTML = "";
      logs.forEach((logText) => {
        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.textContent = logText;
        logDiv.appendChild(entry);
      });
      console.log("Restored " + logs.length + " log entries");
    }
  } catch (e) {
    console.error("Failed to restore log:", e);
  }
};

window.updateStatus = function (text, registered = false) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = text;
  if (registered) {
    statusEl.classList.add("registered");
  } else {
    statusEl.classList.remove("registered");
  }
};

window.updateEventLogVisibility = function () {
  const hideEventLogElement = document.getElementById("hideEventLog");
  if (!hideEventLogElement) {
    console.warn("hideEventLog element not found");
    return;
  }

  const hideEventLog = hideEventLogElement.checked;

  const logButton = document.querySelector('.header-toggle[title="Event Log"]');
  const logSection = document.getElementById("logSection");

  if (hideEventLog) {
    if (logButton) {
      logButton.style.display = "none";
    }
    if (logSection) {
      logSection.style.display = "none";
    }
  } else {
    if (logButton) {
      logButton.style.display = "";
    }
    if (logSection) {
      logSection.style.display = "";
    }
  }
};

window.setView = function (view) {
  const sections = {
    call: document.getElementById("callSection"),
    config: document.getElementById("configSection"),
    log: document.getElementById("logSection"),
    contacts: document.getElementById("contactsSection"),
    history: document.getElementById("historySection"),
  };

  // Hide all sections
  Object.values(sections).forEach((section) => {
    if (section) {
      section.classList.remove("visible");
      section.classList.add("hidden");
    }
  });

  // Show requested view
  if (view === "phone") {
    sections.call.classList.remove("hidden");
    showDialpad();
  } else if (view === "settings") {
    sections.config.classList.add("visible");
    sections.config.classList.remove("hidden");
  } else if (view === "log") {
    sections.log.classList.add("visible");
    sections.log.classList.remove("hidden");
  } else if (view === "contacts") {
    sections.contacts.classList.add("visible");
    sections.contacts.classList.remove("hidden");
  } else if (view === "history") {
    sections.history.classList.add("visible");
    sections.history.classList.remove("hidden");
    renderCallHistory();
  }

  // Update header buttons
  document
    .querySelectorAll(".header-toggle")
    .forEach((btn) => btn.classList.remove("active"));
  const titleMap = {
    phone: "Phone",
    contacts: "Contacts",
    settings: "Settings",
    log: "Event Log",
    history: "Call History",
  };
  const activeBtn = document.querySelector(
    `.header-toggle[title="${titleMap[view] || "Phone"}"]`,
  );
  if (activeBtn) activeBtn.classList.add("active");
};

window.showCallControls = function () {
  document.getElementById("callControls").classList.add("active");
  document.getElementById("callBtn").disabled = true;
  hideDialpad();

  // Request wake lock to prevent screen sleep during calls
  requestWakeLock();

  // Start Android foreground service to keep call alive in background
  const callNumber =
    __originalCallNumber ||
    window.__incomingRaw ||
    document.getElementById("callNumber").value ||
    "";
  startCallService(callNumber);
};

window.hideCallControls = function () {
  document.getElementById("callControls").classList.remove("active");
  document.getElementById("callBtn").disabled = false;
  showDialpad();

  // Release wake lock when call ends
  releaseWakeLock();
  stopCallTimer();

  // Stop Android foreground service
  stopCallService();
};

window.showDialpad = function () {
  const dialpadLayer = document.getElementById("dialpadLayer");
  const showDialpadBtn = document.getElementById("showDialpadBtn");
  if (dialpadLayer) {
    dialpadLayer.style.display = "block";
  }
  if (showDialpadBtn) {
    showDialpadBtn.style.display = "none";
  }
};

window.hideDialpad = function () {
  const dialpadLayer = document.getElementById("dialpadLayer");
  const showDialpadBtn = document.getElementById("showDialpadBtn");
  if (dialpadLayer) {
    dialpadLayer.style.display = "none";
  }
  // Show the "Show Dialpad" button only if there's an active call
  if (showDialpadBtn && window.currentSession) {
    showDialpadBtn.style.display = "block";
  }
};

window.hideIncomingCallUI = function () {
  document.getElementById("incomingCall").classList.remove("active");
  document.getElementById("incomingCallerName").textContent = "Incoming Call";
  document.getElementById("incomingCallerNumber").textContent =
    "Unknown Number";
  window.showDialpad();
};

window.clearAllData = async function () {
  // Clear form fields
  ["username", "password", "displayName", "callerID", "callNumber"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    },
  );

  // Clear checkboxes
  [
    "saveCredentials",
    "hideCallerID",
    "registerOnStartup",
    "hideEventLog",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  // Clear storage
  await window.Storage.clearAll();

  // Refresh call history display
  await renderCallHistory();
};
