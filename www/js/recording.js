// ========================================
// RECORDING MODULE
// ========================================

// Helper: Detect iOS platform
function isIOSPlatform() {
  return (
    (window.Capacitor?.getPlatform &&
      window.Capacitor.getPlatform() === "ios") ||
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
}

// Helper: Get caller info for filename
function getCallerInfo() {
  const callerNumber =
    window.__incomingRaw || window.__originalCallNumber || "unknown";
  const timestamp = Date.now();
  return { callerNumber, timestamp };
}

// ========================================
// START RECORDING
// ========================================
window.startRecording = async function () {
  // Early checks
  if (window.isRecording) {
    window.log("⚠️ Recording already in progress");
    return;
  }

  const recordingEnabled =
    document.getElementById("enableCallRecording")?.checked || false;
  if (!recordingEnabled) {
    window.log("Call recording is disabled in settings");
    return;
  }

  const isIOS = isIOSPlatform();
  window.log(`🎙️ Starting recording - Platform: ${isIOS ? "iOS" : "Android"}`);

  // iOS: Native recording
  if (isIOS && window.Capacitor?.Plugins?.CallService) {
    try {
      const { callerNumber, timestamp } = getCallerInfo();

      const result =
        await window.Capacitor.Plugins.CallService.startNativeRecording({
          callerNumber,
          timestamp,
        });

      if (result.success) {
        window.isRecording = true;
        window.recordingCallStartTime = timestamp;
        window.currentRecordingFilename = result.filename;
        window.log(`✅ Native recording started: ${result.filename}`);
      } else {
        throw new Error("Native recording failed to start");
      }
    } catch (error) {
      window.log(`❌ Native recording failed: ${error.message}`);
      console.error("Native recording error:", error);
      throw error;
    }
    return;
  }

  // Android: Web Audio API + MediaRecorder
  try {
    const pc = currentSession?.sessionDescriptionHandler?.peerConnection;
    if (!pc) throw new Error("PeerConnection not available");

    // Create audio context for mixing
    window.recordingAudioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    window.recordingDestination =
      recordingAudioContext.createMediaStreamDestination();
    window.recordingStream = recordingDestination.stream;

    // Add audio tracks from receivers (remote) and senders (local)
    let tracksAdded = 0;

    [...pc.getReceivers(), ...pc.getSenders()].forEach((rtpObject) => {
      const track = rtpObject.track;
      if (track?.kind === "audio" && track.readyState === "live") {
        try {
          const source = recordingAudioContext.createMediaStreamSource(
            new MediaStream([track]),
          );
          source.connect(window.recordingDestination);
          tracksAdded++;
        } catch (e) {
          console.error("Failed to add track:", e);
        }
      }
    });

    if (tracksAdded === 0)
      throw new Error("No audio tracks available for recording");
    window.log(`✅ Connected ${tracksAdded} audio tracks`);

    // Find supported MIME type
    const supportedTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    const mimeType =
      supportedTypes.find((type) => MediaRecorder.isTypeSupported?.(type)) ||
      "audio/webm";

    window.log(`✅ Using MIME type: ${mimeType}`);

    // Start recording
    window.mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });
    window.recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) window.recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(window.recordedChunks, { type: mimeType });
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64String = reader.result.split(",")[1];
        const { callerNumber } = getCallerInfo();
        const callTimestamp = window.recordingCallStartTime
          ? new Date(window.recordingCallStartTime).toISOString()
          : new Date().toISOString();
        const filename = `recording_${callTimestamp.replace(/:/g, "-").replace(/\./g, "-")}_${callerNumber}`;

        // Save via native plugin if available
        if (
          window.Capacitor?.isNativePlatform?.() &&
          window.Capacitor?.Plugins?.CallService
        ) {
          try {
            const result =
              await window.Capacitor.Plugins.CallService.saveRecording({
                filename,
                data: base64String,
                mimeType,
              });
            if (result.success) {
              window.log(`✅ Recording saved: ${result.filename}`);
              window.currentRecordingFilename = result.filename;
            }
          } catch (e) {
            window.log(`❌ Failed to save recording: ${e.message}`);
          }
        } else {
          // Web browser fallback - download the file
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename + ".webm";
          a.click();
          URL.revokeObjectURL(url);
          window.log("📥 Recording downloaded");
        }

        window.recordedChunks = [];
      };

      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
    window.isRecording = true;
    window.recordingCallStartTime = Date.now();
    window.log("🎙️ Recording started");
  } catch (error) {
    window.log(`❌ Failed to start recording: ${error.message}`);
    console.error("Recording start error:", error);
    window.isRecording = false;

    // Clean up on error
    if (window.recordingAudioContext) {
      try {
        recordingAudioContext.close();
      } catch (e) {}
      window.recordingAudioContext = null;
      window.recordingDestination = null;
      window.recordingStream = null;
    }
    throw error;
  }
};

// ========================================
// STOP RECORDING
// ========================================
window.stopRecording = async function () {
  if (!window.isRecording) {
    return null; // Idempotent - safe to call multiple times
  }

  window.log("🛑 Stopping recording...");
  const isIOS = isIOSPlatform();

  // iOS: Stop native recording
  if (isIOS && window.Capacitor?.Plugins?.CallService) {
    window.isRecording = false; // Reset immediately to prevent duplicate calls

    try {
      const result =
        await window.Capacitor.Plugins.CallService.stopNativeRecording();

      if (result?.success) {
        window.log(
          `✅ Recording stopped: ${result.filename} (${Math.floor(result.duration)}s)`,
        );
        window.recordingCallStartTime = null;
        window.currentRecordingFilename = null;
        return result.filename;
      }
    } catch (error) {
      // Silently handle "No recording in progress" - this is expected in some edge cases
      if (!error.message?.includes("No recording in progress")) {
        window.log(`⚠️ Stop recording error: ${error.message}`);
      }
    }

    // Clean up state
    window.recordingCallStartTime = null;
    window.currentRecordingFilename = null;
    return null;
  }

  // Android: Stop MediaRecorder
  try {
    if (window.mediaRecorder?.state !== "inactive") {
      window.mediaRecorder.stop();
      window.log("⏹️ Recording stopped");
    }

    window.isRecording = false;

    // Clean up audio context
    if (window.recordingAudioContext) {
      recordingAudioContext.close();
      window.recordingAudioContext = null;
      window.recordingDestination = null;
      window.recordingStream = null;
    }

    // Android: filename is set by MediaRecorder.onstop callback
    return window.currentRecordingFilename || null;
  } catch (error) {
    window.log(`⚠️ Stop recording error: ${error.message}`);
    console.error("Recording stop error:", error);
    window.isRecording = false;
    return null;
  }
};
