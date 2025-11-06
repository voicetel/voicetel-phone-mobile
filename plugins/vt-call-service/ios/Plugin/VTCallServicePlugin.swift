import Foundation
import Capacitor

@objc(VTCallServicePlugin)
public class VTCallServicePlugin: CAPPlugin {
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

