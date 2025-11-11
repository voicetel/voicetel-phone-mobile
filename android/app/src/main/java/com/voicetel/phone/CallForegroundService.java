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
    private String callState = "dialing"; // dialing, ringing, connecting, connected, on_hold
    private boolean isMuted = false;
    private boolean isOnHold = false;
    private long callStartTime = 0;

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

        // Get call number and state from intent
        if (intent != null) {
            callNumber = intent.getStringExtra("callNumber");
            if (callNumber == null) {
                callNumber = "Active Call";
            }

            String newState = intent.getStringExtra("callState");
            if (newState != null) {
                callState = newState;
                if ("connected".equals(newState) && callStartTime == 0) {
                    callStartTime = System.currentTimeMillis();
                }
            }

            if (intent.hasExtra("isMuted")) {
                isMuted = intent.getBooleanExtra("isMuted", false);
            }

            if (intent.hasExtra("isOnHold")) {
                isOnHold = intent.getBooleanExtra("isOnHold", false);
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

        // Create mute/unmute action
        Intent muteIntent = new Intent(this, MainActivity.class);
        muteIntent.setAction(isMuted ? "com.voicetel.phone.UNMUTE" : "com.voicetel.phone.MUTE");
        PendingIntent mutePendingIntent = PendingIntent.getActivity(
            this,
            2,
            muteIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Create hold/unhold action
        Intent holdIntent = new Intent(this, MainActivity.class);
        holdIntent.setAction(isOnHold ? "com.voicetel.phone.UNHOLD" : "com.voicetel.phone.HOLD");
        PendingIntent holdPendingIntent = PendingIntent.getActivity(
            this,
            3,
            holdIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Build notification text based on state
        String contentText = buildNotificationText();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VoiceTel Call")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority - no heads-up
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setShowWhen(false);

        // Add action buttons for connected calls
        if ("connected".equals(callState)) {
            builder.addAction(
                isMuted ? android.R.drawable.ic_lock_silent_mode_off : android.R.drawable.ic_lock_silent_mode,
                isMuted ? "Unmute" : "Mute",
                mutePendingIntent
            );
            builder.addAction(
                android.R.drawable.ic_media_pause,
                isOnHold ? "Resume" : "Hold",
                holdPendingIntent
            );
        }

        // Always add hangup button
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Hang Up", hangupPendingIntent);

        return builder.build();
    }

    private String buildNotificationText() {
        StringBuilder text = new StringBuilder();

        // Add number/name
        if (!callNumber.isEmpty() && !"Active Call".equals(callNumber)) {
            text.append(callNumber);
        }

        // Add state
        if ("dialing".equals(callState)) {
            if (text.length() > 0) text.append(" • ");
            text.append("Dialing...");
        } else if ("ringing".equals(callState)) {
            if (text.length() > 0) text.append(" • ");
            text.append("Ringing...");
        } else if ("connecting".equals(callState)) {
            if (text.length() > 0) text.append(" • ");
            text.append("Connecting...");
        } else if ("connected".equals(callState)) {
            // Add call duration
            if (callStartTime > 0) {
                long duration = (System.currentTimeMillis() - callStartTime) / 1000;
                long minutes = duration / 60;
                long seconds = duration % 60;
                if (text.length() > 0) text.append(" • ");
                text.append(String.format("%02d:%02d", minutes, seconds));
            }

            // Add mute/hold status
            if (isOnHold) {
                text.append(" • On Hold");
            } else if (isMuted) {
                text.append(" • Muted");
            }
        } else if ("on_hold".equals(callState)) {
            if (text.length() > 0) text.append(" • ");
            text.append("On Hold");
        }

        if (text.length() == 0) {
            text.append("Active Call");
        }

        return text.toString();
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
        updateNotification();
    }

    public void updateCallState(String state) {
        callState = state;
        if ("connected".equals(state) && callStartTime == 0) {
            callStartTime = System.currentTimeMillis();
        }
        updateNotification();
    }

    public void updateMuteState(boolean muted) {
        isMuted = muted;
        updateNotification();
    }

    public void updateHoldState(boolean onHold) {
        isOnHold = onHold;
        updateNotification();
    }

    private void updateNotification() {
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
