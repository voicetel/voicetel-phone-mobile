package com.voicetel.phone;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;
    private static final String INCOMING_CALL_CHANNEL_ID = "voicetel_incoming_call_channel";
    private static final int INCOMING_CALL_NOTIFICATION_ID = 2;

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
        
        // Create incoming call notification channel
        createIncomingCallNotificationChannel();
        
        // Handle intents from notifications
        Intent intent = getIntent();
        if (intent != null) {
            handleNotificationIntents(intent);
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
        
        // Handle intents from notifications
        if (intent != null) {
            handleNotificationIntents(intent);
        }
    }
    
    private void handleNotificationIntents(Intent intent) {
        String action = intent.getAction();
        if (action != null) {
            if ("com.voicetel.phone.ANSWER_CALL".equals(action)) {
                Log.d(TAG, "Answer call intent received from notification");
                sendMessageToJavaScript("ANSWER_CALL", null);
            } else if ("com.voicetel.phone.DECLINE_CALL".equals(action)) {
                Log.d(TAG, "Decline call intent received from notification");
                sendMessageToJavaScript("DECLINE_CALL", null);
            } else if ("com.voicetel.phone.HANGUP".equals(action)) {
                Log.d(TAG, "Hangup intent received from notification");
                sendMessageToJavaScript("HANGUP", null);
            }
        } else if (intent.getBooleanExtra("fromNotification", false)) {
            Log.d(TAG, "Activity resumed from notification (onNewIntent) - injecting JavaScript flag to skip re-registration");
            // Inject JavaScript flag to prevent re-registration when returning from notification
            // The flag will be checked in reRegister() function
            runOnUiThread(() -> {
                // Inject flag immediately - WebView should be ready since activity already exists
                try {
                    String js = "if (typeof window !== 'undefined') { window.__skipReRegisterForNotification = true; console.log('Set __skipReRegisterForNotification flag (immediate)'); }";
                    getBridge().getWebView().evaluateJavascript(js, null);
                    Log.d(TAG, "Injected JavaScript flag to skip re-registration (immediate)");
                    // Also try with a small delay as backup
                    getBridge().getWebView().postDelayed(() -> {
                        try {
                            String js2 = "if (typeof window !== 'undefined') { window.__skipReRegisterForNotification = true; console.log('Set __skipReRegisterForNotification flag (delayed backup)'); }";
                            getBridge().getWebView().evaluateJavascript(js2, null);
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to inject JavaScript flag (backup)", e);
                        }
                    }, 100);
                    // Clear the flag after 3 seconds to allow normal re-registration later
                    getBridge().getWebView().postDelayed(() -> {
                        String clearJs = "if (typeof window !== 'undefined') { window.__skipReRegisterForNotification = false; console.log('Cleared __skipReRegisterForNotification flag'); }";
                        getBridge().getWebView().evaluateJavascript(clearJs, null);
                    }, 3000);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to inject JavaScript flag", e);
                }
            });
        }
    }
    
    private void createIncomingCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                INCOMING_CALL_CHANNEL_ID,
                "VoiceTel Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH // High importance for incoming calls
            );
            channel.setDescription("Notifications for incoming phone calls");
            channel.setShowBadge(true);
            channel.enableVibration(true);
            channel.enableLights(true);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Incoming call notification channel created");
            }
        }
    }
    
    public void showIncomingCallNotification(String callerName, String callerNumber) {
        Log.d(TAG, "Showing incoming call notification for: " + callerName + " " + callerNumber);
        
        // Create intent for opening app (Answer action)
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setAction("com.voicetel.phone.ANSWER_CALL");
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(
            this,
            0,
            answerIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        // Create intent for declining call
        Intent declineIntent = new Intent(this, MainActivity.class);
        declineIntent.setAction("com.voicetel.phone.DECLINE_CALL");
        declineIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent declinePendingIntent = PendingIntent.getActivity(
            this,
            1,
            declineIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        // Build notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, INCOMING_CALL_CHANNEL_ID)
            .setContentTitle("Incoming Call")
            .setContentText(callerName + "\n" + callerNumber)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(answerPendingIntent, true) // Show full-screen on lock screen
            .addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(null) // We'll use vibration instead
            .setVibrate(new long[]{0, 250, 250, 250})
            .setLights(0xFF0000FF, 500, 500);
        
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(INCOMING_CALL_NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Incoming call notification displayed");
        }
    }
    
    public void dismissIncomingCallNotification() {
        Log.d(TAG, "Dismissing incoming call notification");
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(INCOMING_CALL_NOTIFICATION_ID);
            Log.d(TAG, "Incoming call notification dismissed");
        }
    }
    
    private void sendMessageToJavaScript(String action, String data) {
        runOnUiThread(() -> {
            getBridge().getWebView().postDelayed(() -> {
                try {
                    String js = String.format(
                        "if (typeof window !== 'undefined' && typeof window.handleNotificationAction === 'function') { " +
                        "window.handleNotificationAction('%s', %s); " +
                        "} else { " +
                        "console.log('handleNotificationAction not available, action: %s'); " +
                        "}",
                        action,
                        data != null ? "'" + data + "'" : "null",
                        action
                    );
                    getBridge().getWebView().evaluateJavascript(js, null);
                    Log.d(TAG, "Sent notification action to JavaScript: " + action);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send notification action to JavaScript", e);
                }
            }, 500);
        });
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

    public boolean isCallServiceRunning() {
        ActivityManager manager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (CallForegroundService.class.getName().equals(service.service.getClassName())) {
                Log.d(TAG, "CallForegroundService is running");
                return true;
            }
        }
        Log.d(TAG, "CallForegroundService is NOT running");
        return false;
    }
}
