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
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import com.lapauseclub.manager.core.CoreStore;
import com.lapauseclub.manager.security.AppIntegrity;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class NewAppActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final String ENTRY = ASSET_PREFIX + "v250/index.html";
    private static final int AUTH_ITERATIONS = 120000;
    private static final int AUTH_BITS = 256;
    private WebView webView;
    private CoreStore coreStore;
    private boolean exitDialogVisible;
    private OnBackInvokedCallback backInvokedCallback;

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = this::handleBackNavigation;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    backInvokedCallback
            );
        }
    }

    private static boolean trusted(String url) {
        if (url == null) return false;
        return url.startsWith(ASSET_PREFIX + "v250/") || "about:blank".equals(url);
    }

    private void handleBackNavigation() {
        if (webView == null) { confirmExit(); return; }
        webView.evaluateJavascript("window.nativeBack ? window.nativeBack() : false", value -> {
            if (!"true".equals(value)) confirmExit();
        });
    }

    @Override public void onBackPressed() { handleBackNavigation(); }

    private void confirmExit() {
        if (exitDialogVisible || isFinishing()) return;
        exitDialogVisible = true;
        new AlertDialog.Builder(this)
                .setTitle("Quitter LA PAUSE OS ?")
                .setMessage("Vos données sont enregistrées. Voulez-vous vraiment fermer l’application ?")
                .setNegativeButton("Rester", (d, w) -> exitDialogVisible = false)
                .setPositiveButton("Quitter", (d, w) -> {
                    exitDialogVisible = false;
                    finish();
                })
                .setOnCancelListener(d -> exitDialogVisible = false)
                .show();
    }

    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
            backInvokedCallback = null;
        }
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
        private final SharedPreferences authPrefs = getSharedPreferences("la_pause_local_auth", MODE_PRIVATE);

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

        @JavascriptInterface public String verifyLocalBackup() {
            JSONObject result = new JSONObject();
            try {
                String primary = prefs.getString("state_json", "");
                if (primary == null || primary.trim().isEmpty()) {
                    result.put("verified", false).put("code", "NO_STATE");
                    return result.toString();
                }
                String canonical = new JSONObject(primary).toString();
                byte[] source = canonical.getBytes(StandardCharsets.UTF_8);
                File dir = new File(getFilesDir(), "verified-backups");
                if (!dir.exists() && !dir.mkdirs()) {
                    result.put("verified", false).put("code", "BACKUP_DIR_FAILED");
                    return result.toString();
                }
                long at = System.currentTimeMillis();
                File target = new File(dir, "state-" + at + ".json");
                try (FileOutputStream out = new FileOutputStream(target, false)) {
                    out.write(source);
                    out.flush();
                    out.getFD().sync();
                }
                byte[] copy;
                try (FileInputStream in = new FileInputStream(target); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = in.read(chunk)) != -1) buffer.write(chunk, 0, n);
                    copy = buffer.toByteArray();
                }
                new JSONObject(new String(copy, StandardCharsets.UTF_8));
                String sourceHash = sha256Hex(source);
                String copyHash = sha256Hex(copy);
                boolean verified = MessageDigest.isEqual(sourceHash.getBytes(StandardCharsets.US_ASCII), copyHash.getBytes(StandardCharsets.US_ASCII));
                result.put("verified", verified)
                        .put("scope", "LOCAL_INTERNAL")
                        .put("at", at)
                        .put("sha256", copyHash)
                        .put("bytes", copy.length)
                        .put("code", verified ? "VERIFIED" : "HASH_MISMATCH");
                if (!verified) target.delete();
                rotateVerifiedBackups(dir, target.getName());
                return result.toString();
            } catch (Exception ex) {
                try { result.put("verified", false).put("code", "BACKUP_VERIFY_FAILED"); } catch (Exception ignored) {}
                return result.toString();
            }
        }

        @JavascriptInterface public boolean createLocalCredential(String email, String password) {
            if (email == null || password == null || password.length() < 8) return false;
            try {
                String key = credentialKey(email);
                byte[] salt = new byte[16];
                new SecureRandom().nextBytes(salt);
                byte[] hash = derive(password.toCharArray(), salt, AUTH_ITERATIONS);
                String record = AUTH_ITERATIONS + ":" + b64(salt) + ":" + b64(hash);
                return authPrefs.edit().putString(key, record).commit();
            } catch (Exception ignored) { return false; }
        }

        @JavascriptInterface public boolean verifyLocalCredential(String email, String password) {
            if (email == null || password == null) return false;
            try {
                String record = authPrefs.getString(credentialKey(email), "");
                if (record == null || record.isEmpty()) return false;
                String[] parts = record.split(":", -1);
                if (parts.length != 3) return false;
                int iterations = Integer.parseInt(parts[0]);
                if (iterations < 100000 || iterations > 1000000) return false;
                byte[] salt = Base64.decode(parts[1], Base64.NO_WRAP);
                byte[] expected = Base64.decode(parts[2], Base64.NO_WRAP);
                byte[] actual = derive(password.toCharArray(), salt, iterations);
                return MessageDigest.isEqual(expected, actual);
            } catch (Exception ignored) { return false; }
        }

        @JavascriptInterface public boolean hasLocalCredential(String email) {
            if (email == null) return false;
            try { return authPrefs.contains(credentialKey(email)); }
            catch (Exception ignored) { return false; }
        }

        private String credentialKey(String email) throws Exception {
            String normalized = email.trim().toLowerCase(Locale.ROOT);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return "credential_" + Base64.encodeToString(md.digest(normalized.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP | Base64.URL_SAFE);
        }

        private byte[] derive(char[] password, byte[] salt, int iterations) throws Exception {
            PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, AUTH_BITS);
            try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
            finally { spec.clearPassword(); }
        }

        private String b64(byte[] value) { return Base64.encodeToString(value, Base64.NO_WRAP); }

        private String sha256Hex(byte[] value) throws Exception {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format(Locale.US, "%02x", b & 0xff));
            return sb.toString();
        }

        private void rotateVerifiedBackups(File dir, String keep) {
            File[] files = dir.listFiles((d, name) -> name.startsWith("state-") && name.endsWith(".json"));
            if (files == null || files.length <= 3) return;
            java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            for (int i = 3; i < files.length; i++) if (!files[i].getName().equals(keep)) files[i].delete();
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
            intent.setAction("com.lapauseclub.manager.SESSION_" + type.toUpperCase(Locale.US));
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
