#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VTCallServicePlugin, "VTCallService",
  CAP_PLUGIN_METHOD(getRecordingFileUrl, CAPPluginReturnPromise);
);


