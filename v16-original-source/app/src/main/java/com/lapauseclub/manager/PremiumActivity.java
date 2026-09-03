package com.lapauseclub.manager;

import android.app.AlertDialog;
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clientWebView = resolveWebView();
        if (clientWebView != null) {
            clientWebView.addJavascriptInterface(new ClientBridge(), "ClientAndroid");
            installSystemInsets(clientWebView);
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
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        target.requestApplyInsets();
    }

    @Override
    public void onBackPressed() {
        if (clientWebView == null) {
            confirmExitNative();
            return;
        }
        clientWebView.evaluateJavascript(
                "window.nativeBack ? window.nativeBack() : false",
                value -> {
                    if (!"true".equals(value)) confirmExitNative();
                }
        );
    }

    private void confirmExitNative() {
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("Quitter LA PAUSE OS ?")
                .setMessage("Voulez-vous vraiment fermer l’application ?")
                .setNegativeButton("Rester", null)
                .setPositiveButton("Quitter", (dialog, which) -> finishAndRemoveTask())
                .show());
    }

    public class ClientBridge {
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(PremiumActivity.this::finishAndRemoveTask);
        }
    }
}
