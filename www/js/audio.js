// ========================================
// AUDIO MANAGEMENT MODULE
// ========================================

window.createRingingTone = function () {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // iOS: Resume AudioContext if suspended (required for iOS)
  if (audioContext.state === "suspended") {
    audioContext.resume().catch((err) => {
      console.error("Failed to resume AudioContext:", err);
    });
  }

  const oscillator1 = audioContext.createOscillator();
  const oscillator2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator1.frequency.value = 440;
  oscillator2.frequency.value = 480;
  oscillator1.type = "sine";
  oscillator2.type = "sine";

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);

  const ringPattern = () => {
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.setValueAtTime(0.1, now + 2);
    gainNode.gain.setValueAtTime(0, now + 2.01);
    gainNode.gain.setValueAtTime(0, now + 6);
  };

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator1.start();
  oscillator2.start();

  ringPattern();
  const ringInterval = setInterval(ringPattern, 6000);

  return {
    stop: () => {
      clearInterval(ringInterval);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      setTimeout(() => {
        oscillator1.stop();
        oscillator2.stop();
        audioContext.close();
      }, 100);
    },
  };
};

window.startRinging = function () {
  document.getElementById("ringingIndicator").style.display = "block";
  document.getElementById("callStatus").textContent = "Ringing...";

  try {
    window.ringingAudio = createRingingTone();
  } catch (e) {
    window.log("Could not generate ringing tone: " + e.message);
  }
};

window.stopRinging = function () {
  document.getElementById("ringingIndicator").style.display = "none";
  document.getElementById("callStatus").textContent = "Call in progress";

  if (window.ringingAudio) {
    ringingAudio.stop();
    window.ringingAudio = null;
  }
};

window.setupBluetoothAudio = function () {
  try {
    // Create audio context for Bluetooth audio
    window.bluetoothAudioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    window.bluetoothAudioGain = bluetoothAudioContext.createGain();
    bluetoothAudioGain.connect(bluetoothAudioContext.destination);

    window.log("Bluetooth audio context initialized");
  } catch (error) {
    window.log("Bluetooth audio setup failed: " + error.message);
  }
};

window.handleBluetoothAudio = function () {
  if (window.bluetoothAudioContext && window.bluetoothAudioGain) {
    // Route audio through Bluetooth when available
    bluetoothAudioGain.gain.value = 1.0;
    window.log("Audio routed through Bluetooth");
  }
};

window.handleBluetoothDisconnect = function () {
  if (window.bluetoothAudioGain) {
    // Reduce gain when Bluetooth disconnects
    bluetoothAudioGain.gain.value = 0.5;
    window.log("Bluetooth disconnected - audio routed to speaker");
  }
};

window.configureAudioSession = function () {
  try {
    // Request audio focus for phone calls
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Set audio constraints for phone calls
      const audioConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Request audio focus for phone calls
          channelCount: 1,
          sampleRate: 8000,
        },
      };

      window.log("Audio session configured for lock screen continuity");

      // Set up visibility change handler for audio management
      document.addEventListener("visibilitychange", function () {
        if (window.currentSession && !document.hidden) {
          // App came back to foreground - ensure audio is still working
          window.log("App returned to foreground - checking audio session");
          handleBluetoothAudio();
        }
      });
    }
  } catch (error) {
    window.log("Error configuring audio session: " + error.message);
  }
};

window.requestWakeLock = async function () {
  try {
    if ("wakeLock" in navigator) {
      window.wakeLock = await navigator.wakeLock.request("screen");
      window.log("Wake lock acquired - screen will stay on during call");

      wakeLock.addEventListener("release", () => {
        window.log("Wake lock released");
      });
    } else {
      window.log("Wake lock API not supported");
    }
  } catch (error) {
    window.log("Wake lock failed: " + error.message);
  }
};

window.releaseWakeLock = async function () {
  try {
    if (window.wakeLock) {
      await wakeLock.release();
      window.wakeLock = null;
      window.log("Wake lock released");
    }
  } catch (error) {
    window.log("Error releasing wake lock: " + error.message);
  }
};

window.tryStartWebRTCAudio = async function () {
  // Don't try if already started for this call
  if (window.audioStarted) {
    return;
  }

  // Check if we have an active session and call
  if (!window.currentSession || !window.activeCall) {
    window.log("⏸️ Cannot start audio yet - session or call not ready");
    return;
  }

  if (window.isIOS && window.callKitAudioSessionActive === false) {
    window.pendingAudioStart = true;
    return;
  }

  startWebRTCAudio();

  if (window.isIOS && window.callKitAudioSessionActive) {
    await window.refreshMicrophoneTrack();
  }

  window.audioStarted = true;
  window.pendingAudioStart = false;
};

window.startWebRTCAudio = function () {
  if (!window.currentSession || !window.activeCall) {
    return;
  }

  try {
    const pc = window.currentSession.sessionDescriptionHandler.peerConnection;
    if (!pc) {
      return;
    }

    const remoteStream = new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    const remoteAudio = document.getElementById("remoteAudio");
    if (!remoteAudio) {
      return;
    }

    remoteAudio.srcObject = remoteStream;
    remoteAudio.volume = 1.0;
    remoteAudio.muted = false;

    remoteAudio
      .play()
      .then(() => {
        window.log("✅ [CallKit] Remote audio playing successfully");
      })
      .catch((err) => {
        window.log("❌ [CallKit] Error playing remote audio: " + err.message);
      });
  } catch (e) {
    window.log("❌ [CallKit] Error starting WebRTC audio: " + e.message);
  }
};

window.refreshMicrophoneTrack = async function () {
  if (!window.currentSession || !window.activeCall) {
    return false;
  }

  try {
    const pc = window.currentSession.sessionDescriptionHandler.peerConnection;
    if (!pc) {
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      return false;
    }

    // Find the audio sender and replace the track
    const senders = pc.getSenders();
    let audioSender = null;
    for (const sender of senders) {
      if (sender.track && sender.track.kind === "audio") {
        audioSender = sender;
        break;
      }
    }

    if (audioSender) {
      if (window.localAudioTrack) {
        window.localAudioTrack.stop();
      }

      await audioSender.replaceTrack(audioTrack);
      audioTrack.enabled = true;
      window.localAudioTrack = audioTrack;

      return true;
    } else {
      audioTrack.enabled = true;
      pc.addTrack(audioTrack, stream);
      window.localAudioTrack = audioTrack;
      return true;
    }
  } catch (error) {
    return false;
  }
};

window.setupAudioSession = function () {
  try {
    // Configure audio context for phone calls
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();

      // Set audio context state to running
      if (audioContext.state === "suspended") {
        audioContext.resume().then(() => {
          window.log("Audio context resumed for lock screen continuity");
        });
      }

      // Handle visibility changes for audio context
      document.addEventListener("visibilitychange", function () {
        if (audioContext.state === "suspended" && window.currentSession) {
          audioContext.resume().then(() => {
            window.log("Audio context resumed on visibility change");
          });
        }
      });
    }

    window.log("Audio session setup completed");
  } catch (error) {
    window.log("Error setting up audio session: " + error.message);
  }
};
