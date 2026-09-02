package com.lapauseclub.manager;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import android.os.Build;

public class SessionAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String stationName = intent != null ? intent.getStringExtra("stationName") : null;
        String sessionId = intent != null ? intent.getStringExtra("sessionId") : null;
        String alertType = intent != null ? intent.getStringExtra("alertType") : null;
        String station = stationName == null ? "Poste" : stationName;
        if (sessionId != null && !isStillActive(context, sessionId)) return;
        boolean warning = "warning".equals(alertType);
        boolean critical = "critical".equals(alertType);
        String title = critical ? "⚠ " + station + " · DÉPASSEMENT CRITIQUE" : warning ? station + " · bientôt terminé" : station + " · TEMPS ÉCOULÉ";
        String text = critical
                ? "La session apparaît toujours active 5 minutes après la fin prévue. Intervention immédiate."
                : warning ? "La session arrive bientôt à sa fin. Encaisse une prolongation avant de continuer."
                : "La session est arrivée à sa fin. Contrôle le poste immédiatement.";
        int base = sessionId == null ? (int) System.currentTimeMillis() : sessionId.hashCode();
        int id = critical ? base ^ 0x63C3 : warning ? base ^ 0x45A1 : base ^ 0x79B2;
        showNotification(context, id, title, text);
    }

    private static boolean isStillActive(Context context, String sessionId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("gaming_floor_store", Context.MODE_PRIVATE);
            String raw = prefs.getString("state_json", "");
            if (raw.isEmpty()) return true;
            JSONArray arr = new JSONObject(raw).optJSONArray("sessions");
            if (arr == null) return true;
            for (int i=0;i<arr.length();i++) {
                JSONObject s = arr.optJSONObject(i);
                if (s != null && sessionId.equals(s.optString("id"))) {
                    String status = s.optString("status", "");
                    return "active".equals(status) || "paused".equals(status);
                }
            }
        } catch (Exception ignored) {}
        return true;
    }

    public static void showNotification(Context context, int id, String title, String text) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(context,id,launch,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, MainActivity.CHANNEL_ID)
                : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true).setContentIntent(contentIntent)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_MAX)
                .setDefaults(Notification.DEFAULT_ALL);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(id, builder.build());
    }
}
