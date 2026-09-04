package com.lapauseclub.tvagent;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONArray;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.UUID;

final class AgentConfig {
    static final String PROTOCOL = "LA_PAUSE_DEVICE_AGENT_V1";
    static final String SERVICE = "LA_PAUSE_DEVICE_AGENT";
    static final String VERSION = "1.0.0";
    private static final String PREFS = "la_pause_tv_agent";
    private static final String KEY_AGENT_ID = "agent_id";
    private static final String KEY_NAME = "agent_name";
    private static final String KEY_OVERLAY_VERIFIED = "overlay_verified";
    private static final String KEY_PAIR_CODE = "pair_code";
    private static final String KEY_PAIR_EXPIRES = "pair_expires";
    private static final String KEY_TOKEN_HASHES = "token_hashes";
    private static final String KEY_RUNTIME_PORT = "runtime_port";
    private static final String KEY_RUNTIME_STATUS = "runtime_status";
    private static final String KEY_RUNTIME_ERROR = "runtime_error";
    private static final String KEY_LAST_SEQUENCE = "last_sequence";
    private static final String KEY_LAST_COMMAND_AT = "last_command_at";
    private static final String KEY_IDEMPOTENCY = "idempotency_keys";
    private static final long PAIR_TTL_MS = 10 * 60_000L;
    private static final int MAX_TOKENS = 5;
    private static final int MAX_IDEMPOTENCY_KEYS = 64;

    private final Context context;
    private final SharedPreferences prefs;
    private final SecureRandom random = new SecureRandom();

    AgentConfig(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        ensureAgentId();
        pairingCode();
    }

    synchronized String agentId() {
        return ensureAgentId();
    }

    private String ensureAgentId() {
        String id = prefs.getString(KEY_AGENT_ID, "");
        if (id == null || id.trim().isEmpty()) {
            id = "tv-" + UUID.randomUUID().toString().replace("-", "");
            prefs.edit().putString(KEY_AGENT_ID, id).apply();
        }
        return id;
    }

    synchronized String name() {
        String value = prefs.getString(KEY_NAME, "");
        return value == null || value.trim().isEmpty() ? "TV LA PAUSE" : value.trim();
    }

    synchronized void setName(String name) {
        String value = name == null ? "" : name.trim();
        prefs.edit().putString(KEY_NAME, value.isEmpty() ? "TV LA PAUSE" : value).apply();
    }

    synchronized boolean overlayVerified() {
        return prefs.getBoolean(KEY_OVERLAY_VERIFIED, false);
    }

    synchronized void setOverlayVerified(boolean verified) {
        prefs.edit().putBoolean(KEY_OVERLAY_VERIFIED, verified).apply();
    }

    boolean overlayPermissionGranted() {
        return Settings.canDrawOverlays(context);
    }

    boolean overlayReady() {
        return overlayPermissionGranted() && overlayVerified();
    }

    synchronized String pairingCode() {
        String code = prefs.getString(KEY_PAIR_CODE, "");
        long expires = prefs.getLong(KEY_PAIR_EXPIRES, 0L);
        if (code == null || code.length() != 6 || System.currentTimeMillis() >= expires) {
            return rotatePairingCode();
        }
        return code;
    }

    synchronized long pairingExpiresAt() {
        pairingCode();
        return prefs.getLong(KEY_PAIR_EXPIRES, 0L);
    }

    synchronized String rotatePairingCode() {
        String code = String.format(java.util.Locale.US, "%06d", random.nextInt(1_000_000));
        long expires = System.currentTimeMillis() + PAIR_TTL_MS;
        prefs.edit().putString(KEY_PAIR_CODE, code).putLong(KEY_PAIR_EXPIRES, expires).apply();
        return code;
    }

    synchronized boolean verifyPairingCode(String candidate) {
        String expected = pairingCode();
        if (candidate == null || System.currentTimeMillis() >= prefs.getLong(KEY_PAIR_EXPIRES, 0L)) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), candidate.trim().getBytes(StandardCharsets.UTF_8));
    }

    synchronized String issueBearerToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        String hash = sha256(token);
        JSONArray current = tokenHashes();
        JSONArray next = new JSONArray();
        int start = Math.max(0, current.length() - (MAX_TOKENS - 1));
        for (int i = start; i < current.length(); i++) next.put(current.optString(i));
        next.put(hash);
        prefs.edit().putString(KEY_TOKEN_HASHES, next.toString()).apply();
        rotatePairingCode();
        return token;
    }

    synchronized boolean hasAuthorizedController() {
        return tokenHashes().length() > 0;
    }

    synchronized void revokeAllTokens() {
        prefs.edit().putString(KEY_TOKEN_HASHES, "[]").apply();
    }

    synchronized boolean authorizeBearer(String token) {
        if (token == null || token.isEmpty()) return false;
        byte[] probe = sha256(token).getBytes(StandardCharsets.UTF_8);
        JSONArray hashes = tokenHashes();
        for (int i = 0; i < hashes.length(); i++) {
            byte[] expected = hashes.optString(i).getBytes(StandardCharsets.UTF_8);
            if (MessageDigest.isEqual(expected, probe)) return true;
        }
        return false;
    }

    private JSONArray tokenHashes() {
        String raw = prefs.getString(KEY_TOKEN_HASHES, "[]");
        try { return new JSONArray(raw == null ? "[]" : raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    synchronized boolean idempotencySeen(String key) {
        if (key == null || key.isEmpty()) return false;
        JSONArray keys = idempotencyKeys();
        for (int i = 0; i < keys.length(); i++) if (key.equals(keys.optString(i))) return true;
        return false;
    }

    synchronized void rememberIdempotency(String key) {
        if (key == null || key.isEmpty() || idempotencySeen(key)) return;
        JSONArray current = idempotencyKeys();
        JSONArray next = new JSONArray();
        int start = Math.max(0, current.length() - (MAX_IDEMPOTENCY_KEYS - 1));
        for (int i = start; i < current.length(); i++) next.put(current.optString(i));
        next.put(key);
        prefs.edit().putString(KEY_IDEMPOTENCY, next.toString()).apply();
    }

    private JSONArray idempotencyKeys() {
        String raw = prefs.getString(KEY_IDEMPOTENCY, "[]");
        try { return new JSONArray(raw == null ? "[]" : raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    synchronized void markCommand(long sequence) {
        prefs.edit().putLong(KEY_LAST_SEQUENCE, Math.max(sequence, prefs.getLong(KEY_LAST_SEQUENCE, 0L)))
                .putLong(KEY_LAST_COMMAND_AT, System.currentTimeMillis()).apply();
    }

    synchronized long lastSequence() { return prefs.getLong(KEY_LAST_SEQUENCE, 0L); }
    synchronized long lastCommandAt() { return prefs.getLong(KEY_LAST_COMMAND_AT, 0L); }

    synchronized void setRuntime(int port, String status, String error) {
        prefs.edit().putInt(KEY_RUNTIME_PORT, port)
                .putString(KEY_RUNTIME_STATUS, status == null ? "" : status)
                .putString(KEY_RUNTIME_ERROR, error == null ? "" : error).apply();
    }

    synchronized int runtimePort() { return prefs.getInt(KEY_RUNTIME_PORT, 0); }
    synchronized String runtimeStatus() { return prefs.getString(KEY_RUNTIME_STATUS, "STOPPED"); }
    synchronized String runtimeError() { return prefs.getString(KEY_RUNTIME_ERROR, ""); }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(out.length * 2);
            for (byte b : out) hex.append(String.format(java.util.Locale.US, "%02x", b & 0xff));
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
