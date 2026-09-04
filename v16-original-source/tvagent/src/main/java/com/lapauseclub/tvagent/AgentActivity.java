package com.lapauseclub.tvagent;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.net.Inet4Address;
import java.net.InetAddress;

public class AgentActivity extends Activity {
    private AgentConfig config;
    private final Handler refreshHandler = new Handler(Looper.getMainLooper());
    private TextView statusText;
    private TextView networkText;
    private TextView identityText;
    private TextView pairingCodeText;
    private TextView pairingMetaText;
    private TextView overlayStatusText;
    private EditText nameInput;
    private CheckBox overlayVerified;
    private boolean refreshing;

    private final Runnable refreshTask = new Runnable() {
        @Override public void run() {
            refreshUi();
            refreshHandler.postDelayed(this, 1000L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        config = new AgentConfig(this);
        requestNotificationsIfNeeded();
        startAgentService(null);
        buildUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshHandler.removeCallbacks(refreshTask);
        refreshHandler.post(refreshTask);
    }

    @Override
    protected void onPause() {
        refreshHandler.removeCallbacks(refreshTask);
        super.onPause();
    }

    private void buildUi() {
        getWindow().setStatusBarColor(Color.rgb(5, 9, 20));
        getWindow().setNavigationBarColor(Color.BLACK);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(5, 9, 20));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(42), dp(30), dp(42), dp(40));
        scroll.addView(root, new ScrollView.LayoutParams(ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));

        TextView kicker = text("LA PAUSE OS · DEVICE AGENT", 14, Color.rgb(255, 108, 55), true);
        root.addView(kicker);
        TextView title = text("Android TV / Box Agent 1.0", 30, Color.WHITE, true);
        root.addView(title, marginTop(dp(6)));
        TextView intro = text("Cette app reste sur le TV/boîtier. La tablette LA PAUSE OS la détecte sur le Wi‑Fi local puis commande uniquement les capacités réellement validées.", 16, Color.rgb(188, 198, 216), false);
        root.addView(intro, marginTop(dp(8)));

        LinearLayout health = card();
        root.addView(health, marginTop(dp(24)));
        health.addView(sectionTitle("ÉTAT DE L'AGENT"));
        statusText = text("…", 19, Color.WHITE, true); health.addView(statusText, marginTop(dp(8)));
        networkText = text("…", 15, Color.rgb(188, 198, 216), false); health.addView(networkText, marginTop(dp(6)));
        identityText = text("…", 13, Color.rgb(139, 151, 173), false); health.addView(identityText, marginTop(dp(5)));

        LinearLayout identity = card();
        root.addView(identity, marginTop(dp(18)));
        identity.addView(sectionTitle("IDENTITÉ DANS LA SALLE"));
        nameInput = new EditText(this);
        nameInput.setTextColor(Color.WHITE);
        nameInput.setHintTextColor(Color.rgb(120, 132, 153));
        nameInput.setTextSize(18);
        nameInput.setSingleLine(true);
        nameInput.setHint("TV PS5 1");
        nameInput.setPadding(dp(14), dp(12), dp(14), dp(12));
        nameInput.setBackgroundColor(Color.rgb(20, 29, 46));
        identity.addView(nameInput, marginTop(dp(10)));
        Button saveName = button("Enregistrer le nom");
        identity.addView(saveName, marginTop(dp(10)));
        saveName.setOnClickListener(v -> {
            config.setName(nameInput.getText().toString());
            toast("Nom enregistré");
            refreshUi();
        });

        LinearLayout pairing = card();
        root.addView(pairing, marginTop(dp(18)));
        pairing.addView(sectionTitle("PAIRING SÉCURISÉ"));
        pairing.addView(text("Sur la tablette : Devices → Scanner le Wi‑Fi → Associer → saisis ce code. Il expire et change après utilisation.", 15, Color.rgb(188, 198, 216), false), marginTop(dp(6)));
        pairingCodeText = text("000000", 42, Color.rgb(255, 166, 55), true);
        pairingCodeText.setGravity(Gravity.CENTER_HORIZONTAL);
        pairing.addView(pairingCodeText, marginTop(dp(14)));
        pairingMetaText = text("…", 13, Color.rgb(139, 151, 173), false);
        pairingMetaText.setGravity(Gravity.CENTER_HORIZONTAL);
        pairing.addView(pairingMetaText, marginTop(dp(4)));
        Button rotate = button("Générer un nouveau code");
        pairing.addView(rotate, marginTop(dp(12)));
        rotate.setOnClickListener(v -> { config.rotatePairingCode(); refreshUi(); });
        Button revoke = secondaryButton("Révoquer tous les contrôleurs associés");
        pairing.addView(revoke, marginTop(dp(8)));
        revoke.setOnClickListener(v -> {
            config.revokeAllTokens();
            config.rotatePairingCode();
            toast("Accès révoqués. Un nouveau pairing sera nécessaire.");
            refreshUi();
        });

        LinearLayout overlay = card();
        root.addView(overlay, marginTop(dp(18)));
        overlay.addView(sectionTitle("OVERLAY SUR LE JEU"));
        overlay.addView(text("Règle stricte : on ne déclare jamais l'overlay compatible juste parce que le boîtier est Android. Il faut d'abord le voir réellement au-dessus du gameplay HDMI/PS5 de cette TV.", 15, Color.rgb(255, 201, 128), false), marginTop(dp(6)));
        overlayStatusText = text("…", 15, Color.WHITE, true);
        overlay.addView(overlayStatusText, marginTop(dp(10)));
        Button permission = button("1 · Autoriser l'affichage par-dessus les apps");
        overlay.addView(permission, marginTop(dp(10)));
        permission.setOnClickListener(v -> openOverlayPermission());
        Button test = button("2 · Afficher un test overlay");
        overlay.addView(test, marginTop(dp(8)));
        test.setOnClickListener(v -> {
            if (!Settings.canDrawOverlays(this)) { openOverlayPermission(); return; }
            startAgentService(AgentService.ACTION_TEST_OVERLAY);
            toast("Regarde maintenant l'écran HDMI/jeu");
        });
        overlayVerified = new CheckBox(this);
        overlayVerified.setText("3 · J'ai vérifié l'overlay sur le gameplay HDMI réel");
        overlayVerified.setTextColor(Color.WHITE);
        overlayVerified.setTextSize(16);
        overlayVerified.setPadding(0, dp(8), 0, dp(8));
        overlay.addView(overlayVerified, marginTop(dp(8)));
        overlayVerified.setOnCheckedChangeListener((buttonView, checked) -> {
            if (refreshing) return;
            if (checked && !Settings.canDrawOverlays(this)) {
                refreshing = true; overlayVerified.setChecked(false); refreshing = false;
                openOverlayPermission(); return;
            }
            config.setOverlayVerified(checked);
            toast(checked ? "Overlay déclaré VALIDÉ pour ce device" : "Overlay désactivé dans les capacités");
            refreshUi();
        });

        LinearLayout service = card();
        root.addView(service, marginTop(dp(18)));
        service.addView(sectionTitle("SERVICE LOCAL"));
        service.addView(text("L'agent écoute uniquement sur le LAN. Les commandes nécessitent un token obtenu avec le code de pairing. Internet n'est pas requis.", 15, Color.rgb(188, 198, 216), false), marginTop(dp(6)));
        Button restart = secondaryButton("Redémarrer le service agent");
        service.addView(restart, marginTop(dp(10)));
        restart.setOnClickListener(v -> startAgentService(AgentService.ACTION_RESTART));

        setContentView(scroll);
        nameInput.setText(config.name());
        refreshUi();
    }

