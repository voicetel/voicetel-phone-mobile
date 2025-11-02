package com.voicetel.phone;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom CallService plugin BEFORE super.onCreate()
        // In Capacitor 7, registerPlugin() must be called before bridge initialization
        registerPlugin(CallServicePlugin.class);
        Log.d(TAG, "CallServicePlugin registered");
        
        super.onCreate(savedInstanceState);
        
        // Request notification permission for Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Requesting POST_NOTIFICATIONS permission");
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST_CODE
                );
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS permission already granted");
            }
        }
        
        Log.d(TAG, "MainActivity onCreate completed");
        
        // Handle hangup intent from notification
        if (getIntent() != null && "com.voicetel.phone.HANGUP".equals(getIntent().getAction())) {
            Log.d(TAG, "Hangup intent received from notification");
            // JavaScript will handle the hangup via window.location or message
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "POST_NOTIFICATIONS permission granted");
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS permission denied - notifications will not be visible");
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        
        // Handle hangup intent from notification
        if (intent != null && "com.voicetel.phone.HANGUP".equals(intent.getAction())) {
            Log.d(TAG, "Hangup intent received from notification (onNewIntent)");
        }
    }

    public void startCallService(String callNumber) {
        Intent serviceIntent = new Intent(this, CallForegroundService.class);
        if (callNumber != null && !callNumber.isEmpty()) {
            serviceIntent.putExtra("callNumber", callNumber);
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        Log.d(TAG, "Call service started for: " + callNumber);
    }

    public void stopCallService() {
        Intent serviceIntent = new Intent(this, CallForegroundService.class);
        stopService(serviceIntent);
        Log.d(TAG, "Call service stopped");
    }

    public void updateCallServiceNumber(String callNumber) {
        Intent serviceIntent = new Intent(this, CallForegroundService.class);
        serviceIntent.putExtra("callNumber", callNumber);
        // Start or update service
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
}
