package com.voicetel.vtcallservice;

import android.content.Context;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(name = "VTCallService")
public class VTCallServicePlugin extends Plugin {

    @PluginMethod
    public void getRecordingFileUrl(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.isEmpty()) {
            call.reject("Missing filename");
            return;
        }
        try {
            File file = resolveRecordingFile(getContext(), filename);
            if (file == null || !file.exists()) {
                call.reject("File not found");
                return;
            }
            byte[] bytes = readAllBytes(file);
            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            String mime = guessMime(filename);
            JSObject ret = new JSObject();
            ret.put("url", "data:" + mime + ";base64," + b64);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed: " + ex.getMessage());
        }
    }

    private static File resolveRecordingFile(Context ctx, String filename) {
        // Try app-specific external, then internal, with and without CallRecordings subdir
        File[] roots = new File[] {
            ctx.getExternalFilesDir(null),
            ctx.getFilesDir()
        };
        for (File root : roots) {
            if (root == null) continue;
            File f1 = new File(new File(root, "CallRecordings"), filename);
            if (f1.exists()) return f1;
            File f2 = new File(root, filename);
            if (f2.exists()) return f2;
        }
        return null;
    }

    private static byte[] readAllBytes(File file) throws IOException {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] data = new byte[(int) file.length()];
            int read = 0;
            while (read < data.length) {
                int r = fis.read(data, read, data.length - read);
                if (r < 0) break;
                read += r;
            }
            return data;
        }
    }

    private static String guessMime(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".webm")) return "audio/webm";
        if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        return "application/octet-stream";
    }
}


