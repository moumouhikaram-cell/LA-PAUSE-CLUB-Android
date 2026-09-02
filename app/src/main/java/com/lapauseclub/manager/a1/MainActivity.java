package com.lapauseclub.manager.a1;

import android.app.Activity;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.lapauseclub.manager.a1.core.DeviceIdentity;
import com.lapauseclub.manager.a1.core.OperatingMode;
import com.lapauseclub.manager.a1.core.ResourceType;
import com.lapauseclub.manager.a1.data.AppDatabase;
import com.lapauseclub.manager.a1.data.BackupManager;
import com.lapauseclub.manager.a1.domain.VenueRepository;
import com.lapauseclub.manager.a1.sync.SyncCoordinator;

import org.json.JSONObject;

public final class MainActivity extends Activity {
    private AppDatabase database;
    private VenueRepository repository;
    private BackupManager backupManager;
    private SyncCoordinator syncCoordinator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String deviceId = DeviceIdentity.getOrCreate(this);
        database = new AppDatabase(getApplicationContext());
        repository = new VenueRepository(database, deviceId);
        backupManager = new BackupManager(database, getFilesDir());
        syncCoordinator = new SyncCoordinator();

        WebView webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowContentAccess(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new LocalOnlyWebViewClient());
        webView.addJavascriptInterface(new AndroidBridge(), "LaPauseNative");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onDestroy() {
        if (database != null) database.close();
        super.onDestroy();
    }

    private String bootMarker() {
        try {
            int count = Settings.Global.getInt(getContentResolver(), Settings.Global.BOOT_COUNT);
            return "boot-" + count;
        } catch (Exception ignored) {
            return "boot-unknown";
        }
    }

    private static String ok(JSONObject data) {
        try {
            return new JSONObject().put("ok", true)
                    .put("data", data == null ? JSONObject.NULL : data).toString();
        } catch (Exception impossible) {
            return "{\"ok\":false,\"error\":\"serialization\"}";
        }
    }

    private static String fail(Exception error) {
        try {
            return new JSONObject().put("ok", false)
                    .put("error", error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage())
                    .toString();
        } catch (Exception impossible) {
            return "{\"ok\":false,\"error\":\"unknown\"}";
        }
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public String bootstrap() {
            try {
                JSONObject data = repository.bootstrap();
                data.put("syncState", syncCoordinator.getState().name());
                data.put("syncRequiredForLocalOperation", syncCoordinator.isRequiredForLocalOperation());
                return ok(data);
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String initializeVenue(String venueName, String currency, String modeName) {
            try {
                return ok(repository.initializeVenue(venueName, currency, OperatingMode.valueOf(modeName)));
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String addResource(String name, String typeName, long ratePerHourMinor, int maxPlayers) {
            try {
                return ok(repository.addResource(name, ResourceType.valueOf(typeName), ratePerHourMinor, maxPlayers));
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String startSession(String resourceId, String customerName, int playerCount) {
            try {
                return ok(repository.startSession(resourceId, customerName, playerCount, bootMarker()));
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String stopSession(String sessionId, String paymentMethod) {
            try {
                return ok(repository.stopSession(sessionId, paymentMethod, bootMarker()));
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String setBillingPolicy(int incrementMinutes, int minimumMinutes) {
            try {
                return ok(repository.setBillingPolicy(incrementMinutes, minimumMinutes));
            } catch (Exception e) { return fail(e); }
        }

        @JavascriptInterface
        public String createBackup() {
            try { return ok(backupManager.createJsonBackup()); }
            catch (Exception e) { return fail(e); }
        }
    }

    private static final class LocalOnlyWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !request.getUrl().toString().startsWith("file:///android_asset/");
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !url.startsWith("file:///android_asset/");
        }
    }
}
