package com.lapauseclub.tvagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONObject;

public class AgentService extends Service {
    static final String ACTION_TEST_OVERLAY = "com.lapauseclub.tvagent.TEST_OVERLAY";
    static final String ACTION_RESTART = "com.lapauseclub.tvagent.RESTART_AGENT";
    private static final String CHANNEL_ID = "la_pause_tv_agent";
    private static final int NOTIFICATION_ID = 2401;

    private AgentConfig config;
    private OverlayController overlay;
    private AgentHttpServer server;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        config = new AgentConfig(this);
        overlay = new OverlayController(this);
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Démarrage du serveur local…"));
        startServer();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? "" : intent.getAction();
        if (ACTION_TEST_OVERLAY.equals(action)) {
            try {
                JSONObject payload = new JSONObject();
                payload.put("text", "Test overlay LA PAUSE — visible au-dessus du jeu ?");
                overlay.show("SHOW_MESSAGE", payload);
            } catch (Exception ignored) {}
        } else if (ACTION_RESTART.equals(action)) {
            restartServer();
        } else if (server == null || server.port() <= 0) {
            startServer();
        }
        return START_STICKY;
    }

    private void startServer() {
        try {
            if (server == null) {
                server = new AgentHttpServer(config, new AgentHttpServer.CommandExecutor() {
                    @Override public boolean showOverlay(String type, JSONObject payload) {
                        if (!config.overlayReady()) return false;
                        return overlay.show(type, payload);
                    }
                    @Override public void restartAgent() {
                        main.postDelayed(AgentService.this::restartServer, 350L);
                    }
                });
            }
            int port = server.start();
            updateNotification("Agent ONLINE · port " + port);
        } catch (Exception ex) {
            config.setRuntime(0, "ERROR", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
            updateNotification("Agent en erreur · ouvre l'app pour diagnostiquer");
        }
    }

    private void restartServer() {
        if (server != null) server.stop();
        main.postDelayed(this::startServer, 300L);
    }

    private void createChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "LA PAUSE TV Agent", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Connexion locale LA PAUSE OS");
        manager.createNotificationChannel(channel);
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, AgentActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle(config == null ? "LA PAUSE TV Agent" : config.name())
                .setContentText(text)
                .setContentIntent(content)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification(text));
    }

    @Override
    public void onDestroy() {
        if (server != null) server.shutdown();
        if (overlay != null) overlay.clear();
        server = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
