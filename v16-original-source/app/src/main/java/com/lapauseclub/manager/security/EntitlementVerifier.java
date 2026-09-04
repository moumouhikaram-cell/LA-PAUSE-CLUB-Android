package com.lapauseclub.manager.security;

import android.util.Base64;

import com.lapauseclub.manager.BuildConfig;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

/** Native verifier for LA PAUSE OS SaaS entitlements.
 * Private signing material must never ship in the app.
 * Production public key is injected at build time through BuildConfig.
 */
public final class EntitlementVerifier {
    private static final String EXPECTED_ALGORITHM = "ECDSA_P256_SHA256";

    private EntitlementVerifier() {}

    public static String verify(String entitlementJson) {
        JSONObject out = new JSONObject();
        try {
            String configuredKey = sanitizePublicKey(BuildConfig.ENTITLEMENT_PUBLIC_KEY_B64);
            String configuredKeyId = safe(BuildConfig.ENTITLEMENT_KEY_ID);
            out.put("keyConfigured", !configuredKey.isEmpty());
            out.put("keyId", configuredKeyId);
            if (configuredKey.isEmpty()) return fail(out, "KEY_NOT_CONFIGURED");
            if (entitlementJson == null || entitlementJson.trim().isEmpty()) return fail(out, "EMPTY_ENTITLEMENT");

            JSONObject source = new JSONObject(entitlementJson);
            if (source.optInt("schemaVersion", 0) != 1) return fail(out, "SCHEMA_UNSUPPORTED");
            if (!EXPECTED_ALGORITHM.equals(source.optString("algorithm", ""))) return fail(out, "ALGORITHM_UNSUPPORTED");
            String keyId = source.optString("keyId", "").trim();
            if (!configuredKeyId.isEmpty() && !configuredKeyId.equals(keyId)) return fail(out, "KEY_ID_MISMATCH");
            String signatureText = source.optString("signature", "").trim();
            if (signatureText.isEmpty()) return fail(out, "SIGNATURE_MISSING");

            JSONObject unsigned = new JSONObject(source.toString());
            unsigned.remove("signature");
            String canonical = canonicalize(unsigned);
            PublicKey publicKey = parsePublicKey(configuredKey);
            byte[] signatureBytes = decodeSignature(signatureText);
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update(canonical.getBytes(StandardCharsets.UTF_8));
            boolean valid = verifier.verify(signatureBytes);
            out.put("valid", valid);
            out.put("code", valid ? "VERIFIED" : "SIGNATURE_INVALID");
            out.put("canonicalization", "LP_CANONICAL_JSON_V1");
            out.put("keyId", keyId);
            return out.toString();
        } catch (Exception ex) {
            try {
                out.put("valid", false);
                out.put("code", "VERIFY_ERROR");
                out.put("error", ex.getClass().getSimpleName());
            } catch (Exception ignored) {}
            return out.toString();
        }
    }

    private static String fail(JSONObject out, String code) throws Exception {
        out.put("valid", false);
        out.put("code", code);
        return out.toString();
    }

    private static String sanitizePublicKey(String value) {
        String v = safe(value);
        if (v.isEmpty()) return "";
        return v.replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s+", "");
    }

    private static PublicKey parsePublicKey(String b64) throws Exception {
        byte[] der = Base64.decode(b64, Base64.DEFAULT);
        return KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der));
    }

    private static byte[] decodeSignature(String text) {
        try { return Base64.decode(text, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
        catch (Exception ignored) { return Base64.decode(text, Base64.DEFAULT); }
    }

    /** Deterministic, platform-neutral canonical JSON contract used for signatures.
     * Object keys are lexicographically sorted; array order is preserved.
     */
    public static String canonicalize(Object value) throws Exception {
        if (value == null || value == JSONObject.NULL) return "null";
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            List<String> keys = new ArrayList<>();
            Iterator<String> it = object.keys();
            while (it.hasNext()) keys.add(it.next());
            Collections.sort(keys);
            StringBuilder out = new StringBuilder("{");
            for (int i = 0; i < keys.size(); i++) {
                if (i > 0) out.append(',');
                String key = keys.get(i);
                out.append(JSONObject.quote(key)).append(':').append(canonicalize(object.get(key)));
            }
            return out.append('}').toString();
        }
        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            StringBuilder out = new StringBuilder("[");
            for (int i = 0; i < array.length(); i++) {
                if (i > 0) out.append(',');
                out.append(canonicalize(array.get(i)));
            }
            return out.append(']').toString();
        }
        if (value instanceof String) return JSONObject.quote((String) value);
        if (value instanceof Boolean) return ((Boolean) value) ? "true" : "false";
        if (value instanceof Number) {
            String n = JSONObject.numberToString((Number) value);
            if ("-0".equals(n)) return "0";
            return n;
        }
        return JSONObject.quote(String.valueOf(value));
    }

    private static String safe(String v) { return v == null ? "" : v.trim(); }
}
