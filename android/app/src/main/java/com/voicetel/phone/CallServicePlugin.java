package com.voicetel.phone;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallService")
public class CallServicePlugin extends Plugin {

    @PluginMethod
    public void startCall(PluginCall call) {
        String callNumber = call.getString("callNumber", "");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.startCallService(callNumber);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void stopCall(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.stopCallService();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void updateCallNumber(PluginCall call) {
        String callNumber = call.getString("callNumber", "");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.updateCallServiceNumber(callNumber);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void isServiceRunning(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            boolean isRunning = activity.isCallServiceRunning();

            JSObject ret = new JSObject();
            ret.put("isRunning", isRunning);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void showIncomingCallNotification(PluginCall call) {
        String callerName = call.getString("callerName", "Unknown");
        String callerNumber = call.getString("callerNumber", "");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.showIncomingCallNotification(callerName, callerNumber);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void dismissIncomingCallNotification(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.dismissIncomingCallNotification();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void updateCallState(PluginCall call) {
        String state = call.getString("state", "connected");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.updateCallState(state);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void setCallMuted(PluginCall call) {
        Boolean muted = call.getBoolean("muted", false);

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.updateCallMuted(muted);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void setCallHeld(PluginCall call) {
        Boolean onHold = call.getBoolean("onHold", false);

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.updateCallHeld(onHold);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void saveRecording(PluginCall call) {
        String filename = call.getString("filename", "");
        String data = call.getString("data", "");
        String mimeType = call.getString("mimeType", "audio/webm");
        String convertToFormat = call.getString("convertToFormat", null); // Optional: "mp3", "wav", etc.

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            try {
                String filePath;
                if (convertToFormat != null && !convertToFormat.isEmpty()) {
                    // Request format conversion
                    filePath = activity.saveRecordingFileWithConversion(filename, data, mimeType, convertToFormat);
                } else {
                    // Save as-is
                    filePath = activity.saveRecordingFile(filename, data, mimeType);
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("filePath", filePath);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to save recording: " + e.getMessage());
            }
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void getSupportedFormats(PluginCall call) {
        // Returns formats that MediaRecorder supports (from JavaScript)
        // Native Android MediaRecorder supports more formats, but we use WebView MediaRecorder
        JSObject ret = new JSObject();
        ret.put("formats", new String[]{
            "webm", "ogg", "m4a", "mp4"
        });
        ret.put("note", "MP3 conversion requires additional library. Currently recording in WebM/Opus format.");
        call.resolve(ret);
    }

    @PluginMethod
    public void getRecordingFileUrl(PluginCall call) {
        String filename = call.getString("filename", "");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            try {
                // Read file and convert to base64 data URL for WebView compatibility
                String dataUrl = activity.getRecordingFileAsDataUrl(filename);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("url", dataUrl);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get file URL: " + e.getMessage());
            }
        } else {
            call.reject("Activity not available");
        }
    }

    @PluginMethod
    public void deleteRecordingFile(PluginCall call) {
        String filename = call.getString("filename", "");

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            try {
                boolean deleted = activity.deleteRecordingFile(filename);

                JSObject ret = new JSObject();
                ret.put("success", deleted);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to delete file: " + e.getMessage());
            }
        } else {
            call.reject("Activity not available");
        }
    }
}
