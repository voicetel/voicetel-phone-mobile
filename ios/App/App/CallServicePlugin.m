#import <Capacitor/Capacitor.h>
#import <Foundation/Foundation.h>

CAP_PLUGIN(CallServicePlugin, "CallService",
  CAP_PLUGIN_METHOD(startCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(startOutgoingCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(stopCall, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(updateCallNumber, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(isServiceRunning, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(dismissIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(reportCallConnected, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(reportOutgoingCallStartedConnecting, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(setCallMuted, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(setCallHeld, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(saveRecording, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getSupportedFormats, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getRecordingFileUrl, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(deleteRecordingFile, CAPPluginReturnPromise);
)
