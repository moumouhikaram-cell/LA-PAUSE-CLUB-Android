package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * V10 additive tenant/venue/branch resource registry.
 *
 * The legacy V2 venue/resources tables are intentionally left untouched so an
 * existing 2.3/2.4 installation can still recover from its historical state.
 * V10 is the first native registry whose primary keys and reads are physically
 * scoped by tenant + venue + branch.
 */
final class CoreTenantSchemaV10 {
    static final int SCHEMA_VERSION = 10;
    private static final String FALLBACK_TENANT = "local";
    private static final String FALLBACK_VENUE = "local";
    private static final String FALLBACK_BRANCH = "local";

    private CoreTenantSchemaV10() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS workspace_scope_v10 (" +
                "tenant_id TEXT NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "branch_id TEXT NOT NULL," +
                "is_active INTEGER NOT NULL DEFAULT 0," +
                "revision INTEGER NOT NULL DEFAULT 1," +
                "activated_at_ms INTEGER NOT NULL," +
                "PRIMARY KEY(tenant_id,venue_id,branch_id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_workspace_scope_v10_active ON workspace_scope_v10(is_active,activated_at_ms DESC)");

        db.execSQL("CREATE TABLE IF NOT EXISTS venue_profile_v10 (" +
                "tenant_id TEXT NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "branch_id TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "branch_name TEXT NOT NULL," +
                "currency TEXT NOT NULL," +
                "timezone TEXT NOT NULL," +
                "open_time TEXT," +
                "close_time TEXT," +
                "phone TEXT," +
                "address TEXT," +
                "revision INTEGER NOT NULL DEFAULT 1," +
                "updated_at_ms INTEGER NOT NULL," +
                "PRIMARY KEY(tenant_id,venue_id,branch_id))");

