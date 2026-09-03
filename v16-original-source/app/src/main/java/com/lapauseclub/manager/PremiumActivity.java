package com.lapauseclub.manager;

import android.app.AlertDialog;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.lang.reflect.Field;

public class PremiumActivity extends MainActivity {
    private WebView clientWebView;
    private int insetLeft = 0;
    private int insetTop = 0;
    private int insetRight = 0;
    private int insetBottom = 0;
    private boolean exitDialogVisible = false;

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
                "window.nativeBackContract ? window.nativeBackContract() : (window.nativeBack ? window.nativeBack() : false)",
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

    public class ClientBridge {
        @JavascriptInterface public void requestExitConfirmation() { confirmExitNative(); }
        @JavascriptInterface public void exitApp() { confirmExitNative(); }
        @JavascriptInterface public String getSafeInsetsJson() { return safeInsetsJson(); }
    }
}
