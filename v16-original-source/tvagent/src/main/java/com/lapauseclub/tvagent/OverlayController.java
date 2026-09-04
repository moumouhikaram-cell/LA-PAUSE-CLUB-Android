package com.lapauseclub.tvagent;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

final class OverlayController {
    private final Context context;
    private final WindowManager windowManager;
    private final Handler main = new Handler(Looper.getMainLooper());
    private View currentView;
    private Runnable pendingRemoval;

    OverlayController(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
    }

    boolean canDraw() {
        return Settings.canDrawOverlays(context) && windowManager != null;
    }

    boolean show(String type, JSONObject payload) {
        if (!canDraw()) return false;
        final String safeType = type == null ? "SHOW_MESSAGE" : type;
        final JSONObject safePayload = payload == null ? new JSONObject() : payload;
        main.post(() -> showOnMain(safeType, safePayload));
        return true;
    }

    void clear() {
        main.post(this::removeCurrent);
    }

    private void showOnMain(String type, JSONObject payload) {
        removeCurrent();
        if (!canDraw()) return;
        try {
            LinearLayout card = new LinearLayout(context);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(28), dp(18), dp(28), dp(18));
            GradientDrawable background = new GradientDrawable();
            background.setCornerRadius(dp(18));
            background.setStroke(dp(2), accent(type));
            background.setColor(Color.argb(238, 7, 12, 24));
            card.setBackground(background);
            card.setElevation(dp(14));

            TextView kicker = new TextView(context);
            kicker.setText(kicker(type));
            kicker.setTextColor(accent(type));
            kicker.setTextSize(13);
            kicker.setTypeface(Typeface.DEFAULT_BOLD);
            card.addView(kicker, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

            TextView message = new TextView(context);
            message.setText(message(type, payload));
            message.setTextColor(Color.WHITE);
            message.setTextSize(type.equals("SESSION_END") ? 26 : 22);
            message.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            messageParams.topMargin = dp(5);
            card.addView(message, messageParams);

            String station = payload.optString("stationName", "").trim();
            long remaining = payload.optLong("remainingSeconds", -1L);
            if (!station.isEmpty() || remaining >= 0) {
                TextView meta = new TextView(context);
                StringBuilder text = new StringBuilder();
                if (!station.isEmpty()) text.append(station);
                if (remaining >= 0) {
                    if (text.length() > 0) text.append("  ·  ");
                    long mins = remaining / 60L;
                    long secs = remaining % 60L;
                    text.append(String.format(java.util.Locale.US, "%02d:%02d", mins, secs));
                }
                meta.setText(text.toString());
                meta.setTextColor(Color.rgb(190, 199, 216));
                meta.setTextSize(14);
                LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                metaParams.topMargin = dp(6);
                card.addView(meta, metaParams);
            }

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    android.graphics.PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = dp(34);
            params.width = Math.min(dp(900), Math.max(dp(460), context.getResources().getDisplayMetrics().widthPixels - dp(80)));
            windowManager.addView(card, params);
            currentView = card;

            pendingRemoval = this::removeCurrent;
            main.postDelayed(pendingRemoval, duration(type));
        } catch (Exception ignored) {
            removeCurrent();
        }
    }

    private String kicker(String type) {
        switch (type) {
            case "SESSION_START": return "LA PAUSE · SESSION DÉMARRÉE";
            case "SESSION_WARNING": return "LA PAUSE · TEMPS PRESQUE ÉCOULÉ";
            case "SESSION_END": return "LA PAUSE · SESSION TERMINÉE";
            default: return "LA PAUSE CLUB";
        }
    }

    private String message(String type, JSONObject payload) {
        String custom = payload.optString("text", "").trim();
        if (!custom.isEmpty()) return custom;
        switch (type) {
            case "SESSION_START": return "Bonne partie !";
            case "SESSION_WARNING": return "Il reste quelques minutes à votre session.";
            case "SESSION_END": return "Votre temps est terminé. Merci !";
            default: return "Message LA PAUSE";
        }
    }

    private int accent(String type) {
        switch (type) {
            case "SESSION_WARNING": return Color.rgb(255, 166, 55);
            case "SESSION_END": return Color.rgb(255, 86, 86);
            case "SESSION_START": return Color.rgb(87, 220, 146);
            default: return Color.rgb(255, 108, 55);
        }
    }

    private long duration(String type) {
        switch (type) {
            case "SESSION_START": return 4500L;
            case "SESSION_WARNING": return 9000L;
            case "SESSION_END": return 15000L;
            default: return 8000L;
        }
    }

    private int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private void removeCurrent() {
        if (pendingRemoval != null) main.removeCallbacks(pendingRemoval);
        pendingRemoval = null;
        if (currentView != null && windowManager != null) {
            try { windowManager.removeViewImmediate(currentView); } catch (Exception ignored) {}
        }
        currentView = null;
    }
}
