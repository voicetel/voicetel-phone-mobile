package com.voicetel.phone;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class CallForegroundService extends Service {
    private static final String TAG = "CallForegroundService";
    private static final String CHANNEL_ID = "voicetel_call_channel";
    private static final int NOTIFICATION_ID = 1;
    
    private PowerManager.WakeLock wakeLock;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;
    private boolean hasAudioFocus = false;
    private String callNumber = "";
    private boolean isCallActive = false;

    // Binder for clients to access the service
    public class LocalBinder extends Binder {
        CallForegroundService getService() {
            return CallForegroundService.this;
        }
    }

    private final IBinder binder = new LocalBinder();

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        
        // Create notification channel
        createNotificationChannel();
        
        // Initialize audio manager
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        // Set up audio focus listener
        audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_GAIN:
                        Log.d(TAG, "Audio focus gained");
                        hasAudioFocus = true;
                        break;
                    case AudioManager.AUDIOFOCUS_LOSS:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                        Log.d(TAG, "Audio focus lost: " + focusChange);
                        hasAudioFocus = false;
                        break;
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        // Get call number from intent
        if (intent != null) {
            callNumber = intent.getStringExtra("callNumber");
            if (callNumber == null) {
                callNumber = "Active Call";
            }
        }
        
        // Start foreground with notification
        startForeground(NOTIFICATION_ID, createNotification());
        
        // Acquire wake lock
        acquireWakeLock();
        
        // Request audio focus
        requestAudioFocus();
        
        isCallActive = true;
        
        return START_STICKY; // Restart if killed
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service destroyed");
        
        // Release wake lock
        releaseWakeLock();
        
        // Abandon audio focus
        abandonAudioFocus();
        
        isCallActive = false;
        
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "VoiceTel Call",
                NotificationManager.IMPORTANCE_LOW // Low priority - prevents sound/vibration
            );
            channel.setDescription("Ongoing call notification");
            channel.setShowBadge(false);
            channel.setSound(null, null); // No sound
            channel.enableVibration(false);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        // Create intent to open app when notification is tapped
        // Use SINGLE_TOP to bring existing activity to front instead of recreating it
        // This preserves JavaScript state and prevents unnecessary re-registration
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        notificationIntent.putExtra("fromNotification", true); // Flag to skip re-registration
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Create hang up action
        Intent hangupIntent = new Intent(this, MainActivity.class);
        hangupIntent.setAction("com.voicetel.phone.HANGUP");
        PendingIntent hangupPendingIntent = PendingIntent.getActivity(
            this,
            1,
            hangupIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VoiceTel Call")
            .setContentText(callNumber.isEmpty() ? "Active Call" : "Call: " + callNumber)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority - no heads-up
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setShowWhen(false)
            .build();
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "VoiceTel::CallWakeLock"
            );
            wakeLock.acquire(10 * 60 * 1000L /*10 minutes*/);
            Log.d(TAG, "Wake lock acquired");
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire wake lock", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            Log.d(TAG, "Wake lock released");
        }
    }

    private void requestAudioFocus() {
        if (audioManager != null) {
            int result = audioManager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN
            );
            
            hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            Log.d(TAG, "Audio focus requested: " + (hasAudioFocus ? "granted" : "denied"));
        }
    }

    private void abandonAudioFocus() {
        if (audioManager != null && audioFocusChangeListener != null) {
            audioManager.abandonAudioFocus(audioFocusChangeListener);
            hasAudioFocus = false;
            Log.d(TAG, "Audio focus abandoned");
        }
    }

    public void updateCallNumber(String number) {
        callNumber = number;
        if (isCallActive) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, createNotification());
            }
        }
    }

    public boolean isCallActive() {
        return isCallActive;
    }
}

