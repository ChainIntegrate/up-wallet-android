package it.chainintegrate.upwallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Keeps UP Wallet running while a dApp is connected. In the background Android freezes the app after
 * a few minutes, and a dApp's request then waits until the user opens UP Wallet by hand (no request
 * notification). A foreground service with an ongoing notification keeps the process out of that freeze.
 * Started and stopped by the page (KeepAlivePlugin) when a WalletConnect session opens or closes.
 */
public class KeepAliveService extends Service {
    static final String CHANNEL = "keepalive";
    static final int ID = 4242;
    static volatile boolean running = false;
    static volatile String lastError = null;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = intent != null ? intent.getStringExtra("text") : null;
        String channelName = intent != null ? intent.getStringExtra("channel") : null;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, channelName != null ? channelName : "UP Wallet", NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent tap = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("UP Wallet")
                .setContentText(text != null ? text : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text != null ? text : ""))
                .setOngoing(true)
                .setContentIntent(tap)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        // Android can refuse (a data sync service's daily time limit exhausted; Android 12+: app not in the
        // foreground). Then the app goes on without it: no crash, the service stops. Android 14+ uses the
        // "special use" type, which has no daily limit.
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(ID, n);
            running = true;
        } catch (Exception e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            running = false;
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    /** Android 15+: a data sync service (Android 10–13 here) has a daily time limit; when it is reached it stops. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        lastError = "time limit reached";
        running = false;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
