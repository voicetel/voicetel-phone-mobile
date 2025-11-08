#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VTCallServicePlugin, "VTCallService",
  CAP_PLUGIN_METHOD(getRecordingFileUrl, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(dismissIncomingCallNotification, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(reportCallConnected, CAPPluginReturnPromise);
);


