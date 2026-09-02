package com.lapauseclub.manager.a1.core;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.UUID;

public final class DeviceIdentity {
    private static final String PREFS = "la_pause_device_identity";
    private static final String KEY_DEVICE_ID = "device_id";

    private DeviceIdentity() {}

    public static String getOrCreate(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String existing = prefs.getString(KEY_DEVICE_ID, null);
        if (existing != null && !existing.trim().isEmpty()) {
            return existing;
        }
        String created = "android-" + UUID.randomUUID();
        prefs.edit().putString(KEY_DEVICE_ID, created).apply();
        return created;
    }
}
