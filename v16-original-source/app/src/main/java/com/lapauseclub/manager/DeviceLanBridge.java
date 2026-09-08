package com.lapauseclub.manager;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Device-only secure storage + LAN discovery for the frozen v1.6 manager.
 *
 * Deliberately isolated from entitlement/SaaS code. It only accepts device-auth-* secret keys,
 * scans the tablet's current private IPv4 /24, and only returns endpoints that identify as an
 * explicit LA PAUSE Device Agent.
 */
final class DeviceLanBridge {
    static final String PROTOCOL = "LA_PAUSE_DEVICE_AGENT_V1";
    static final String SERVICE = "LA_PAUSE_DEVICE_AGENT";
    private static final String KEY_ALIAS = "la_pause_device_secure_store_v1";
    private static final String PREFS = "la_pause_device_secrets_v1";
    private static final String KEY_PREFIX = "device-auth-";
    private static final int[] PORTS = new int[]{8080, 8765, 3000};
    private static final int CONNECT_TIMEOUT_MS = 260;
    private static final int READ_TIMEOUT_MS = 500;

    private final Context appContext;
    private final SharedPreferences secrets;

    DeviceLanBridge(Context context) {
        appContext = context.getApplicationContext();
        secrets = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized boolean setSecureValue(String key, String value) {
        if (!validSecretKey(key) || value == null || value.isEmpty()) return false;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            JSONObject payload = new JSONObject();
            payload.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            payload.put("ct", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            return secrets.edit().putString(key, payload.toString()).commit();
        } catch (Exception ignored) {
            return false;
        }
    }

    synchronized String getSecureValue(String key) {
        if (!validSecretKey(key)) return "";
        String raw = secrets.getString(key, "");
        if (raw == null || raw.isEmpty()) return "";
        try {
            JSONObject payload = new JSONObject(raw);
            byte[] iv = Base64.decode(payload.getString("iv"), Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(payload.getString("ct"), Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    synchronized boolean deleteSecureValue(String key) {
        if (!validSecretKey(key)) return false;
        return secrets.edit().remove(key).commit();
    }

    private static boolean validSecretKey(String key) {
        return key != null && key.matches("^device-auth-[A-Za-z0-9_-]{1,80}$");
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null);
            if (entry != null) return entry.getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    JSONObject discover() {
        long startedAt = System.currentTimeMillis();
        JSONObject out = new JSONObject();
        ExecutorService scanner = null;
        try {
            Inet4Address local = findPrivateIpv4();
            if (local == null) {
                out.put("ok", false);
                out.put("error", "Aucune interface IPv4 LAN privée active");
                out.put("agents", new JSONArray());
                return out;
            }

            String localIp = local.getHostAddress();
            String[] octets = localIp.split("\\.");
            if (octets.length != 4) throw new IllegalStateException("IPv4 LAN invalide");
            String prefix = octets[0] + "." + octets[1] + "." + octets[2] + ".";

            scanner = Executors.newFixedThreadPool(24);
            AtomicInteger scanned = new AtomicInteger();
            List<Callable<JSONObject>> tasks = new ArrayList<>();
            for (int host = 1; host <= 254; host++) {
                final String ip = prefix + host;
                if (ip.equals(localIp)) continue;
                tasks.add(() -> {
                    scanned.incrementAndGet();
                    return probeHost(ip);
                });
            }

            List<Future<JSONObject>> futures = scanner.invokeAll(tasks, 9, TimeUnit.SECONDS);
            JSONArray agents = new JSONArray();
            Set<String> seen = new HashSet<>();
            for (Future<JSONObject> future : futures) {
                if (future == null || future.isCancelled()) continue;
                try {
                    JSONObject agent = future.get();
                    if (agent == null) continue;
                    String stable = agent.optString("agentId", "").trim();
                    String address = agent.optString("address", "").trim();
                    String dedupe = !stable.isEmpty() ? "id:" + stable : "addr:" + address;
                    if (seen.add(dedupe)) agents.put(agent);
                } catch (Exception ignored) {}
            }

            out.put("ok", true);
            out.put("protocol", PROTOCOL);
            out.put("localIp", localIp);
            out.put("subnet", prefix + "0/24");
            out.put("scanned", scanned.get());
            out.put("durationMs", System.currentTimeMillis() - startedAt);
            out.put("agents", agents);
            return out;
        } catch (Exception ex) {
            try {
                out.put("ok", false);
                out.put("error", String.valueOf(ex.getMessage()));
                out.put("durationMs", System.currentTimeMillis() - startedAt);
                out.put("agents", new JSONArray());
            } catch (Exception ignored) {}
            return out;
        } finally {
            if (scanner != null) scanner.shutdownNow();
        }
    }

    private JSONObject probeHost(String ip) {
        for (int port : PORTS) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL("http://" + ip + ":" + port + "/health");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setUseCaches(false);
                conn.setRequestProperty("Accept", "application/json");
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) continue;
                String body = readBody(conn.getInputStream());
                if (body.isEmpty()) continue;
                JSONObject agent = new JSONObject(body);
                String header = String.valueOf(conn.getHeaderField("X-LA-PAUSE-Agent"));
                boolean explicit = PROTOCOL.equals(agent.optString("protocol", ""))
                        || SERVICE.equals(agent.optString("service", ""))
                        || (header != null && header.toUpperCase().contains("LA_PAUSE"));
                if (!explicit) continue;
                String agentId = agent.optString("agentId", "").trim();
                if (agentId.isEmpty()) continue;
                agent.put("protocol", PROTOCOL);
                agent.put("address", "http://" + ip + ":" + port);
                return agent;
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return null;
    }

    private static String readBody(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (out.length() > 128 * 1024) throw new IllegalArgumentException("Réponse agent trop grande");
                out.append(line);
            }
        }
        return out.toString();
    }

    private static Inet4Address findPrivateIpv4() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface nic = interfaces.nextElement();
                try {
                    if (!nic.isUp() || nic.isLoopback()) continue;
                } catch (Exception ignored) { continue; }
                Enumeration<InetAddress> addresses = nic.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (!(address instanceof Inet4Address)) continue;
                    if (address.isLoopbackAddress()) continue;
                    if (address.isSiteLocalAddress() || address.isLinkLocalAddress()) return (Inet4Address) address;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
