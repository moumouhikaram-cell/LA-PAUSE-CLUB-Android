package com.lapauseclub.manager.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * LA PAUSE OS secret store.
 * Ciphertext is kept in private SharedPreferences; encryption key remains in Android Keystore.
 * No plaintext secret is returned to backups/state JSON unless the caller explicitly asks for it.
 *
 * The signed SaaS entitlement uses a reserved key. Writes to that key are accepted only after
 * native ECDSA verification and structural validation, and an encrypted anti-rollback floor
 * prevents replaying an older signed entitlement after a newer one has been accepted.
 */
public final class SecureStore {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "la_pause_os_secure_store_v1";
    private static final String PREFS = "la_pause_secure_store_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final String ENTITLEMENT_KEY = EntitlementStore.KEY;
    private static final String ENTITLEMENT_FLOOR_KEY = "__system_entitlement_floor_v1";
    private final SharedPreferences prefs;

    public SecureStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        ensureKey();
    }

    private synchronized SecretKey ensureKey() {
        try {
            KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
            ks.load(null);
            if (ks.containsAlias(KEY_ALIAS)) {
                KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null);
                return entry.getSecretKey();
            }
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
            generator.init(new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            return generator.generateKey();
        } catch (Exception e) {
            throw new IllegalStateException("SecureStore key unavailable", e);
        }
    }

    public synchronized boolean put(String key, String plaintext) {
        String logical = clean(key);
        if (logical.isEmpty() || ENTITLEMENT_FLOOR_KEY.equals(logical)) return false;
        if (ENTITLEMENT_KEY.equals(logical)) return putVerifiedEntitlement(plaintext);
        return putRaw(logical, plaintext == null ? "" : plaintext);
    }

    public synchronized String get(String key) {
        String logical = clean(key);
        if (logical.isEmpty() || ENTITLEMENT_FLOOR_KEY.equals(logical)) return "";
        if (ENTITLEMENT_KEY.equals(logical)) return getVerifiedEntitlement();
        return getRaw(logical);
    }

    public synchronized boolean delete(String key) {
        String logical = clean(key);
        if (logical.isEmpty() || ENTITLEMENT_FLOOR_KEY.equals(logical)) return false;
        return prefs.edit().remove(normalize(logical)).commit();
    }

    public synchronized boolean contains(String key) {
        String logical = clean(key);
        if (logical.isEmpty() || ENTITLEMENT_FLOOR_KEY.equals(logical)) return false;
        if (ENTITLEMENT_KEY.equals(logical)) return !getVerifiedEntitlement().isEmpty();
        return prefs.contains(normalize(logical));
    }

    private boolean putVerifiedEntitlement(String plaintext) {
        if (plaintext == null || plaintext.trim().isEmpty()) return false;
        try {
            JSONObject verification = new JSONObject(EntitlementVerifier.verify(plaintext));
            if (!verification.optBoolean("valid", false)) return false;
            JSONObject incoming = new JSONObject(plaintext);
            if (!structurallyValidEntitlement(incoming)) return false;

            long incomingEpoch = Math.max(0L, incoming.optLong("revocationEpoch", 0L));
            long incomingIssuedAt = incoming.optLong("issuedAt", 0L);
            JSONObject floor = readEntitlementFloor();
            long floorEpoch = Math.max(0L, floor.optLong("revocationEpoch", 0L));
            long floorIssuedAt = Math.max(0L, floor.optLong("issuedAt", 0L));
            if (incomingEpoch < floorEpoch) return false;
            if (incomingEpoch == floorEpoch && incomingIssuedAt < floorIssuedAt) return false;

            if (!putRaw(ENTITLEMENT_KEY, incoming.toString())) return false;
            JSONObject nextFloor = new JSONObject();
            nextFloor.put("revocationEpoch", Math.max(floorEpoch, incomingEpoch));
            nextFloor.put("issuedAt", incomingEpoch > floorEpoch ? incomingIssuedAt : Math.max(floorIssuedAt, incomingIssuedAt));
            nextFloor.put("entitlementId", incoming.optString("entitlementId", ""));
            return putRaw(ENTITLEMENT_FLOOR_KEY, nextFloor.toString());
        } catch (Exception e) {
            return false;
        }
    }

    private String getVerifiedEntitlement() {
        String payload = getRaw(ENTITLEMENT_KEY);
        if (payload.isEmpty()) return "";
        try {
            JSONObject verification = new JSONObject(EntitlementVerifier.verify(payload));
            JSONObject entitlement = new JSONObject(payload);
            if (!verification.optBoolean("valid", false) || !structurallyValidEntitlement(entitlement)) {
                prefs.edit().remove(normalize(ENTITLEMENT_KEY)).commit();
                return "";
            }
            JSONObject floor = readEntitlementFloor();
            long epoch = Math.max(0L, entitlement.optLong("revocationEpoch", 0L));
            long issuedAt = entitlement.optLong("issuedAt", 0L);
            long floorEpoch = Math.max(0L, floor.optLong("revocationEpoch", 0L));
            long floorIssuedAt = Math.max(0L, floor.optLong("issuedAt", 0L));
            if (epoch < floorEpoch || (epoch == floorEpoch && issuedAt < floorIssuedAt)) {
                prefs.edit().remove(normalize(ENTITLEMENT_KEY)).commit();
                return "";
            }
            return entitlement.toString();
        } catch (Exception e) {
            prefs.edit().remove(normalize(ENTITLEMENT_KEY)).commit();
            return "";
        }
    }

    private JSONObject readEntitlementFloor() {
        try {
            String raw = getRaw(ENTITLEMENT_FLOOR_KEY);
            return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private static boolean structurallyValidEntitlement(JSONObject e) {
        if (e == null || e.optInt("schemaVersion", 0) != 1) return false;
        if (e.optString("entitlementId", "").trim().length() < 8) return false;
        if (e.optString("catalogVersion", "").trim().isEmpty()) return false;
        if (e.optString("tenantId", "").trim().isEmpty()) return false;
        String status = e.optString("status", "").trim();
        if (!("ACTIVE".equals(status) || "TRIAL".equals(status) || "PAST_DUE_GRACE".equals(status)
                || "SUSPENDED".equals(status) || "EXPIRED".equals(status) || "REVOKED".equals(status))) return false;
        if (e.optJSONArray("modules") == null || e.optJSONArray("features") == null || e.optJSONObject("limits") == null) return false;
        long issuedAt = e.optLong("issuedAt", 0L), periodStart = e.optLong("periodStart", 0L), periodEnd = e.optLong("periodEnd", 0L), offlineUntil = e.optLong("offlineValidUntil", 0L);
        if (issuedAt <= 0L || periodStart <= 0L || periodEnd < periodStart || offlineUntil <= 0L) return false;
        if (e.optString("keyId", "").trim().isEmpty()) return false;
        if (!"ECDSA_P256_SHA256".equals(e.optString("algorithm", ""))) return false;
        return e.optString("signature", "").trim().length() >= 20;
    }

    private boolean putRaw(String logicalKey, String plaintext) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, ensureKey());
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal((plaintext == null ? "" : plaintext).getBytes(StandardCharsets.UTF_8));
            String payload = Base64.encodeToString(iv, Base64.NO_WRAP) + "." +
                    Base64.encodeToString(encrypted, Base64.NO_WRAP);
            return prefs.edit().putString(normalize(logicalKey), payload).commit();
        } catch (Exception e) {
            return false;
        }
    }

    private String getRaw(String logicalKey) {
        String payload = prefs.getString(normalize(logicalKey), "");
        if (payload == null || payload.isEmpty()) return "";
        try {
            String[] parts = payload.split("\\.", 2);
            if (parts.length != 2) return "";
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, ensureKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static String clean(String key) {
        return key == null ? "" : key.trim();
    }

    private static String normalize(String key) {
        return "secret_" + key.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
