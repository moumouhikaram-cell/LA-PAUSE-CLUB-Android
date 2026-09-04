package com.lapauseclub.manager.security;

import android.content.Context;

/**
 * Reserved native facade for the signed entitlement cache.
 *
 * The actual encrypted persistence and anti-rollback policy live in SecureStore
 * so even generic JavaScript secure-value calls cannot bypass verification for
 * the reserved entitlement key.
 */
public final class EntitlementStore {
    public static final String KEY = "saas_entitlement_v1";
    private final SecureStore store;

    public EntitlementStore(Context context) {
        store = new SecureStore(context.getApplicationContext());
    }

    public boolean install(String entitlementJson) {
        return store.put(KEY, entitlementJson);
    }

    public String getVerified() {
        return store.get(KEY);
    }

    public boolean hasVerified() {
        return store.contains(KEY);
    }

    public boolean clear() {
        return store.delete(KEY);
    }
}
