package com.lapauseclub.manager.security;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import com.lapauseclub.manager.BuildConfig;

import org.json.JSONObject;

import java.security.MessageDigest;
import java.util.Locale;

/** Runtime anti-repackaging signal for LA PAUSE OS.
 * This is one layer only; server authorization and signed entitlements remain authoritative.
 */
public final class AppIntegrity {
    public static final String EXPECTED_PACKAGE = "com.lapauseclub.manager";
    public static final String OFFICIAL_SIGNER_SHA256 = "f154909d8c631131975553c41481b67c282f514beb0ed9ab228d7275fa8e321f";

    private AppIntegrity() {}

    public static JSONObject inspect(Context context) {
        JSONObject out = new JSONObject();
        try {
            String pkg = context.getPackageName();
            String signer = signerSha256(context);
            boolean packageExpected = EXPECTED_PACKAGE.equals(pkg);
            boolean signerOfficial = OFFICIAL_SIGNER_SHA256.equalsIgnoreCase(signer);
            boolean debug = BuildConfig.DEBUG;
            boolean integrityOk = packageExpected && (debug || signerOfficial);
            out.put("platform", "ANDROID");
            out.put("packageName", pkg);
            out.put("packageExpected", packageExpected);
            out.put("debug", debug);
            out.put("signerSha256", signer);
            out.put("signerOfficial", signerOfficial);
            out.put("integrityOk", integrityOk);
            out.put("releaseProtectionRequired", !debug);
        } catch (Exception ex) {
            try {
                out.put("platform", "ANDROID");
                out.put("debug", BuildConfig.DEBUG);
                out.put("integrityOk", false);
                out.put("error", ex.getClass().getSimpleName());
            } catch (Exception ignored) {}
        }
        return out;
    }

    public static boolean isAllowedToBoot(Context context) {
        try { return inspect(context).optBoolean("integrityOk", false); }
        catch (Exception ignored) { return false; }
    }

    private static String signerSha256(Context context) throws Exception {
        PackageManager pm = context.getPackageManager();
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageInfo info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null) return "";
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            @SuppressWarnings("deprecation")
            PackageInfo info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
            @SuppressWarnings("deprecation")
            Signature[] legacy = info.signatures;
            signatures = legacy;
        }
        if (signatures == null || signatures.length == 0) return "";
        // Official production builds use one permanent signer. If rotation is added later,
        // the accepted signer set must be versioned server-side and in CI.
        return sha256Hex(signatures[0].toByteArray());
    }

    private static String sha256Hex(byte[] data) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder out = new StringBuilder(digest.length * 2);
        for (byte b : digest) out.append(String.format(Locale.US, "%02x", b & 0xff));
        return out.toString();
    }
}
