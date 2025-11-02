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
}