    private void refreshUi() {
        if (config == null || statusText == null) return;
        refreshing = true;
        String status = config.runtimeStatus();
        int port = config.runtimePort();
        String error = config.runtimeError();
        statusText.setText("ONLINE".equals(status) ? "● Agent ONLINE" : "● Agent " + status);
        statusText.setTextColor("ONLINE".equals(status) ? Color.rgb(87, 220, 146) : Color.rgb(255, 116, 116));
        String ip = localIpv4();
        networkText.setText("Réseau : " + (ip.isEmpty() ? "IPv4 indisponible" : ip) + (port > 0 ? ":" + port : "") + (error == null || error.isEmpty() ? "" : " · " + error));
        identityText.setText("Agent ID : " + config.agentId() + " · protocole " + AgentConfig.PROTOCOL);
        if (!nameInput.hasFocus()) nameInput.setText(config.name());
        pairingCodeText.setText(config.pairingCode());
        long seconds = Math.max(0L, (config.pairingExpiresAt() - System.currentTimeMillis()) / 1000L);
        pairingMetaText.setText((config.hasAuthorizedController() ? "Contrôleur associé · " : "Aucun contrôleur associé · ") + "code valable encore " + (seconds / 60L) + "m " + (seconds % 60L) + "s");
        boolean permission = Settings.canDrawOverlays(this);
        boolean verified = config.overlayVerified();
        overlayStatusText.setText("Permission Android : " + (permission ? "OK" : "NON") + " · Validation HDMI : " + (verified ? "OUI" : "NON") + " · Capacité annoncée : " + (config.overlayReady() ? "overlay=true" : "overlay=false"));
        overlayStatusText.setTextColor(config.overlayReady() ? Color.rgb(87, 220, 146) : Color.rgb(255, 166, 55));
        overlayVerified.setChecked(verified);
        refreshing = false;
    }

    private void openOverlayPermission() {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ex) {
            toast("Ouvre les réglages Android et autorise 'Afficher par-dessus'.");
        }
    }

    private void startAgentService(String action) {
        Intent intent = new Intent(this, AgentService.class);
        if (action != null) intent.setAction(action);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent); else startService(intent);
        } catch (Exception ex) {
            toast("Impossible de démarrer le service : " + ex.getMessage());
        }
    }

    private void requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2401);
        }
    }

    private String localIpv4() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            Network network = cm == null ? null : cm.getActiveNetwork();
            LinkProperties props = network == null ? null : cm.getLinkProperties(network);
            if (props == null) return "";
            for (LinkAddress link : props.getLinkAddresses()) {
                InetAddress address = link.getAddress();
                if (address instanceof Inet4Address && !address.isLoopbackAddress()) return address.getHostAddress();
            }
        } catch (Exception ignored) {}
        return "";
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(22), dp(18), dp(22), dp(20));
        card.setBackgroundColor(Color.rgb(12, 19, 33));
        return card;
    }

    private TextView sectionTitle(String value) {
        return text(value, 13, Color.rgb(255, 108, 55), true);
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(15);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackgroundColor(Color.rgb(230, 91, 42));
        button.setFocusable(true);
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = button(label);
        button.setBackgroundColor(Color.rgb(27, 39, 61));
        return button;
    }

    private LinearLayout.LayoutParams marginTop(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = top;
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
