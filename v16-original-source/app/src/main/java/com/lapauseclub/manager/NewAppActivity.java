package com.lapauseclub.manager;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.lapauseclub.manager.core.CoreStore;
import com.lapauseclub.manager.security.AppIntegrity;

import org.json.JSONObject;

public final class NewAppActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final String ENTRY = ASSET_PREFIX + "v250/index.html";
    private WebView webView;
    private CoreStore coreStore;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (!AppIntegrity.isAllowedToBoot(this)) {
            new AlertDialog.Builder(this)
                    .setTitle("LA PAUSE OS · Intégrité")
                    .setMessage("Cette installation ne correspond pas à une build LA PAUSE OS autorisée.")
                    .setCancelable(false)
                    .setPositiveButton("Fermer", (d, w) -> finishAndRemoveTask())
                    .show();
            return;
        }

        coreStore = new CoreStore(getApplicationContext());
        SharedPreferences prefs = getSharedPreferences("gaming_floor_store", MODE_PRIVATE);
        String legacy = prefs.getString("state_json", "");
        if (legacy != null && !legacy.trim().isEmpty()) coreStore.bootstrapFromLegacy(legacy);

        webView = new WebView(this);
        setContentView(webView);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request == null ? null : request.getUrl();
                return u == null || !trusted(u.toString());
            }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return !trusted(url); }
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (!trusted(url)) { view.stopLoading(); return; }
                super.onPageStarted(view, url, favicon);
            }
        });

        webView.addJavascriptInterface(new NewBridge(), "Android");
        webView.addJavascriptInterface(new SyncBridgeV12(coreStore), "AndroidSync");
        webView.loadUrl(ENTRY);
    }

    private static boolean trusted(String url) {
        if (url == null) return false;
        return url.startsWith(ASSET_PREFIX + "v250/") || "about:blank".equals(url);
    }

    @Override public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.nativeBack ? window.nativeBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override protected void onDestroy() {
        if (coreStore != null) coreStore.close();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidSync");
            webView.removeJavascriptInterface("Android");
            webView.destroy();
        }
        super.onDestroy();
    }

    public final class NewBridge {
        private final SharedPreferences prefs = getSharedPreferences("gaming_floor_store", MODE_PRIVATE);

        @JavascriptInterface public String getStateJson() {
            String primary = prefs.getString("state_json", "");
            try { if (primary != null && !primary.isEmpty()) { new JSONObject(primary); return primary; } } catch (Exception ignored) {}
            String backup = prefs.getString("state_json_backup", "");
            try { if (backup != null && !backup.isEmpty()) { new JSONObject(backup); return backup; } } catch (Exception ignored) {}
            return coreStore == null ? "" : coreStore.recoverLatestValidStateJson();
        }

        @JavascriptInterface public void setStateJson(String json) {
            if (json == null || json.trim().isEmpty()) return;
            try {
                JSONObject parsed = new JSONObject(json);
                String previous = prefs.getString("state_json", "");
                SharedPreferences.Editor e = prefs.edit();
                if (previous != null && !previous.isEmpty()) e.putString("state_json_backup", previous);
                e.putString("state_json", parsed.toString()).apply();
                if (coreStore != null) coreStore.mirrorLegacyState(parsed.toString());
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public String getOperatingMode() { return coreStore == null ? "AUTONOME" : coreStore.getOperatingMode(); }
        @JavascriptInterface public boolean setOperatingMode(String mode) {
            try { if (coreStore == null) return false; coreStore.setOperatingMode(mode); return true; }
            catch (Exception ignored) { return false; }
        }

        @JavascriptInterface public void keepScreenOn(boolean enabled) {
            runOnUiThread(() -> {
                if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface public void scheduleSessionAlerts(String sessionId, long endAt, long warningAt, String stationName) {
            scheduleOne(sessionId, stationName, "warning", warningAt, sessionId.hashCode() ^ 0x45A1);
            scheduleOne(sessionId, stationName, "end", endAt, sessionId.hashCode() ^ 0x79B2);
            scheduleOne(sessionId, stationName, "critical", endAt + 5 * 60000L, sessionId.hashCode() ^ 0x63C3);
        }

        @JavascriptInterface public void cancelSessionEnd(String sessionId) {
            if (sessionId == null) return;
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            for (int code : new int[]{sessionId.hashCode() ^ 0x45A1, sessionId.hashCode() ^ 0x79B2, sessionId.hashCode() ^ 0x63C3}) {
                Intent intent = new Intent(NewAppActivity.this, SessionAlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(NewAppActivity.this, code, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            }
        }

        @JavascriptInterface public String getDeviceInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("manufacturer", Build.MANUFACTURER);
                o.put("model", Build.MODEL);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("release", Build.VERSION.RELEASE);
                o.put("androidId", Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        private void scheduleOne(String sessionId, String stationName, String type, long at, int requestCode) {
            if (sessionId == null || at <= System.currentTimeMillis()) return;
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(NewAppActivity.this, SessionAlarmReceiver.class);
            intent.setAction("com.lapauseclub.manager.SESSION_" + type.toUpperCase());
            intent.putExtra("sessionId", sessionId);
            intent.putExtra("stationName", stationName == null ? "Poste" : stationName);
            intent.putExtra("alertType", type);
            PendingIntent pi = PendingIntent.getBroadcast(NewAppActivity.this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (SecurityException e) { am.set(AlarmManager.RTC_WAKEUP, at, pi); }
        }
    }
}
