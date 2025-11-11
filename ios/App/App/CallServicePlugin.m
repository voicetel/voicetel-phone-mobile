#import <Capacitor/Capacitor.h>
#import <Foundation/Foundation.h>

// Add load-time logging
__attribute__((constructor))
static void initialize_CallServicePlugin() {
    NSLog(@"🔥🔥🔥 CallServicePlugin.m FILE IS BEING LOADED 🔥🔥🔥");
    NSLog(@"🔥 Registering CallService plugin with Capacitor");
}

CAP_PLUGIN(CallServicePlugin, "CallService",
  CAP_PLUGIN_METHOD(startCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(startOutgoingCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(stopCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(updateCallNumber, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(isServiceRunning, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(dismissIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(reportCallConnected, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(saveRecording, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSupportedFormats, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getRecordingFileUrl, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(deleteRecordingFile, CAPPluginReturnPromise);
)

// Post-registration logging
__attribute__((constructor))
static void verify_CallServicePlugin_registration() {
    NSLog(@"🔥 CAP_PLUGIN macro executed for CallService");
    NSLog(@"🔥 If you see this but plugin still not available, registration failed");
}
