import Foundation
import Capacitor
import AVFoundation
import UserNotifications
import os

@objc(VTCallServicePlugin)
public class VTCallServicePlugin: CAPPlugin {
    private var isCallActive: Bool = false
    private var currentCallNumber: String = ""
    private let incomingCallNotificationId = "INCOMING_CALL_NOTIFICATION"
    private let incomingCallCategoryId = "INCOMING_CALL"
    private let logger = Logger(subsystem: "com.voicetel.phone", category: "CallService")

    @objc public func startCall(_ call: CAPPluginCall) {
        self.currentCallNumber = call.getString("callNumber") ?? ""
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .mixWithOthers, .duckOthers, .defaultToSpeaker])
            try session.setActive(true)
            self.isCallActive = true
            logger.info("startCall: activated audio session, number=\(self.currentCallNumber)")
            call.resolve(["success": true])
        } catch {
            logger.error("startCall failed: \(error.localizedDescription)")
            call.reject("Failed to start call: \(error.localizedDescription)")
        }
    }

    @objc public func stopCall(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            self.isCallActive = false
            logger.info("stopCall: deactivated audio session")
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
        let callerName = call.getString("callerName") ?? "Unknown"
        let callerNumber = call.getString("callerNumber") ?? ""
        logger.info("showIncomingCallNotification: name=\(callerName, privacy: .public) number=\(callerNumber, privacy: .public)")

        let content = UNMutableNotificationContent()
        content.title = "Incoming Call"
        content.body = callerName.isEmpty ? callerNumber : "\(callerName)\n\(callerNumber)"
        if #available(iOS 12.0, *) {
            content.sound = UNNotificationSound.defaultCriticalSound(withAudioVolume: 1.0)
        } else {
            content.sound = .default
        }
        content.categoryIdentifier = incomingCallCategoryId
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .critical
        }

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(identifier: incomingCallNotificationId, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                self.logger.error("showIncomingCallNotification failed: \(error.localizedDescription)")
                call.reject("Failed to show notification: \(error.localizedDescription)")
            } else {
                self.logger.debug("showIncomingCallNotification: scheduled")
                call.resolve(["success": true])
            }
        }
    }

    @objc public func dismissIncomingCallNotification(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [incomingCallNotificationId])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [incomingCallNotificationId])
        logger.debug("dismissIncomingCallNotification")
        call.resolve(["success": true])
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


