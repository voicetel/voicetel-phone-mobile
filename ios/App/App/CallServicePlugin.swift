import Foundation
import Capacitor
import AVFoundation
import UserNotifications
import CallKit
import os

@objc(CallServicePlugin)
public class CallServicePlugin: CAPPlugin, CXProviderDelegate {
    private var isCallActive: Bool = false
    private var currentCallNumber: String = ""
    private let incomingCallNotificationId = "INCOMING_CALL_NOTIFICATION"
    private let incomingCallCategoryId = "INCOMING_CALL"
    private let logger = Logger(subsystem: "com.voicetel.phone", category: "CallService")

    // CallKit components
    private var callProvider: CXProvider?
    private var callController: CXCallController?
    private var currentCallUUID: UUID?
    private var audioSessionActivated: Bool = false

    // Native recording components
    private var audioRecorder: AVAudioRecorder?
    private var isRecording: Bool = false
    private var currentRecordingURL: URL?

    override public init() {
        super.init()
    }

    override public func load() {
        super.load()
        setupCallKit()
    }

    private func setupCallKit() {
        let configuration: CXProviderConfiguration
        if #available(iOS 14.0, *) {
            configuration = CXProviderConfiguration()
        } else {
            configuration = CXProviderConfiguration(localizedName: "VoiceTel Phone")
        }
        configuration.supportsVideo = false
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber]
        configuration.iconTemplateImageData = nil
        configuration.ringtoneSound = "default"

        callProvider = CXProvider(configuration: configuration)
        callProvider?.setDelegate(self, queue: DispatchQueue.main)
        callController = CXCallController()
    }

    @objc public func startCall(_ call: CAPPluginCall) {
        self.currentCallNumber = call.getString("callNumber") ?? ""

        // Only manage audio session if CallKit is NOT active
        // When CallKit is managing a call, it handles the audio session
        if currentCallUUID == nil {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothA2DP])
                try session.setActive(true)
            } catch {
                call.reject("Failed to start call: \(error.localizedDescription)")
                return
            }
        }

        self.isCallActive = true
        call.resolve(["success": true])
    }

    @objc public func startOutgoingCall(_ call: CAPPluginCall) {
        let callNumber = call.getString("callNumber") ?? "Unknown"
        self.currentCallNumber = callNumber

        guard let controller = callController else {
            call.reject("CallKit not initialized")
            return
        }

        let callUUID = UUID()
        currentCallUUID = callUUID

        // Create handle for the number being called
        let handle = CXHandle(type: .phoneNumber, value: callNumber)

        // Create start call action
        let startCallAction = CXStartCallAction(call: callUUID, handle: handle)
        startCallAction.isVideo = false

        let transaction = CXTransaction(action: startCallAction)

        controller.request(transaction) { error in
            if let error = error {
                call.reject("Failed to start outgoing call: \(error.localizedDescription)")
            } else {
                self.isCallActive = true
                call.resolve(["success": true, "callUUID": callUUID.uuidString])
            }
        }
    }

    @objc public func stopCall(_ call: CAPPluginCall) {
        logger.info("📞 stopCall called - isCallActive=\(self.isCallActive), hasUUID=\(self.currentCallUUID != nil)")

        // End CallKit call if active
        if let callUUID = currentCallUUID {
            let endCallAction = CXEndCallAction(call: callUUID)
            let transaction = CXTransaction(action: endCallAction)

            callController?.request(transaction) { error in
                if let error = error {
                    self.logger.error("❌ Failed to end CallKit call: \(error.localizedDescription)")
                }
            }

            currentCallUUID = nil
            self.isCallActive = false
            call.resolve(["success": true])
            return
        }

        // No CallKit call, but clean up audio session if needed
        if audioSessionActivated {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setActive(false, options: .notifyOthersOnDeactivation)
                audioSessionActivated = false
            } catch {
                logger.error("⚠️ Failed to deactivate audio session: \(error.localizedDescription)")
            }
        }

        self.isCallActive = false
        call.resolve(["success": true])
    }

    @objc public func updateCallNumber(_ call: CAPPluginCall) {
        self.currentCallNumber = call.getString("callNumber") ?? ""
        call.resolve(["success": true])
    }

    @objc public func isServiceRunning(_ call: CAPPluginCall) {
        call.resolve(["isRunning": self.isCallActive])
    }

    @objc public func showIncomingCallNotification(_ call: CAPPluginCall) {
        let callerName = call.getString("callerName") ?? "Unknown"
        let callerNumber = call.getString("callerNumber") ?? ""

        guard let provider = callProvider else {
            call.reject("CallKit not initialized")
            return
        }

        // Use CallKit to show native iOS call interface (like Android's full-screen notification)
        let callUUID = UUID()
        currentCallUUID = callUUID

        let handleValue = callerNumber.isEmpty ? "Unknown" : callerNumber
        let handle = CXHandle(type: .phoneNumber, value: handleValue)
        let callUpdate = CXCallUpdate()
        callUpdate.remoteHandle = handle
        callUpdate.localizedCallerName = callerName.isEmpty ? callerNumber : callerName
        callUpdate.hasVideo = false
        callUpdate.supportsHolding = true
        callUpdate.supportsDTMF = true
        callUpdate.supportsGrouping = false
        callUpdate.supportsUngrouping = false

        provider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
            if let error = error {
                call.reject("Failed to show call: \(error.localizedDescription)")
            } else {
                call.resolve(["success": true])
            }
        }
    }

    @objc public func dismissIncomingCallNotification(_ call: CAPPluginCall) {
        // End the CallKit call
        if let callUUID = currentCallUUID {
            let endCallAction = CXEndCallAction(call: callUUID)
            let transaction = CXTransaction(action: endCallAction)

            callController?.request(transaction) { error in
                // Error logged if needed
            }

            currentCallUUID = nil
        }

        // Also remove any regular notifications as fallback
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [incomingCallNotificationId])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [incomingCallNotificationId])

        call.resolve(["success": true])
    }

    @objc public func reportCallConnected(_ call: CAPPluginCall) {
        // For incoming calls: This stops CallKit's ringtone by fulfilling an answer action
        // For outgoing calls: This reports the call as connected
        if let callUUID = currentCallUUID, let provider = callProvider {
            let isOutgoing = call.getBool("isOutgoing") ?? false

            if isOutgoing {
                // For outgoing calls, report that the call connected
                provider.reportOutgoingCall(with: callUUID, connectedAt: Date())
                call.resolve(["success": true])
            } else {
                // For incoming calls, fulfill the answer action to stop ringtone
                let answerAction = CXAnswerCallAction(call: callUUID)
                let transaction = CXTransaction(action: answerAction)

                callController?.request(transaction) { error in
                    if let error = error {
                        call.reject("Failed to report call connected: \(error.localizedDescription)")
                    } else {
                        call.resolve(["success": true])
                    }
                }
            }
        } else {
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    @objc public func reportOutgoingCallStartedConnecting(_ call: CAPPluginCall) {
        // Report that the remote party is ringing (180 Ringing received)
        if let callUUID = currentCallUUID, let provider = callProvider {
            provider.reportOutgoingCall(with: callUUID, startedConnectingAt: Date())
            call.resolve(["success": true])
        } else {
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    @objc public func reportCallFailed(_ call: CAPPluginCall) {
        // Report that the call failed (network error, rejected, etc.)
        if let callUUID = currentCallUUID {
            // End the call with a failure reason
            let endAction = CXEndCallAction(call: callUUID)
            let transaction = CXTransaction(action: endAction)

            callController?.request(transaction) { error in
                if let error = error {
                    print("CallServicePlugin: Failed to end call: \(error.localizedDescription)")
                }
            }

            // Clean up
            currentCallUUID = nil
            call.resolve(["success": true])
        } else {
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    @objc public func setCallMuted(_ call: CAPPluginCall) {
        guard let isMuted = call.getBool("muted") else {
            call.reject("Missing muted parameter")
            return
        }

        if let callUUID = currentCallUUID {
            let muteAction = CXSetMutedCallAction(call: callUUID, muted: isMuted)
            let transaction = CXTransaction(action: muteAction)

            callController?.request(transaction) { error in
                if let error = error {
                    call.reject("Failed to set mute state: \(error.localizedDescription)")
                } else {
                    call.resolve(["success": true])
                }
            }
        } else {
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    @objc public func setCallHeld(_ call: CAPPluginCall) {
        guard let onHold = call.getBool("onHold") else {
            call.reject("Missing onHold parameter")
            return
        }

        if let callUUID = currentCallUUID {
            let holdAction = CXSetHeldCallAction(call: callUUID, onHold: onHold)
            let transaction = CXTransaction(action: holdAction)

            callController?.request(transaction) { error in
                if let error = error {
                    call.reject("Failed to set hold state: \(error.localizedDescription)")
                } else {
                    call.resolve(["success": true])
                }
            }
        } else {
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {
        logger.info("📞 providerDidReset called - resetting all CallKit state")

        // Reset all state
        currentCallUUID = nil
        isCallActive = false
        audioSessionActivated = false

        // Stop any active recording
        if isRecording {
            logger.info("🛑 providerDidReset: Stopping active recording")
            _ = stopRecordingInternal()
        }

        // Notify JavaScript to reset its state
        notifyBridge(action: "CALLKIT_RESET")
    }

    public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        let callUpdate = CXCallUpdate()
        callUpdate.remoteHandle = action.handle
        callUpdate.hasVideo = false
        callUpdate.localizedCallerName = action.handle.value
        callUpdate.supportsHolding = true
        callUpdate.supportsDTMF = true
        callUpdate.supportsGrouping = false
        callUpdate.supportsUngrouping = false

        // Report the call update
        callProvider?.reportCall(with: action.callUUID, updated: callUpdate)

        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Update call configuration to ensure hold and other features are enabled
        let callUpdate = CXCallUpdate()
        callUpdate.supportsHolding = true
        callUpdate.supportsDTMF = true
        callUpdate.supportsGrouping = false
        callUpdate.supportsUngrouping = false
        callUpdate.hasVideo = false

        callProvider?.reportCall(with: action.callUUID, updated: callUpdate)

        notifyBridge(action: "ANSWER_CALL")
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        logger.info("📞 CXEndCallAction - audioSessionActivated=\(self.audioSessionActivated)")

        // Differentiate between declining incoming call vs ending active call
        if currentCallUUID == action.callUUID {
            if audioSessionActivated {
                notifyBridge(action: "HANGUP")
            } else {
                notifyBridge(action: "DECLINE_CALL")
            }

            currentCallUUID = nil
            self.isCallActive = false

            // Stop any active recording when call ends from CallKit
            if isRecording {
                logger.info("🛑 CXEndCallAction: Stopping active recording")
                _ = stopRecordingInternal()
            }
        }

        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        if action.isOnHold {
            notifyBridge(action: "HOLD_CALL")
        } else {
            notifyBridge(action: "UNHOLD_CALL")
        }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        if action.isMuted {
            notifyBridge(action: "MUTE_CALL")
        } else {
            notifyBridge(action: "UNMUTE_CALL")
        }

        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXPlayDTMFCallAction) {
        let digit = action.digits
        notifyBridge(action: "PLAY_DTMF", data: digit)
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        if audioSessionActivated {
            return
        }

        do {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothA2DP])
            try audioSession.setPreferredInput(nil)
            try audioSession.setActive(true)

            audioSessionActivated = true

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.notifyBridge(action: "AUDIO_SESSION_ACTIVATED")
            }
        } catch {
            // Error configuring audio session
        }
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        logger.info("📞 didDeactivate audio session - cleaning up state")

        currentCallUUID = nil
        isCallActive = false
        audioSessionActivated = false

        // Stop any active recording when audio session deactivates
        if isRecording {
            logger.info("🛑 didDeactivate: Stopping active recording")
            _ = stopRecordingInternal()
        }

        notifyBridge(action: "AUDIO_SESSION_DEACTIVATED")
    }

    private func notifyBridge(action: String, data: String? = nil, retryCount: Int = 0) {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                // For AUDIO_SESSION_ACTIVATED, set the flag directly AND call the handler
                if action == "AUDIO_SESSION_ACTIVATED" {
                    let setFlagJS = "window.callKitAudioSessionActive = true; console.log('✅ [Swift] Set callKitAudioSessionActive = true');"
                    bridge.webView?.evaluateJavaScript(setFlagJS, completionHandler: nil)
                }

                // Try to call the handler function
                let dataParam = data != nil ? "'\(data!)'" : "null"
                let checkAndCallJS = """
                if (typeof window !== 'undefined' && typeof window.handleNotificationAction === 'function') {
                    window.handleNotificationAction('\(action)', \(dataParam));
                    true;
                } else {
                    false;
                }
                """

                bridge.webView?.evaluateJavaScript(checkAndCallJS) { result, error in
                    if let success = result as? Bool, !success, retryCount < 5 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            self.notifyBridge(action: action, data: data, retryCount: retryCount + 1)
                        }
                    }
                }
            }
        }
    }

    @objc public func startNativeRecording(_ call: CAPPluginCall) {
        guard isCallActive else {
            call.reject("No active call")
            return
        }

        guard !isRecording else {
            call.reject("Recording already in progress")
            return
        }

        do {
            let dir = try ensureRecordingsDirectory()

            // Get caller number and timestamp from JavaScript (to match Android naming)
            let callerNumber = call.getString("callerNumber") ?? "unknown"
            let timestamp: String

            if let timestampMs = call.getDouble("timestamp") {
                let date = Date(timeIntervalSince1970: timestampMs / 1000.0)
                timestamp = ISO8601DateFormatter().string(from: date).replacingOccurrences(of: ":", with: "-").replacingOccurrences(of: ".", with: "-")
            } else {
                timestamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-").replacingOccurrences(of: ".", with: "-")
            }

            // Match Android naming: recording_timestamp_callerNumber.m4a
            let filename = "recording_\(timestamp)_\(callerNumber).m4a"
            let fileURL = dir.appendingPathComponent(filename)

            // Configure audio session for recording
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try audioSession.setActive(true)

            // Configure recording settings for voice (AAC in M4A container)
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44100.0,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]

            audioRecorder = try AVAudioRecorder(url: fileURL, settings: settings)
            audioRecorder?.prepareToRecord()
            audioRecorder?.record()

            currentRecordingURL = fileURL
            isRecording = true

            logger.info("Native recording started: \(filename)")
            call.resolve([
                "success": true,
                "filename": filename,
                "filePath": fileURL.path
            ])
        } catch {
            logger.error("Failed to start native recording: \(error.localizedDescription)")
            call.reject("Failed to start recording: \(error.localizedDescription)")
        }
    }

    @objc public func stopNativeRecording(_ call: CAPPluginCall) {
        logger.info("🛑 stopNativeRecording called from JavaScript, isRecording=\(self.isRecording)")

        guard isRecording else {
            logger.warning("⚠️ stopNativeRecording: No recording in progress (possibly already stopped)")
            call.reject("No recording in progress")
            return
        }

        logger.info("📱 stopNativeRecording: Calling stopRecordingInternal...")
        let result = stopRecordingInternal()
        logger.info("✅ stopNativeRecording: stopRecordingInternal returned success=\(result.success)")

        if result.success {
            logger.info("📊 stopNativeRecording: Resolving with filename=\(result.filename ?? "nil"), duration=\(result.duration)s")
            call.resolve([
                "success": true,
                "filename": result.filename ?? "",
                "filePath": result.filePath ?? "",
                "duration": result.duration
            ])
            logger.info("✓ stopNativeRecording: call.resolve completed successfully")
        } else {
            logger.error("❌ stopNativeRecording: Failed to stop recording")
            call.reject("Failed to stop recording")
        }
    }

    @objc public func isNativeRecording(_ call: CAPPluginCall) {
        call.resolve(["isRecording": isRecording])
    }

    private func stopRecordingInternal() -> (success: Bool, filename: String?, filePath: String?, duration: TimeInterval) {
        logger.info("🔧 stopRecordingInternal called, isRecording=\(self.isRecording), recorder exists=\(self.audioRecorder != nil)")

        guard isRecording, let recorder = audioRecorder else {
            logger.warning("⚠️ stopRecordingInternal: Guard failed (already stopped or no recorder)")
            return (false, nil, nil, 0)
        }

        logger.info("⏸️ stopRecordingInternal: Calling recorder.stop()...")
        recorder.stop()
        let duration = recorder.currentTime
        logger.info("✓ stopRecordingInternal: Recorder stopped, duration=\(duration)s")

        let filename = currentRecordingURL?.lastPathComponent
        let filePath = currentRecordingURL?.path

        logger.info("📁 stopRecordingInternal: filename=\(filename ?? "nil"), path=\(filePath ?? "nil")")

        // Reset state AFTER capturing the values
        audioRecorder = nil
        currentRecordingURL = nil
        isRecording = false

        logger.info("✅ Native recording stopped successfully. Duration: \(duration)s, File: \(filename ?? "unknown")")

        return (true, filename, filePath, duration)
    }

    @objc public func saveRecording(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              let base64 = call.getString("data") else {
            call.reject("Missing filename or data")
            return
        }
        // Optional inputs
        let mimeType = call.getString("mimeType")
        _ = call.getString("convertToFormat")

        do {
            let dir = try ensureRecordingsDirectory()
            let targetFilename: String = {
                // If no extension provided, choose based on mimeType when available.
                let hasExt = !(filename as NSString).pathExtension.isEmpty
                if hasExt { return filename }
                if let mt = mimeType?.lowercased() {
                    if mt.contains("audio/mp4") || mt.contains("audio/m4a") { return filename + ".m4a" }
                    if mt.contains("audio/mpeg") { return filename + ".mp3" }
                    if mt.contains("audio/wav") { return filename + ".wav" }
                    if mt.contains("audio/ogg") { return filename + ".ogg" }
                    if mt.contains("audio/webm") || mt.contains("weba") || mt.contains("webn") { return filename + ".webm" }
                    if mt.contains("image/webp") || mt.contains("webp") { return filename + ".webp" }
                }
                // Fallback preference on iOS: m4a
                return filename + ".m4a"
            }()
            let fileURL = dir.appendingPathComponent(targetFilename)
            guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
                logger.error("saveRecording: invalid base64 for filename=\(targetFilename, privacy: .public)")
                call.reject("Invalid base64 data")
                return
            }
            try data.write(to: fileURL, options: .atomic)
            logger.info("saveRecording: saved path=\(fileURL.path, privacy: .public) bytes=\(data.count)")
            call.resolve(["success": true, "filePath": fileURL.path, "filename": targetFilename])
        } catch {
            logger.error("saveRecording failed: \(error.localizedDescription)")
            call.reject("Failed to save recording: \(error.localizedDescription)")
        }
    }

    @objc public func getSupportedFormats(_ call: CAPPluginCall) {
        // Prefer AAC in M4A/MP4 containers on iOS
        call.resolve([
            "formats": ["m4a", "mp4"],
            "note": "Using m4a by default on iOS for best compatibility."
        ])
    }

    @objc public func getRecordingFileUrl(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename") else {
            call.reject("Missing filename")
            return
        }
        do {
            let dir = try ensureRecordingsDirectory()
            let fileURL = try resolveFileURL(in: dir, filename: filename)
            logger.debug("getRecordingFileUrl: resolved=\(fileURL.lastPathComponent, privacy: .public)")
            // Return data URL to mirror Android behavior
            let data = try Data(contentsOf: fileURL)
            let base64 = data.base64EncodedString()
            let mime = mimeType(for: fileURL.lastPathComponent)
            let dataUrl = "data:\(mime);base64,\(base64)"
            call.resolve(["success": true, "url": dataUrl])
        } catch {
            logger.error("getRecordingFileUrl failed: \(error.localizedDescription)")
            call.reject("Failed to read file: \(error.localizedDescription)")
        }
    }

    @objc public func getRecordingFileAsDataUrl(_ call: CAPPluginCall) {
        // Alias of getRecordingFileUrl for Android parity
        self.getRecordingFileUrl(call)
    }

    @objc public func deleteRecordingFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename") else {
            call.reject("Missing filename")
            return
        }
        do {
            let dir = try ensureRecordingsDirectory()
            let fileURL = try resolveFileURL(in: dir, filename: filename)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                try FileManager.default.removeItem(at: fileURL)
                logger.info("deleteRecordingFile: removed=\(fileURL.lastPathComponent, privacy: .public)")
                call.resolve(["success": true])
            } else {
                logger.debug("deleteRecordingFile: not found=\(filename, privacy: .public)")
                call.resolve(["success": false])
            }
        } catch {
            logger.error("deleteRecordingFile failed: \(error.localizedDescription)")
            call.reject("Failed to delete file: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    private func ensureRecordingsDirectory() throws -> URL {
        // Store under Application Support to mirror Android's app-private external storage semantics
        // and exclude from iCloud backups.
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = base.appendingPathComponent("CallRecordings", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
            logger.debug("ensureRecordingsDirectory: created=\(dir.path, privacy: .public)")
        }
        // Exclude from iCloud backups
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        var mutableDir = dir
        try mutableDir.setResourceValues(resourceValues)
        return dir
    }

    private func mimeType(for filename: String) -> String {
        let lower = filename.lowercased()
        if lower.hasSuffix(".m4a") || lower.hasSuffix(".mp4") { return "audio/mp4" }
        if lower.hasSuffix(".mp3") { return "audio/mpeg" }
        if lower.hasSuffix(".wav") { return "audio/wav" }
        if lower.hasSuffix(".ogg") { return "audio/ogg" }
        if lower.hasSuffix(".webm") { return "audio/webm" }
        if lower.hasSuffix(".weba") { return "audio/webm" }
        if lower.hasSuffix(".webp") { return "image/webp" }
        return "application/octet-stream"
    }

    private func resolveFileURL(in dir: URL, filename: String) throws -> URL {
        let direct = dir.appendingPathComponent(filename)
        if FileManager.default.fileExists(atPath: direct.path) {
            logger.debug("resolveFileURL: direct hit=\(direct.lastPathComponent, privacy: .public)")
            return direct
        }
        // If no extension provided, try common audio extensions with .m4a preferred
        let ext = (filename as NSString).pathExtension
        if ext.isEmpty {
            let candidates = ["m4a", "mp4", "mp3", "wav", "ogg", "webm", "weba", "webp"]
            for e in candidates {
                let url = dir.appendingPathComponent(filename + "." + e)
                if FileManager.default.fileExists(atPath: url.path) {
                    logger.debug("resolveFileURL: matched=\(url.lastPathComponent, privacy: .public)")
                    return url
                }
            }
        }
        throw NSError(domain: "CallServicePlugin", code: 404, userInfo: [NSLocalizedDescriptionKey: "Recording file not found: \(filename)"])
    }
}
