import Foundation
import Capacitor
import AVFoundation
import CallKit
import os

@objc(VTCallServicePlugin)
public class VTCallServicePlugin: CAPPlugin, CXProviderDelegate {
    private let logger = Logger(subsystem: "com.voicetel.phone", category: "VTCallService")
    
    // CallKit components
    private var callProvider: CXProvider?
    private var callController: CXCallController?
    private var currentCallUUID: UUID?
    
    override public func load() {
        super.load()
        setupCallKit()
    }
    
    private func setupCallKit() {
        let configuration = CXProviderConfiguration(localizedName: "VoiceTel Phone")
        configuration.supportsVideo = false
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber]
        configuration.iconTemplateImageData = nil
        configuration.ringtoneSound = "default"
        
        callProvider = CXProvider(configuration: configuration)
        callProvider?.setDelegate(self, queue: nil)
        callController = CXCallController()
        
        logger.info("CallKit initialized")
    }
    
    @objc public func showIncomingCallNotification(_ call: CAPPluginCall) {
        let callerName = call.getString("callerName") ?? "Unknown"
        let callerNumber = call.getString("callerNumber") ?? ""
        logger.info("showIncomingCallNotification: name=\(callerName, privacy: .public) number=\(callerNumber, privacy: .public)")

        let callUUID = UUID()
        currentCallUUID = callUUID
        
        let handle = CXHandle(type: .phoneNumber, value: callerNumber)
        let callUpdate = CXCallUpdate()
        callUpdate.remoteHandle = handle
        callUpdate.localizedCallerName = callerName.isEmpty ? callerNumber : callerName
        callUpdate.hasVideo = false
        
        callProvider?.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
            if let error = error {
                self.logger.error("showIncomingCallNotification failed: \(error.localizedDescription)")
                call.reject("Failed to show call: \(error.localizedDescription)")
            } else {
                self.logger.info("showIncomingCallNotification: CallKit call reported")
                call.resolve(["success": true])
            }
        }
    }
    
    @objc public func dismissIncomingCallNotification(_ call: CAPPluginCall) {
        if let callUUID = currentCallUUID {
            let endCallAction = CXEndCallAction(call: callUUID)
            let transaction = CXTransaction(action: endCallAction)
            
            callController?.request(transaction) { error in
                if let error = error {
                    self.logger.error("dismissIncomingCallNotification failed: \(error.localizedDescription)")
                } else {
                    self.logger.debug("dismissIncomingCallNotification: call ended")
                }
            }
            
            currentCallUUID = nil
        }
        call.resolve(["success": true])
    }
    
    @objc public func reportCallConnected(_ call: CAPPluginCall) {
        if let callUUID = currentCallUUID {
            let answerAction = CXAnswerCallAction(call: callUUID)
            let transaction = CXTransaction(action: answerAction)
            
            callController?.request(transaction) { error in
                if let error = error {
                    self.logger.error("reportCallConnected failed: \(error.localizedDescription)")
                    call.reject("Failed to report call connected: \(error.localizedDescription)")
                } else {
                    self.logger.debug("reportCallConnected: CallKit call answered")
                    call.resolve(["success": true])
                }
            }
        } else {
            logger.debug("reportCallConnected: No active call UUID")
            call.resolve(["success": false, "message": "No active call"])
        }
    }
    
    // MARK: - CXProviderDelegate
    
    public func providerDidReset(_ provider: CXProvider) {
        logger.debug("CallKit provider did reset")
        currentCallUUID = nil
    }
    
    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        logger.info("CallKit: Answer call action")
        notifyBridge(action: "ANSWER_CALL")
        action.fulfill()
    }
    
    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        logger.info("CallKit: End call action")
        if currentCallUUID == action.callUUID {
            notifyBridge(action: "DECLINE_CALL")
        }
        currentCallUUID = nil
        action.fulfill()
    }
    
    public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        logger.debug("CallKit: Set held call action")
        action.fulfill()
    }
    
    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        logger.debug("CallKit: Set muted call action")
        action.fulfill()
    }
    
    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        logger.info("CallKit audio session activated")
        
        // Configure audio session for VoIP calls
        do {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker])
            logger.info("Audio session configured for voice chat")
            
            // Notify JavaScript that audio session is ready
            notifyBridge(action: "AUDIO_SESSION_ACTIVATED")
        } catch {
            logger.error("Failed to configure audio session: \(error.localizedDescription)")
        }
    }
    
    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        logger.info("CallKit audio session deactivated")
        notifyBridge(action: "AUDIO_SESSION_DEACTIVATED")
    }
    
    private func notifyBridge(action: String) {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                let js = "if (typeof window !== 'undefined' && typeof window.handleNotificationAction === 'function') { window.handleNotificationAction('\(action)', null); } else { console.log('handleNotificationAction not available, action: \(action)'); }"
                bridge.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }
    
    private func candidateRecordingPaths(filename: String) -> [URL] {
        var urls: [URL] = []
        let fm = FileManager.default
        if let appSupport = try? fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false) {
            urls.append(appSupport.appendingPathComponent("CallRecordings/\(filename)", isDirectory: false))
            urls.append(appSupport.appendingPathComponent(filename, isDirectory: false))
        }
        if let documents = try? fm.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false) {
            urls.append(documents.appendingPathComponent("CallRecordings/\(filename)", isDirectory: false))
            urls.append(documents.appendingPathComponent(filename, isDirectory: false))
        }
        return urls
    }

    @objc public func getRecordingFileUrl(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename") else {
            call.reject("Missing filename")
            return
        }
        do {
            let fm = FileManager.default
            guard let fileURL = candidateRecordingPaths(filename: filename).first(where: { fm.fileExists(atPath: $0.path) }) else {
                call.reject("File not found")
                return
            }
            let data = try Data(contentsOf: fileURL)
            let base64 = data.base64EncodedString()
            let mime = guessMime(filename)
            let dataUrl = "data:\(mime);base64,\(base64)"
            call.resolve(["url": dataUrl])
        } catch {
            call.reject("Failed: \(error.localizedDescription)")
        }
    }

    private func guessMime(_ name: String) -> String {
        let lower = name.lowercased()
        if lower.hasSuffix(".webm") { return "audio/webm" }
        if lower.hasSuffix(".m4a") || lower.hasSuffix(".mp4") { return "audio/mp4" }
        if lower.hasSuffix(".mp3") { return "audio/mpeg" }
        if lower.hasSuffix(".wav") { return "audio/wav" }
        if lower.hasSuffix(".ogg") { return "audio/ogg" }
        return "application/octet-stream"
    }
}

