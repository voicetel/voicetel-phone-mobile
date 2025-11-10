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

    override public init() {
        super.init()
        print("🎯 CallServicePlugin init() called - PLUGIN IS LOADING")
        logger.error("🎯 CallServicePlugin init() called")
    }

    override public func load() {
        super.load()
        print("🚀 CallServicePlugin load() called - PLUGIN LOADED")
        logger.error("🚀 CallServicePlugin load() called")
        setupCallKit()
        print("✅ CallServicePlugin load() completed")
        logger.error("✅ CallServicePlugin load() completed")

    }

    private func setupCallKit() {
        logger.error("🔧 Setting up CallKit...")

        let configuration = CXProviderConfiguration(localizedName: "VoiceTel Phone")
        configuration.supportsVideo = false
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber]
        configuration.iconTemplateImageData = nil
        configuration.ringtoneSound = "default"

        callProvider = CXProvider(configuration: configuration)
        callProvider?.setDelegate(self, queue: DispatchQueue.main)
        callController = CXCallController()

        logger.error("✅ CallKit initialized - Provider: \(self.callProvider != nil), Controller: \(self.callController != nil)")
    }

    @objc public func startCall(_ call: CAPPluginCall) {
        self.currentCallNumber = call.getString("callNumber") ?? ""

        // Only manage audio session if CallKit is NOT active
        // When CallKit is managing a call, it handles the audio session
        if currentCallUUID == nil {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .mixWithOthers, .duckOthers, .defaultToSpeaker])
                try session.setActive(true)
                logger.info("startCall: activated audio session (no CallKit), number=\(self.currentCallNumber)")
            } catch {
                logger.error("startCall: audio session failed: \(error.localizedDescription)")
                call.reject("Failed to start call: \(error.localizedDescription)")
                return
            }
        } else {
            logger.info("startCall: CallKit active, skipping audio session management, number=\(self.currentCallNumber)")
        }

        self.isCallActive = true
        call.resolve(["success": true])
    }

    @objc public func stopCall(_ call: CAPPluginCall) {
        // End CallKit call if active
        if let callUUID = currentCallUUID {
            let endCallAction = CXEndCallAction(call: callUUID)
            let transaction = CXTransaction(action: endCallAction)

            callController?.request(transaction) { error in
                if let error = error {
                    self.logger.error("stopCall: CallKit end failed: \(error.localizedDescription)")
                } else {
                    self.logger.error("stopCall: CallKit call ended")
                }
            }

            currentCallUUID = nil
            self.isCallActive = false

            // Don't deactivate audio session - CallKit will handle it
            logger.info("stopCall: CallKit handling audio session deactivation")
            call.resolve(["success": true])
            return
        }

        // Only deactivate audio session if CallKit is not managing it
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            self.isCallActive = false
            logger.info("stopCall: deactivated audio session (no CallKit)")
            call.resolve(["success": true])
        } catch {
            logger.error("stopCall failed: \(error.localizedDescription)")
            call.reject("Failed to stop call: \(error.localizedDescription)")
        }
    }

    @objc public func updateCallNumber(_ call: CAPPluginCall) {
        self.currentCallNumber = call.getString("callNumber") ?? ""
        logger.debug("updateCallNumber: number=\(self.currentCallNumber)")
        call.resolve(["success": true])
    }

    @objc public func isServiceRunning(_ call: CAPPluginCall) {
        logger.debug("isServiceRunning: \(self.isCallActive, privacy: .public)")
        call.resolve(["isRunning": self.isCallActive])
    }

    @objc public func showIncomingCallNotification(_ call: CAPPluginCall) {
        logger.error("📞 showIncomingCallNotification CALLED")

        let callerName = call.getString("callerName") ?? "Unknown"
        let callerNumber = call.getString("callerNumber") ?? ""
        logger.error("📞 Caller: '\(callerName)' Number: '\(callerNumber)'")

        // Check if CallKit is initialized
        guard let provider = callProvider else {
            logger.error("❌ CallKit provider is nil! Cannot show incoming call.")
            call.reject("CallKit not initialized")
            return
        }

        logger.error("✅ CallKit provider exists, proceeding...")

        // Use CallKit to show native iOS call interface (like Android's full-screen notification)
        let callUUID = UUID()
        currentCallUUID = callUUID

        logger.error("📱 Created call UUID: \(callUUID.uuidString)")

        let handleValue = callerNumber.isEmpty ? "Unknown" : callerNumber
        let handle = CXHandle(type: .phoneNumber, value: handleValue)
        let callUpdate = CXCallUpdate()
        callUpdate.remoteHandle = handle
        callUpdate.localizedCallerName = callerName.isEmpty ? callerNumber : callerName
        callUpdate.hasVideo = false

        logger.error("📱 Reporting incoming call to CallKit NOW...")
        logger.error("   Handle: \(handleValue)")
        logger.error("   Display Name: \(callUpdate.localizedCallerName ?? "nil")")

        provider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
            if let error = error {
                let nsError = error as NSError
                self.logger.error("❌ CallKit reportNewIncomingCall FAILED")
                self.logger.error("   Error: \(error.localizedDescription)")
                self.logger.error("   Domain: \(nsError.domain)")
                self.logger.error("   Code: \(nsError.code)")
                self.logger.error("   UserInfo: \(nsError.userInfo)")
                call.reject("Failed to show call: \(error.localizedDescription)")
            } else {
                self.logger.error("✅ CallKit reportNewIncomingCall SUCCESS!")
                self.logger.error("   CallKit UI should now be visible on screen")
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
                if let error = error {
                    self.logger.error("dismissIncomingCallNotification failed: \(error.localizedDescription)")
                } else {
                    self.logger.error("dismissIncomingCallNotification: call ended")
                }
            }

            currentCallUUID = nil
        }

        // Also remove any regular notifications as fallback
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [incomingCallNotificationId])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [incomingCallNotificationId])

        call.resolve(["success": true])
    }

    @objc public func reportCallConnected(_ call: CAPPluginCall) {
        logger.error("📞 reportCallConnected CALLED")
        logger.error("   Current UUID: \(self.currentCallUUID?.uuidString ?? "none")")
        logger.error("   Audio activated: \(self.audioSessionActivated)")

        // Report that the call has been connected (answered)
        // This stops CallKit's ringtone by fulfilling an answer action
        if let callUUID = currentCallUUID {
            let answerAction = CXAnswerCallAction(call: callUUID)
            let transaction = CXTransaction(action: answerAction)

            logger.error("   Requesting answer action for UUID: \(callUUID.uuidString)")

            callController?.request(transaction) { error in
                if let error = error {
                    let nsError = error as NSError
                    self.logger.error("❌ reportCallConnected failed: \(error.localizedDescription)")
                    self.logger.error("   Error code: \(nsError.code), domain: \(nsError.domain)")
                    call.reject("Failed to report call connected: \(error.localizedDescription)")
                } else {
                    self.logger.error("✅ reportCallConnected: CallKit call answered")
                    call.resolve(["success": true])
                }
            }
        } else {
            logger.error("⚠️ reportCallConnected: No active call UUID")
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    @objc public func setCallMuted(_ call: CAPPluginCall) {
        guard let isMuted = call.getBool("muted") else {
            call.reject("Missing muted parameter")
            return
        }

        logger.error("🔇 setCallMuted called from JS: muted=\(isMuted)")

        if let callUUID = currentCallUUID {
            let muteAction = CXSetMutedCallAction(call: callUUID, muted: isMuted)
            let transaction = CXTransaction(action: muteAction)

            callController?.request(transaction) { error in
                if let error = error {
                    self.logger.error("❌ setCallMuted failed: \(error.localizedDescription)")
                    call.reject("Failed to set mute state: \(error.localizedDescription)")
                } else {
                    self.logger.error("✅ setCallMuted: CallKit mute state updated to \(isMuted)")
                    call.resolve(["success": true])
                }
            }
        } else {
            logger.error("⚠️ setCallMuted: No active call UUID")
            call.resolve(["success": false, "message": "No active call"])
        }
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {
        logger.error("⚠️ CallKit provider did reset")
        currentCallUUID = nil
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        logger.error("✅ CallKit: User pressed ANSWER button")
        logger.error("   Call UUID: \(action.callUUID.uuidString)")

        // Notify JavaScript to answer the call
        notifyBridge(action: "ANSWER_CALL")

        // Fulfill the action - this automatically stops CallKit's ringtone
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        logger.error("❌ CallKit: User pressed END/DECLINE button")
        logger.error("   Call UUID: \(action.callUUID.uuidString)")

        // Notify JavaScript to decline/end the call
        // Differentiate between declining incoming call vs ending active call
        if currentCallUUID == action.callUUID {
            // Check if this is an active call or incoming call
            // If audio session is activated, it's an active call
            if audioSessionActivated {
                logger.error("   Ending active call (HANGUP)")
                notifyBridge(action: "HANGUP")
            } else {
                logger.error("   Declining incoming call (DECLINE)")
                notifyBridge(action: "DECLINE_CALL")
            }
        }

        currentCallUUID = nil
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        logger.debug("CallKit: Set held call action")
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        logger.error("🔇 CallKit: User toggled MUTE button")
        logger.error("   Call UUID: \(action.callUUID.uuidString)")
        logger.error("   Muted: \(action.isMuted)")

        // Notify JavaScript to update mute state
        if action.isMuted {
            notifyBridge(action: "MUTE_CALL")
        } else {
            notifyBridge(action: "UNMUTE_CALL")
        }

        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Log call stack to see what's triggering this
        logger.error("🔊🔊🔊 CallKit didActivate CALLED #\(self.audioSessionActivated ? "DUPLICATE" : "NEW")")
        logger.error("   Call UUID: \(self.currentCallUUID?.uuidString ?? "none")")
        logger.error("   Thread: \(Thread.current)")

        // Prevent repeated activation
        if audioSessionActivated {
            logger.error("⚠️ Audio session already activated, skipping duplicate activation")
            return
        }

        logger.error("🔊 Processing audio session activation...")

        logAudioSessionState("didActivate START")

        // Configure audio session for VoIP calls
        do {
            logger.error("   Setting category to playAndRecord, mode voiceChat...")
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker])
            logger.error("   ✅ Category set")

            logger.error("   Activating audio session...")
            try audioSession.setActive(true)
            logger.error("   ✅ Audio session activated")

            audioSessionActivated = true

            logAudioSessionState("didActivate AFTER activation")

            // Notify JavaScript that audio session is ready (ONLY ONCE)
            notifyBridge(action: "AUDIO_SESSION_ACTIVATED")

            logger.error("🔊 Audio should now be working - check if you can hear audio")
        } catch {
            logger.error("❌❌❌ Failed to configure audio session: \(error.localizedDescription)")
            let nsError = error as NSError
            logger.error("   Domain: \(nsError.domain), Code: \(nsError.code)")
            logger.error("   UserInfo: \(nsError.userInfo)")
        }
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        logger.error("🔇 CallKit didDeactivate CALLED - CallKit is taking back audio session")

        logAudioSessionState("didDeactivate")

        // Clear the call UUID since CallKit is done with this call
        currentCallUUID = nil
        isCallActive = false
        audioSessionActivated = false

        notifyBridge(action: "AUDIO_SESSION_DEACTIVATED")
    }

    // MARK: - Audio Debugging

    private func logAudioSessionState(_ context: String) {
        let session = AVAudioSession.sharedInstance()
        logger.error("🎤 AUDIO STATE [\(context)]:")
        logger.error("   Category: \(session.category.rawValue)")
        logger.error("   Mode: \(session.mode.rawValue)")
        logger.error("   Options: \(session.categoryOptions.rawValue)")
        logger.error("   isOtherAudioPlaying: \(session.isOtherAudioPlaying)")
        logger.error("   currentRoute inputs: \(session.currentRoute.inputs.map { $0.portName }.joined(separator: ", "))")
        logger.error("   currentRoute outputs: \(session.currentRoute.outputs.map { $0.portName }.joined(separator: ", "))")
        logger.error("   availableInputs: \(session.availableInputs?.map { $0.portName }.joined(separator: ", ") ?? "none")")
        logger.error("   preferredInput: \(session.preferredInput?.portName ?? "none")")
        logger.error("   inputGain: \(session.inputGain)")
        logger.error("   outputVolume: \(session.outputVolume)")
        logger.error("   sampleRate: \(session.sampleRate)")
        logger.error("   inputNumberOfChannels: \(session.inputNumberOfChannels)")
        logger.error("   outputNumberOfChannels: \(session.outputNumberOfChannels)")
    }

    private func notifyBridge(action: String, retryCount: Int = 0) {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                // For AUDIO_SESSION_ACTIVATED, set the flag directly AND call the handler
                if action == "AUDIO_SESSION_ACTIVATED" {
                    let setFlagJS = "window.callKitAudioSessionActive = true; console.log('✅ [Swift] Set callKitAudioSessionActive = true');"
                    bridge.webView?.evaluateJavaScript(setFlagJS, completionHandler: nil)
                }

                // Try to call the handler function
                let checkAndCallJS = """
                if (typeof window !== 'undefined' && typeof window.handleNotificationAction === 'function') {
                    window.handleNotificationAction('\(action)', null);
                    true;
                } else {
                    false;
                }
                """

                bridge.webView?.evaluateJavaScript(checkAndCallJS) { result, error in
                    if let success = result as? Bool, success {
                        self.logger.error("✅ [Swift] Successfully called handleNotificationAction('\(action)')")
                    } else if retryCount < 5 {
                        // Retry after a short delay (max 5 attempts)
                        self.logger.error("⚠️ [Swift] handleNotificationAction not ready, retrying in 100ms... (attempt \(retryCount + 1)/5)")
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            self.notifyBridge(action: action, retryCount: retryCount + 1)
                        }
                    } else {
                        self.logger.error("❌ [Swift] handleNotificationAction never became available for '\(action)'")
                    }
                }
            }
        }
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