        db.execSQL("CREATE TABLE IF NOT EXISTS resources_v10 (" +
                "tenant_id TEXT NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "branch_id TEXT NOT NULL," +
                "id TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "resource_type TEXT NOT NULL," +
                "legacy_station_type TEXT," +
                "enabled INTEGER NOT NULL," +
                "sort_order INTEGER NOT NULL," +
                "capabilities_json TEXT NOT NULL," +
                "revision INTEGER NOT NULL DEFAULT 1," +
                "updated_at_ms INTEGER NOT NULL," +
                "deleted_at_ms INTEGER," +
                "PRIMARY KEY(tenant_id,venue_id,branch_id,id)," +
                "FOREIGN KEY(tenant_id,venue_id,branch_id) REFERENCES venue_profile_v10(tenant_id,venue_id,branch_id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_resources_v10_scope_sort ON resources_v10(tenant_id,venue_id,branch_id,deleted_at_ms,sort_order,id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_resources_v10_scope_type ON resources_v10(tenant_id,venue_id,branch_id,resource_type)");
    }

    static void migrateLegacy(SQLiteDatabase db, long now) {
        create(db);
        if (scalar(db, "SELECT COUNT(*) FROM workspace_scope_v10") > 0) return;

        Scope scope = profileScope(db);
        markActive(db, scope, 1L, now);
        JSONObject legacyBusiness = readLegacyBusiness(db);
        ensureVenue(db, scope, legacyBusiness, 1L, now);

        try (Cursor c = db.rawQuery(
                "SELECT id,name,resource_type,legacy_station_type,enabled,sort_order,capabilities_json,revision,updated_at_ms,deleted_at_ms FROM resources",
                null)) {
            while (c.moveToNext()) {
                ContentValues v = baseScope(scope);
                v.put("id", c.getString(0));
                v.put("name", c.getString(1));
                v.put("resource_type", c.getString(2));
                if (c.isNull(3)) v.putNull("legacy_station_type"); else v.put("legacy_station_type", c.getString(3));
                v.put("enabled", c.getInt(4));
                v.put("sort_order", c.getInt(5));
                v.put("capabilities_json", c.isNull(6) ? "{}" : c.getString(6));
                v.put("revision", Math.max(1L, c.getLong(7)));
                v.put("updated_at_ms", c.getLong(8) > 0 ? c.getLong(8) : now);
                if (c.isNull(9)) v.putNull("deleted_at_ms"); else v.put("deleted_at_ms", c.getLong(9));
                db.insertWithOnConflict("resources_v10", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }
        } catch (Exception ignored) {
            // A very old database may not yet have the V2 registry. The new
            // scoped registry remains valid and will be populated on dual-write.
        }
        markDomain(db, "WORKSPACE_SCOPE_V10", 1L, now);
        markDomain(db, "RESOURCES_V10", 1L, now);
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, long now) {
        create(db);
        Scope scope = resolveScope(db, root);
        markActive(db, scope, revision, now);
        ensureVenue(db, scope, root == null ? null : root.optJSONObject("business"), revision, now);
        upsertResources(db, scope, root == null ? null : root.optJSONArray("stations"), revision, now);
        markDomain(db, "WORKSPACE_SCOPE_V10", revision, now);
        markDomain(db, "VENUE_PROFILE_V10", revision, now);
        markDomain(db, "RESOURCES_V10", revision, now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject out = new JSONObject();
        try {
            Scope scope = activeScope(db);
            if (scope == null) scope = profileScope(db);
            JSONArray resources = readResources(db, scope);
            out.put("dbSchemaVersion", SCHEMA_VERSION);
            out.put("tenantId", scope.tenantId);
            out.put("venueId", scope.venueId);
            out.put("branchId", scope.branchId);
            out.put("workspace", scope.toJson());
            out.put("venueProfile", readVenue(db, scope));
            out.put("resourceRegistry", resources);
            out.put("resourceCount", resources.length());
            out.put("workspaceCount", scalar(db, "SELECT COUNT(*) FROM workspace_scope_v10"));
            out.put("resourceRowsAllScopes", scalar(db, "SELECT COUNT(*) FROM resources_v10 WHERE deleted_at_ms IS NULL"));
            out.put("normalizedDomains", new JSONArray()
                    .put("WORKSPACE_SCOPE_V10")
                    .put("VENUE_PROFILE_V10")
                    .put("RESOURCES_V10"));
            out.put("legacyV2Preserved", true);
            out.put("isolationMode", "TENANT_VENUE_BRANCH_EXACT");
        } catch (Exception ignored) {}
        return out;
    }

    private static Scope resolveScope(SQLiteDatabase db, JSONObject root) {
        Scope base = activeScope(db);
        if (base == null) base = profileScope(db);
        JSONObject saas = root == null ? null : root.optJSONObject("saas");
        if (saas == null) return base;
        return new Scope(
                nonBlank(saas.optString("tenantId", ""), base.tenantId),
                nonBlank(saas.optString("venueId", ""), base.venueId),
                nonBlank(saas.optString("branchId", ""), base.branchId));
    }

    private static Scope activeScope(SQLiteDatabase db) {
        try (Cursor c = db.rawQuery(
                "SELECT tenant_id,venue_id,branch_id FROM workspace_scope_v10 WHERE is_active=1 ORDER BY activated_at_ms DESC LIMIT 1",
                null)) {
            if (c.moveToFirst()) return new Scope(c.getString(0), c.getString(1), c.getString(2));
        } catch (Exception ignored) {}
        return null;
    }

    private static Scope profileScope(SQLiteDatabase db) {
        try (Cursor c = db.rawQuery(
                "SELECT tenant_id,venue_id,branch_id FROM saas_profile_p5 ORDER BY rowid DESC LIMIT 1",
                null)) {
            if (c.moveToFirst()) {
                return new Scope(
                        nonBlank(c.getString(0), FALLBACK_TENANT),
                        nonBlank(c.getString(1), FALLBACK_VENUE),
                        nonBlank(c.getString(2), FALLBACK_BRANCH));
            }
        } catch (Exception ignored) {}
        return new Scope(FALLBACK_TENANT, FALLBACK_VENUE, FALLBACK_BRANCH);
    }

    private static void markActive(SQLiteDatabase db, Scope scope, long revision, long now) {
        db.execSQL("UPDATE workspace_scope_v10 SET is_active=0 WHERE is_active<>0");
        ContentValues v = baseScope(scope);
        v.put("is_active", 1);
        v.put("revision", Math.max(1L, revision));
        v.put("activated_at_ms", now);
        db.insertWithOnConflict("workspace_scope_v10", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private static void ensureVenue(SQLiteDatabase db, Scope scope, JSONObject business, long revision, long now) {
        ContentValues v = baseScope(scope);
        v.put("name", nonBlank(business == null ? null : business.optString("name", ""), "LA PAUSE OS"));
        v.put("branch_name", nonBlank(business == null ? null : business.optString("branchName", ""), scope.branchId));
        v.put("currency", nonBlank(business == null ? null : business.optString("currency", ""), "MAD"));
        v.put("timezone", nonBlank(business == null ? null : business.optString("timezone", ""), "Africa/Casablanca"));
        v.put("open_time", business == null ? "10:00" : business.optString("openTime", "10:00"));
        v.put("close_time", business == null ? "00:00" : business.optString("closeTime", "00:00"));
        v.put("phone", business == null ? "" : business.optString("phone", ""));
        v.put("address", business == null ? "" : business.optString("address", ""));
        v.put("revision", Math.max(1L, revision));
        v.put("updated_at_ms", now);
        db.insertWithOnConflict("venue_profile_v10", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private static void upsertResources(SQLiteDatabase db, Scope scope, JSONArray stations, long revision, long now) {
        if (stations == null) return;
        db.execSQL(
                "UPDATE resources_v10 SET deleted_at_ms=?,updated_at_ms=? WHERE tenant_id=? AND venue_id=? AND branch_id=? AND deleted_at_ms IS NULL",
                new Object[]{now, now, scope.tenantId, scope.venueId, scope.branchId});

        for (int i = 0; i < stations.length(); i++) {
            JSONObject st = stations.optJSONObject(i);
            if (st == null) continue;
            String id = st.optString("id", "").trim();
            if (id.isEmpty()) continue;
            String legacyType = st.optString("type", "CUSTOM");
            String type = st.optString("osResourceType", "").trim().toUpperCase(java.util.Locale.ROOT);
            if (type.isEmpty()) type = CoreDomainSchemaV2.mapResourceType(legacyType);

            ContentValues v = baseScope(scope);
            v.put("id", id);
            v.put("name", st.optString("name", id));
            v.put("resource_type", type);
            v.put("legacy_station_type", legacyType);
            v.put("enabled", st.optBoolean("enabled", true) ? 1 : 0);
            v.put("sort_order", st.optInt("sort", i + 1));
            v.put("capabilities_json", mergeCapabilities(type, st.optJSONObject("capabilities")).toString());
            v.put("revision", Math.max(1L, revision));
            v.put("updated_at_ms", now);
            v.putNull("deleted_at_ms");
            db.insertWithOnConflict("resources_v10", null, v, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private static JSONObject readLegacyBusiness(SQLiteDatabase db) {
        JSONObject o = new JSONObject();
        try (Cursor c = db.rawQuery(
                "SELECT name,branch_name,currency,timezone,open_time,close_time,phone,address,revision FROM venue_profile ORDER BY updated_at_ms DESC LIMIT 1",
                null)) {
            if (c.moveToFirst()) {
                o.put("name", c.getString(0));
                o.put("branchName", c.getString(1));
                o.put("currency", c.getString(2));
                o.put("timezone", c.getString(3));
                o.put("openTime", c.getString(4));
                o.put("closeTime", c.getString(5));
                o.put("phone", c.isNull(6) ? "" : c.getString(6));
                o.put("address", c.isNull(7) ? "" : c.getString(7));
            }
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONObject readVenue(SQLiteDatabase db, Scope scope) {
        JSONObject o = new JSONObject();
        try (Cursor c = db.rawQuery(
                "SELECT name,branch_name,currency,timezone,open_time,close_time,phone,address,revision,updated_at_ms FROM venue_profile_v10 WHERE tenant_id=? AND venue_id=? AND branch_id=? LIMIT 1",
                new String[]{scope.tenantId, scope.venueId, scope.branchId})) {
            if (c.moveToFirst()) {
                o.put("tenantId", scope.tenantId);
                o.put("venueId", scope.venueId);
                o.put("branchId", scope.branchId);
                o.put("name", c.getString(0));
                o.put("branchName", c.getString(1));
                o.put("currency", c.getString(2));
                o.put("timezone", c.getString(3));
                o.put("openTime", c.getString(4));
                o.put("closeTime", c.getString(5));
                o.put("phone", c.isNull(6) ? "" : c.getString(6));
                o.put("address", c.isNull(7) ? "" : c.getString(7));
                o.put("revision", c.getLong(8));
                o.put("updatedAtMs", c.getLong(9));
            }
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONArray readResources(SQLiteDatabase db, Scope scope) {
        JSONArray out = new JSONArray();
        try (Cursor c = db.rawQuery(
                "SELECT id,name,resource_type,legacy_station_type,enabled,sort_order,capabilities_json,revision,updated_at_ms FROM resources_v10 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND deleted_at_ms IS NULL ORDER BY sort_order,id",
                new String[]{scope.tenantId, scope.venueId, scope.branchId})) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", c.getString(0));
                o.put("tenantId", scope.tenantId);
                o.put("venueId", scope.venueId);
                o.put("branchId", scope.branchId);
                o.put("name", c.getString(1));
                o.put("resourceType", c.getString(2));
                o.put("legacyType", c.isNull(3) ? JSONObject.NULL : c.getString(3));
                o.put("enabled", c.getInt(4) == 1);
                o.put("sort", c.getInt(5));
                try { o.put("capabilities", new JSONObject(c.getString(6))); }
                catch (Exception ignored) { o.put("capabilities", new JSONObject()); }
                o.put("revision", c.getLong(7));
                o.put("updatedAtMs", c.getLong(8));
                out.put(o);
            }
        } catch (Exception ignored) {}
        return out;
    }

    private static JSONObject mergeCapabilities(String type, JSONObject legacy) {
        JSONObject o = defaultCapabilities(type);
        if (legacy == null) return o;
        try {
            String[] keys = {"hasDisplay", "hasController", "hasDeviceAgent", "supportsOverlay", "supportsRemoteControl", "meteredTime", "maxPlayers"};
            for (String k : keys) if (legacy.has(k)) o.put(k, legacy.get(k));
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONObject defaultCapabilities(String type) {
        JSONObject o = new JSONObject();
        try {
            boolean display = "CONSOLE".equals(type) || "SIM_RACING".equals(type) || "PC_GAMING".equals(type) || "PRIVATE_ROOM".equals(type);
            boolean controller = "CONSOLE".equals(type) || "SIM_RACING".equals(type);
            int maxPlayers = "SIM_RACING".equals(type) ? 1 : (("BILLIARD_TABLE".equals(type) || "SNOOKER_TABLE".equals(type)) ? 4 : 2);
            o.put("hasDisplay", display);
            o.put("hasController", controller);
            o.put("hasDeviceAgent", false);
            o.put("supportsOverlay", false);
            o.put("supportsRemoteControl", false);
            o.put("meteredTime", true);
            o.put("maxPlayers", maxPlayers);
        } catch (Exception ignored) {}
        return o;
    }

    private static ContentValues baseScope(Scope scope) {
        ContentValues v = new ContentValues();
        v.put("tenant_id", scope.tenantId);
        v.put("venue_id", scope.venueId);
        v.put("branch_id", scope.branchId);
        return v;
    }

    private static void markDomain(SQLiteDatabase db, String domain, long revision, long now) {
        try {
            ContentValues v = new ContentValues();
            v.put("domain", domain);
            v.put("authority", "SQLITE_DUAL_WRITE");
            v.put("migration_state", "TENANT_SCOPE_PROVING");
            v.put("source_revision", Math.max(0L, revision));
            v.put("updated_at_ms", now);
            db.insertWithOnConflict("domain_authority", null, v, SQLiteDatabase.CONFLICT_REPLACE);
        } catch (Exception ignored) {}
    }

    private static long scalar(SQLiteDatabase db, String sql) {
        try (Cursor c = db.rawQuery(sql, null)) { return c.moveToFirst() ? c.getLong(0) : 0L; }
    }

    private static String nonBlank(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static final class Scope {
        final String tenantId;
        final String venueId;
        final String branchId;
        Scope(String tenantId, String venueId, String branchId) {
            this.tenantId = nonBlank(tenantId, FALLBACK_TENANT);
            this.venueId = nonBlank(venueId, FALLBACK_VENUE);
            this.branchId = nonBlank(branchId, FALLBACK_BRANCH);
        }
        JSONObject toJson() {
            JSONObject o = new JSONObject();
            try {
                o.put("tenantId", tenantId);
                o.put("venueId", venueId);
                o.put("branchId", branchId);
            } catch (Exception ignored) {}
            return o;
        }
    }
}
