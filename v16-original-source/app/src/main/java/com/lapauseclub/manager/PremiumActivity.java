package com.lapauseclub.manager;

import android.app.AlertDialog;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

public class PremiumActivity extends MainActivity {
    private static final String DEVICE_AGENT_PROTOCOL = "LA_PAUSE_DEVICE_AGENT_V1";
    private static final int[] DEVICE_AGENT_PORTS = new int[]{8080, 8765, 3000};

    private WebView clientWebView;
    private int insetLeft = 0;
    private int insetTop = 0;
    private int insetRight = 0;
    private int insetBottom = 0;
    private boolean exitDialogVisible = false;
    private final ExecutorService discoveryCoordinator = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clientWebView = resolveWebView();
        if (clientWebView != null) {
            clientWebView.addJavascriptInterface(new ClientBridge(), "ClientAndroid");
            installSystemInsets(clientWebView);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    this::handleBackRequest
            );
        }
        try {
            getWindow().setNavigationBarColor(Color.BLACK);
            getWindow().setStatusBarColor(Color.rgb(5, 9, 20));
        } catch (Exception ignored) {}
    }

    private WebView resolveWebView() {
        try {
            Field field = MainActivity.class.getDeclaredField("webView");
            field.setAccessible(true);
            Object value = field.get(this);
            return value instanceof WebView ? (WebView) value : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void installSystemInsets(View target) {
        target.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetLeft = bars.left;
                insetTop = bars.top;
                insetRight = bars.right;
                insetBottom = bars.bottom;
            } else {
                insetLeft = insets.getSystemWindowInsetLeft();
                insetTop = insets.getSystemWindowInsetTop();
                insetRight = insets.getSystemWindowInsetRight();
                insetBottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(0, 0, 0, 0);
            notifyInsetsChanged();
            return insets;
        });
        target.requestApplyInsets();
    }

    private String safeInsetsJson() {
        return "{\"left\":" + insetLeft + ",\"top\":" + insetTop + ",\"right\":" + insetRight + ",\"bottom\":" + insetBottom + "}";
    }

    private void notifyInsetsChanged() {
        if (clientWebView == null) return;
        final String json = safeInsetsJson();
        clientWebView.post(() -> clientWebView.evaluateJavascript("window.onNativeInsetsChanged&&window.onNativeInsetsChanged(" + json + ")", null));
    }

    private void notifyViewportChanged() {
        if (clientWebView == null) return;
        clientWebView.postDelayed(() -> {
            clientWebView.requestApplyInsets();
            clientWebView.evaluateJavascript("window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged()", null);
        }, 90L);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        notifyViewportChanged();
    }

    private void handleBackRequest() {
        if (clientWebView == null) {
            confirmExitNative();
            return;
        }
        clientWebView.evaluateJavascript(
                "window.nativeBack ? window.nativeBack() : false",
                value -> { if (!"true".equals(value)) confirmExitNative(); }
        );
    }

    @Override
    public void onBackPressed() {
        handleBackRequest();
    }

    private void confirmExitNative() {
        if (exitDialogVisible || isFinishing() || isDestroyed()) return;
        exitDialogVisible = true;
        runOnUiThread(() -> {
            AlertDialog dialog = new AlertDialog.Builder(this)
                    .setTitle("Quitter LA PAUSE OS ?")
                    .setMessage("Voulez-vous vraiment fermer l’application ?")
                    .setNegativeButton("Rester", null)
                    .setPositiveButton("Quitter", (d, which) -> finishAndRemoveTask())
                    .create();
            dialog.setOnDismissListener(d -> exitDialogVisible = false);
            dialog.show();
        });
    }

    private static final class LanSnapshot {
        final String localIp;
        final String prefix;
        LanSnapshot(String localIp, String prefix) { this.localIp = localIp; this.prefix = prefix; }
    }

    private LanSnapshot localLanSnapshot() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return null;
            Network active = cm.getActiveNetwork();
            if (active == null) return null;
            LinkProperties props = cm.getLinkProperties(active);
            if (props == null) return null;
            for (LinkAddress link : props.getLinkAddresses()) {
                InetAddress address = link.getAddress();
                if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) continue;
                byte[] b = address.getAddress();
                if (b == null || b.length != 4) continue;
                int a = b[0] & 0xff, c = b[1] & 0xff, d = b[2] & 0xff, e = b[3] & 0xff;
                String prefix = a + "." + c + "." + d;
                return new LanSnapshot(prefix + "." + e, prefix);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String readLimited(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
            char[] buffer = new char[1024];
            int n;
            while ((n = reader.read(buffer)) > 0 && out.length() < 32768) {
                int take = Math.min(n, 32768 - out.length());
                out.append(buffer, 0, take);
            }
        }
        return out.toString();
    }

    private JSONObject probeLaPauseAgent(String host) {
        for (int port : DEVICE_AGENT_PORTS) {
            HttpURLConnection conn = null;
            long started = System.currentTimeMillis();
            try {
                URL url = new URL("http://" + host + ":" + port + "/health");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(350);
                conn.setReadTimeout(550);
                conn.setInstanceFollowRedirects(false);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("X-LA-PAUSE-Discovery", DEVICE_AGENT_PROTOCOL);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) continue;
                String body = readLimited(conn.getInputStream());
                if (body.isEmpty()) continue;
                JSONObject health = new JSONObject(body);
                String protocol = health.optString("protocol", "").trim();
                String service = health.optString("service", "").trim();
                String header = String.valueOf(conn.getHeaderField("X-LA-PAUSE-Agent"));
                boolean recognized = DEVICE_AGENT_PROTOCOL.equalsIgnoreCase(protocol)
                        || "LA_PAUSE_DEVICE_AGENT".equalsIgnoreCase(service)
                        || (header != null && header.toUpperCase().contains("LA_PAUSE"));
                if (!recognized) continue;

                JSONObject result = new JSONObject();
                String agentId = health.optString("agentId", health.optString("deviceId", health.optString("id", host + ":" + port)));
                result.put("agentId", agentId);
                result.put("name", health.optString("name", "Agent LA PAUSE " + host));
                result.put("deviceType", health.optString("deviceType", "ANDROID_TV_AGENT"));
                result.put("version", health.optString("version", "unknown"));
                result.put("protocol", protocol.isEmpty() ? DEVICE_AGENT_PROTOCOL : protocol);
                result.put("address", "http://" + host + ":" + port);
                result.put("ip", host);
                result.put("port", port);
                result.put("latencyMs", Math.max(0, System.currentTimeMillis() - started));
                Object capabilities = health.opt("capabilities");
                result.put("capabilities", capabilities == null || capabilities == JSONObject.NULL ? new JSONObject() : capabilities);
                return result;
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    private void deliverLanDiscovery(String requestId, JSONObject payload) {
        if (clientWebView == null) return;
        final String js = "window.onLaPauseLanDiscovery&&window.onLaPauseLanDiscovery("
                + JSONObject.quote(requestId == null ? "" : requestId) + "," + payload.toString() + ")";
        clientWebView.post(() -> clientWebView.evaluateJavascript(js, null));
    }

    private void discoverLaPauseAgentsNative(String requestId) {
        final long started = System.currentTimeMillis();
        discoveryCoordinator.submit(() -> {
            JSONObject payload = new JSONObject();
            ExecutorService scanPool = null;
            try {
                LanSnapshot lan = localLanSnapshot();
                if (lan == null) throw new IllegalStateException("Aucun réseau IPv4 local actif");
                List<Callable<JSONObject>> tasks = new ArrayList<>();
                for (int hostNo = 1; hostNo <= 254; hostNo++) {
                    final String host = lan.prefix + "." + hostNo;
                    if (host.equals(lan.localIp)) continue;
                    tasks.add(() -> probeLaPauseAgent(host));
                }
                scanPool = Executors.newFixedThreadPool(32);
                List<Future<JSONObject>> futures = scanPool.invokeAll(tasks, 12500, TimeUnit.MILLISECONDS);
                JSONArray agents = new JSONArray();
                for (Future<JSONObject> future : futures) {
                    if (future.isCancelled()) continue;
                    try {
                        JSONObject agent = future.get();
                        if (agent != null) agents.put(agent);
                    } catch (Exception ignored) {}
                }
                payload.put("ok", true);
                payload.put("localIp", lan.localIp);
                payload.put("subnet", lan.prefix + ".0/24");
                payload.put("scanned", tasks.size());
                payload.put("durationMs", Math.max(0, System.currentTimeMillis() - started));
                payload.put("agents", agents);
                payload.put("protocol", DEVICE_AGENT_PROTOCOL);
            } catch (Exception ex) {
                try {
                    payload.put("ok", false);
                    payload.put("error", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
                    payload.put("agents", new JSONArray());
                    payload.put("durationMs", Math.max(0, System.currentTimeMillis() - started));
                } catch (Exception ignored) {}
            } finally {
                if (scanPool != null) scanPool.shutdownNow();
            }
            deliverLanDiscovery(requestId, payload);
        });
    }

    @Override
    protected void onDestroy() {
        discoveryCoordinator.shutdownNow();
        super.onDestroy();
    }

    public class ClientBridge {
        @JavascriptInterface public void requestExitConfirmation() { confirmExitNative(); }
        @JavascriptInterface public void exitApp() { confirmExitNative(); }
        @JavascriptInterface public String getSafeInsetsJson() { return safeInsetsJson(); }
        @JavascriptInterface public void discoverLaPauseAgents(String requestId) { discoverLaPauseAgentsNative(requestId); }
        @JavascriptInterface public String getLanInfoJson() {
            try {
                LanSnapshot lan = localLanSnapshot();
                JSONObject o = new JSONObject();
                o.put("ok", lan != null);
                if (lan != null) { o.put("localIp", lan.localIp); o.put("subnet", lan.prefix + ".0/24"); }
                return o.toString();
            } catch (Exception ignored) { return "{\"ok\":false}"; }
        }
    }
}
