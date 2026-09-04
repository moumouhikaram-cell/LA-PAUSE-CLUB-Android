package com.lapauseclub.manager;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.lapauseclub.manager.core.CoreStore;
import com.lapauseclub.manager.security.AppIntegrity;
import com.lapauseclub.manager.security.EntitlementVerifier;
import com.lapauseclub.manager.security.SecureStore;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    public static final String CHANNEL_ID = "lapause_critical_sessions_v14";
    private static final int REQ_NOTIFICATIONS = 4001;
    private static final int REQ_FILE_CHOOSER = 4002;
    private static final int REQ_SAVE_FILE = 4003;
    private static final String TRUSTED_ASSET_PREFIX = "file:///android_asset/";
    private static final String SYNC_TOKEN_KEY_V2 = "sync.api.token.v2";

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingSaveContent;
    private String pendingSaveMime;
    private final ExecutorService networkPool = Executors.newFixedThreadPool(2);
    private CoreStore coreStore;
    private SecureStore secureStore;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (!AppIntegrity.isAllowedToBoot(this)) {
            showIntegrityBlock();
            return;
        }

        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
        requestExactAlarmPermissionIfNeeded();

        coreStore = new CoreStore(getApplicationContext());
        secureStore = new SecureStore(getApplicationContext());
        SharedPreferences legacyPrefs = getSharedPreferences("gaming_floor_store", MODE_PRIVATE);
        String legacyPrimaryRaw = legacyPrefs.getString("state_json", "");
        String legacyBackupRaw = legacyPrefs.getString("state_json_backup", "");
        String legacyPrimary = sanitizeSyncToken(legacyPrimaryRaw, true);
        String legacyBackup = sanitizeSyncToken(legacyBackupRaw, true);
        if (!legacyPrimary.equals(legacyPrimaryRaw) || !legacyBackup.equals(legacyBackupRaw)) {
            SharedPreferences.Editor migration = legacyPrefs.edit();
            if (!legacyPrimary.equals(legacyPrimaryRaw)) migration.putString("state_json", legacyPrimary);
            if (!legacyBackup.equals(legacyBackupRaw)) migration.putString("state_json_backup", legacyBackup);
            migration.apply();
        }
        coreStore.bootstrapFromLegacy(legacyPrimary);

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
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isTrustedWebViewUrl(request == null || request.getUrl() == null ? "" : request.getUrl().toString());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isTrustedWebViewUrl(url);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (!isTrustedWebViewUrl(url)) {
                    view.stopLoading();
                    return;
                }
                super.onPageStarted(view, url, favicon);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String type = "*/*";
                try {
                    String[] accept = fileChooserParams != null ? fileChooserParams.getAcceptTypes() : null;
                    if (accept != null && accept.length > 0 && accept[0] != null && !accept[0].isEmpty()) {
                        type = accept[0].contains("image") ? "image/*" : accept[0];
                    }
                } catch (Exception ignored) {}
                intent.setType(type);
                try {
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception ex) {
                    fileChooserCallback = null;
                    return false;
                }
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.addJavascriptInterface(new SyncBridgeV12(coreStore), "AndroidSync");
        webView.loadUrl(TRUSTED_ASSET_PREFIX + "index.html");
    }

    private void showIntegrityBlock() {
        new AlertDialog.Builder(this)
                .setTitle("LA PAUSE OS · Intégrité")
                .setMessage("Cette installation ne correspond pas à une build LA PAUSE OS autorisée.")
                .setCancelable(false)
                .setPositiveButton("Fermer", (d, which) -> finishAndRemoveTask())
                .show();
    }

    private static boolean isTrustedWebViewUrl(String value) {
        if (value == null) return false;
        String url = value.trim();
        return url.startsWith(TRUSTED_ASSET_PREFIX) || "about:blank".equals(url);
    }

    private String sanitizeSyncToken(String json, boolean preserveExistingSecret) {
        if (json == null || json.trim().isEmpty()) return json == null ? "" : json;
        try {
            JSONObject root = new JSONObject(json);
            JSONObject sync = root.optJSONObject("sync");
            if (sync == null) return root.toString();
            String token = sync.optString("token", "").trim();
            if (token.isEmpty()) return root.toString();
            boolean protectedSecret = false;
            if (secureStore != null) {
                if (preserveExistingSecret && secureStore.contains(SYNC_TOKEN_KEY_V2)) protectedSecret = true;
                else protectedSecret = secureStore.put(SYNC_TOKEN_KEY_V2, token);
            }
            if (!protectedSecret) return json;
            sync.put("token", "");
            return root.toString();
        } catch (Exception ignored) {
            return json;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Fin des sessions", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Alertes de fin de session LA PAUSE OS");
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
        }
    }

    private void requestExactAlarmPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
            return;
        }
        if (requestCode == REQ_SAVE_FILE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveContent != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) out.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
                } catch (Exception ignored) {}
            }
            pendingSaveContent = null;
            pendingSaveMime = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.nativeBack ? window.nativeBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        networkPool.shutdownNow();
        if (coreStore != null) coreStore.close();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidSync");
            webView.removeJavascriptInterface("Android");
            webView.destroy();
        }
        super.onDestroy();
    }

    public static void scheduleNativeAlerts(Context context, String sessionId, long endAt, long warningAt, String stationName) {
        if (sessionId == null || sessionId.isEmpty()) return;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        scheduleOne(context, am, sessionId, stationName, "warning", warningAt, sessionId.hashCode() ^ 0x45A1);
        scheduleOne(context, am, sessionId, stationName, "end", endAt, sessionId.hashCode() ^ 0x79B2);
        scheduleOne(context, am, sessionId, stationName, "critical", endAt + 5 * 60000L, sessionId.hashCode() ^ 0x63C3);
    }

    private static void scheduleOne(Context context, AlarmManager am, String sessionId, String stationName, String type, long at, int requestCode) {
        if (at <= System.currentTimeMillis()) return;
        Intent intent = new Intent(context, SessionAlarmReceiver.class);
        intent.setAction("com.lapauseclub.manager.SESSION_" + type.toUpperCase(Locale.US));
        intent.putExtra("sessionId", sessionId); intent.putExtra("stationName", stationName); intent.putExtra("alertType", type);
        PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException ex) { am.set(AlarmManager.RTC_WAKEUP, at, pi); }
    }

    public class AndroidBridge {
        private final SharedPreferences prefs = getSharedPreferences("gaming_floor_store", MODE_PRIVATE);

        @JavascriptInterface
        public String getStateJson() {
            String primary = prefs.getString("state_json", "");
            try {
                if (!primary.isEmpty()) {
                    primary = sanitizeSyncToken(primary, true);
                    new JSONObject(primary);
                    if (coreStore != null) coreStore.bootstrapFromLegacy(primary);
                    return primary;
                }
            } catch (Exception ignored) {}
            String backup = prefs.getString("state_json_backup", "");
            try {
                if (!backup.isEmpty()) {
                    backup = sanitizeSyncToken(backup, true);
                    new JSONObject(backup);
                    if (coreStore != null) coreStore.bootstrapFromLegacy(backup);
                    return backup;
                }
            } catch (Exception ignored) {}
            return coreStore == null ? "" : sanitizeSyncToken(coreStore.recoverLatestValidStateJson(), true);
        }

        @JavascriptInterface public String getClientsBackupJson() { return prefs.getString("critical_clients_json", ""); }

        @JavascriptInterface
        public void setStateJson(String json) {
            if (json == null || json.isEmpty()) return;
            try {
                JSONObject incoming = new JSONObject(json);
                String safeJson = persistLegacyCache(incoming, json);
                if (coreStore != null) coreStore.mirrorLegacyState(safeJson);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String commitCoreCommand(String commandJson, String nextStateJson, String eventJson) {
            if (coreStore == null) return "{\"ok\":false,\"code\":\"NO_DURABLE_STORAGE\",\"message\":\"Core unavailable\"}";
            String result = coreStore.commitCommand(commandJson, nextStateJson, eventJson);
            try {
                JSONObject r = new JSONObject(result);
                if (r.optBoolean("ok", false) && r.optJSONObject("state") != null) {
                    JSONObject authoritative = r.getJSONObject("state");
                    persistLegacyCache(authoritative, authoritative.toString());
                }
            } catch (Exception ignored) {}
            return result;
        }

        private String persistLegacyCache(JSONObject incoming, String json) {
            String safeJson = sanitizeSyncToken(json, false);
            JSONObject safeIncoming = incoming;
            try { safeIncoming = new JSONObject(safeJson); } catch (Exception ignored) {}
            String previous = prefs.getString("state_json", "");
            String safePrevious = sanitizeSyncToken(previous, true);
            SharedPreferences.Editor editor = prefs.edit();
            try { if (!safePrevious.isEmpty()) new JSONObject(safePrevious); editor.putString("state_json_backup", safePrevious); } catch (Exception ignored) {}
            editor.putString("state_json", safeJson);
            if (safeIncoming.has("clients") && safeIncoming.optJSONArray("clients") != null) editor.putString("critical_clients_json", safeIncoming.optJSONArray("clients").toString());
            editor.apply();
            return safeJson;
        }

        @JavascriptInterface public String getCoreStatusJson() { return coreStore == null ? "{}" : coreStore.getStatusJson().toString(); }
        @JavascriptInterface public String getCoreTimelineJson() { return coreStore == null ? "{}" : coreStore.getTimelineJson().toString(); }
        @JavascriptInterface public String sha256(String value) { return CoreStore.sha256(value == null ? "" : value); }
        @JavascriptInterface public String getSecureValue(String key) { return secureStore == null ? "" : secureStore.get(key); }
        @JavascriptInterface public boolean setSecureValue(String key, String value) { return secureStore != null && secureStore.put(key, value); }
        @JavascriptInterface public boolean deleteSecureValue(String key) { return secureStore != null && secureStore.delete(key); }
        @JavascriptInterface public boolean hasSecureValue(String key) { return secureStore != null && secureStore.contains(key); }
        @JavascriptInterface public String getAppSecurityInfoJson() { return AppIntegrity.inspect(MainActivity.this).toString(); }
        @JavascriptInterface public String verifyEntitlementJson(String json) { return EntitlementVerifier.verify(json); }

        @JavascriptInterface public String getOperatingMode() { return coreStore == null ? "STANDALONE" : coreStore.getOperatingMode(); }
        @JavascriptInterface public boolean setOperatingMode(String mode) { try { if (coreStore == null) return false; coreStore.setOperatingMode(mode); return true; } catch (Exception ignored) { return false; } }

        @JavascriptInterface
        public void keepScreenOn(boolean enabled) {
            runOnUiThread(() -> {
                if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void vibrate(long millis) {
            millis = Math.max(20, Math.min(millis, 1500));
            Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(millis, VibrationEffect.DEFAULT_AMPLITUDE));
            else vibrator.vibrate(millis);
        }

        @JavascriptInterface
        public void beep() {
            runOnUiThread(() -> {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 180);
                webView.postDelayed(tg::release, 300);
            });
        }

        @JavascriptInterface public void scheduleSessionAlerts(String sessionId, long endAt, long warningAt, String stationName) { MainActivity.scheduleNativeAlerts(MainActivity.this, sessionId, endAt, warningAt, stationName == null ? "Poste" : stationName); }
        @JavascriptInterface public void scheduleSessionEnd(String sessionId, long atMillis, String stationName) { MainActivity.scheduleNativeAlerts(MainActivity.this, sessionId, atMillis, atMillis - 5 * 60000L, stationName == null ? "Poste" : stationName); }

        @JavascriptInterface
        public void cancelSessionEnd(String sessionId) {
            if (sessionId == null) return;
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            for (int code : new int[]{sessionId.hashCode() ^ 0x45A1, sessionId.hashCode() ^ 0x79B2, sessionId.hashCode() ^ 0x63C3}) {
                Intent intent = new Intent(MainActivity.this, SessionAlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, code, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            }
        }

        @JavascriptInterface
        public String generateQrDataUrl(String text, int requestedSize) {
            if (text == null || text.isEmpty()) return "";
            int size = Math.max(128, Math.min(requestedSize, 640));
            try {
                BitMatrix matrix = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size);
                Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) bitmap.setPixel(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
                bitmap.recycle();
                return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            } catch (WriterException ex) { return ""; }
        }

        @JavascriptInterface
        public void showTestNotification(String title, String text) {
            SessionAlarmReceiver.showNotification(MainActivity.this, 999991, title == null ? "LA PAUSE OS" : title, text == null ? "Alerte de test" : text);
        }

        @JavascriptInterface
        public void saveText(String filename, String mime, String content) {
            pendingSaveContent = content == null ? "" : content;
            pendingSaveMime = (mime == null || mime.isEmpty()) ? "text/plain" : mime;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingSaveMime);
                intent.putExtra(Intent.EXTRA_TITLE, filename == null ? "la-pause-os-export.txt" : filename);
                try { startActivityForResult(intent, REQ_SAVE_FILE); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public String getDeviceInfo() {
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

        @JavascriptInterface
        public void httpRequest(String requestId, String method, String url, String token, String body) {
            networkPool.submit(() -> {
                HttpURLConnection conn = null;
                try {
                    URL target = new URL(url);
                    String scheme = target.getProtocol();
                    if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) throw new IllegalArgumentException("URL non supportée");
                    if ("http".equalsIgnoreCase(scheme) && !isPrivateLanHost(target.getHost())) throw new SecurityException("HTTP clair interdit hors réseau local");
                    conn = (HttpURLConnection) target.openConnection();
                    conn.setRequestMethod(method == null ? "GET" : method.toUpperCase(Locale.US));
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(12000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    conn.setRequestProperty("X-LA-PAUSE-Client", "android/" + BuildConfig.VERSION_NAME);
                    if (token != null && !token.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + token);
                    if (body != null && !body.isEmpty() && !"GET".equalsIgnoreCase(method)) {
                        conn.setDoOutput(true);
                        try (OutputStream out = conn.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
                    }
                    int status = conn.getResponseCode();
                    InputStream stream = status >= 200 && status < 400 ? conn.getInputStream() : conn.getErrorStream();
                    String response = readAll(stream);
                    final int finalStatus = status;
                    final String finalResponse = response == null ? "" : response;
                    webView.post(() -> webView.evaluateJavascript("window.NativeHttp&&window.NativeHttp.resolve(" + JSONObject.quote(requestId) + "," + finalStatus + "," + JSONObject.quote(finalResponse) + ")", null));
                } catch (Exception ex) {
                    String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
                    webView.post(() -> webView.evaluateJavascript("window.NativeHttp&&window.NativeHttp.reject(" + JSONObject.quote(requestId) + "," + JSONObject.quote(message) + ")", null));
                } finally { if (conn != null) conn.disconnect(); }
            });
        }
    }

    private static boolean isPrivateLanHost(String host) {
        if (host == null) return false;
        String h = host.trim().toLowerCase(Locale.US);
        if (h.equals("localhost") || h.equals("::1")) return true;
        if (h.startsWith("127.")) return true;
        if (h.startsWith("10.")) return true;
        if (h.startsWith("192.168.")) return true;
        if (h.startsWith("169.254.")) return true;
        if (h.startsWith("172.")) {
            String[] p = h.split("\\.");
            if (p.length == 4) {
                try { int second = Integer.parseInt(p[1]); return second >= 16 && second <= 31; }
                catch (Exception ignored) {}
            }
        }
        return false;
    }

    private static String readAll(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line; while ((line = br.readLine()) != null) sb.append(line).append('\n');
        }
        return sb.toString();
    }
}
