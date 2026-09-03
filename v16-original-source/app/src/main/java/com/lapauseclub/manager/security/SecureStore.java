package com.lapauseclub.manager.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

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
 */
public final class SecureStore {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "la_pause_os_secure_store_v1";
    private static final String PREFS = "la_pause_secure_store_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
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
        if (key == null || key.trim().isEmpty()) return false;
        if (plaintext == null) plaintext = "";
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, ensureKey());
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            String payload = Base64.encodeToString(iv, Base64.NO_WRAP) + "." +
                    Base64.encodeToString(encrypted, Base64.NO_WRAP);
            return prefs.edit().putString(normalize(key), payload).commit();
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized String get(String key) {
        if (key == null || key.trim().isEmpty()) return "";
        String payload = prefs.getString(normalize(key), "");
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

    public synchronized boolean delete(String key) {
        if (key == null || key.trim().isEmpty()) return false;
        return prefs.edit().remove(normalize(key)).commit();
    }

    public synchronized boolean contains(String key) {
        return key != null && prefs.contains(normalize(key));
    }

    private static String normalize(String key) {
        return "secret_" + key.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
