package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.UUID;

/**
 * A2 helper for the first normalized LA PAUSE OS domains.
 * This class is additive: CoreStore v1 data remains untouched and can still recover the app.
 */
final class CoreDomainSchemaV2 {
    static final int SCHEMA_VERSION = 2;
    static final String LOCAL_VENUE_ID = "local-venue";

    private CoreDomainSchemaV2() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS venue_profile (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "name TEXT NOT NULL," +
                "branch_name TEXT NOT NULL," +
                "currency TEXT NOT NULL," +
                "timezone TEXT NOT NULL," +
                "open_time TEXT," +
                "close_time TEXT," +
                "phone TEXT," +
                "address TEXT," +
                "revision INTEGER NOT NULL DEFAULT 1," +
                "updated_at_ms INTEGER NOT NULL)");

        db.execSQL("CREATE TABLE IF NOT EXISTS resources (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "resource_type TEXT NOT NULL," +
                "legacy_station_type TEXT," +
                "enabled INTEGER NOT NULL," +
                "sort_order INTEGER NOT NULL," +
                "capabilities_json TEXT NOT NULL," +
                "revision INTEGER NOT NULL DEFAULT 1," +
                "updated_at_ms INTEGER NOT NULL," +
                "deleted_at_ms INTEGER," +
                "FOREIGN KEY(venue_id) REFERENCES venue_profile(id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_resources_venue_sort ON resources(venue_id, sort_order)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type)");

        db.execSQL("CREATE TABLE IF NOT EXISTS domain_authority (" +
                "domain TEXT PRIMARY KEY NOT NULL," +
                "authority TEXT NOT NULL," +
                "migration_state TEXT NOT NULL," +
                "source_revision INTEGER NOT NULL DEFAULT 0," +
                "updated_at_ms INTEGER NOT NULL)");

        db.execSQL("CREATE TABLE IF NOT EXISTS migration_checkpoints (" +
                "checkpoint_id TEXT PRIMARY KEY NOT NULL," +
                "domain TEXT NOT NULL," +
                "source_revision INTEGER NOT NULL," +
                "source_checksum TEXT," +
                "row_count INTEGER NOT NULL," +
                "status TEXT NOT NULL," +
                "created_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_migration_checkpoint_domain ON migration_checkpoints(domain, created_at_ms DESC)");
    }

    static void migrateShadowResources(SQLiteDatabase db, long now) {
        ensureVenue(db, null, 1L, now);
        if (count(db, "SELECT COUNT(*) FROM resources") > 0) return;
        try (Cursor c = db.rawQuery(
                "SELECT id,name,resource_type,legacy_station_type,enabled,sort_order,updated_at_ms FROM resources_shadow ORDER BY sort_order",
                null)) {
            while (c.moveToNext()) {
                ContentValues v = new ContentValues();
                v.put("id", c.getString(0));
                v.put("venue_id", LOCAL_VENUE_ID);
                v.put("name", c.getString(1));
                v.put("resource_type", c.getString(2));
                v.put("legacy_station_type", c.getString(3));
                v.put("enabled", c.getInt(4));
                v.put("sort_order", c.getInt(5));
                v.put("capabilities_json", defaultCapabilities(c.getString(2)).toString());
                v.put("revision", 1);
                v.put("updated_at_ms", c.getLong(6));
                db.insertWithOnConflict("resources", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }
        }
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, String checksum, long now) {
        ensureVenue(db, root.optJSONObject("business"), revision, now);
        JSONArray stations = root.optJSONArray("stations");
        upsertResources(db, stations, revision, now);
        setAuthority(db, "VENUE", revision, now);
        setAuthority(db, "RESOURCES", revision, now);
        checkpoint(db, "VENUE", revision, checksum, 1, now);
        checkpoint(db, "RESOURCES", revision, checksum, stations == null ? 0 : stations.length(), now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject out = new JSONObject();
        try {
            out.put("dbSchemaVersion", SCHEMA_VERSION);
            out.put("venueProfile", readVenue(db));
            out.put("resourceRegistry", readResources(db));
            out.put("domainAuthority", readAuthority(db));
            out.put("checkpointCount", count(db, "SELECT COUNT(*) FROM migration_checkpoints"));
            out.put("normalizedDomains", new JSONArray().put("VENUE").put("RESOURCES"));
        } catch (Exception ignored) {}
        return out;
    }

    private static void ensureVenue(SQLiteDatabase db, JSONObject business, long revision, long now) {
        ContentValues v = new ContentValues();
        v.put("id", LOCAL_VENUE_ID);
        v.put("name", nonBlank(business == null ? null : business.optString("name"), "LA PAUSE CLUB"));
        v.put("branch_name", nonBlank(business == null ? null : business.optString("branchName"), "El Hajeb"));
        v.put("currency", nonBlank(business == null ? null : business.optString("currency"), "MAD"));
        v.put("timezone", nonBlank(business == null ? null : business.optString("timezone"), "Africa/Casablanca"));
        v.put("open_time", business == null ? "10:00" : business.optString("openTime", "10:00"));
        v.put("close_time", business == null ? "00:00" : business.optString("closeTime", "00:00"));
        v.put("phone", business == null ? "" : business.optString("phone", ""));
        v.put("address", business == null ? "" : business.optString("address", ""));
        v.put("revision", Math.max(1L, revision));
        v.put("updated_at_ms", now);
        db.insertWithOnConflict("venue_profile", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private static void upsertResources(SQLiteDatabase db, JSONArray stations, long revision, long now) {
        if (stations == null) return;
        db.execSQL("UPDATE resources SET deleted_at_ms=? WHERE venue_id=? AND deleted_at_ms IS NULL",
                new Object[]{now, LOCAL_VENUE_ID});
        for (int i = 0; i < stations.length(); i++) {
            JSONObject st = stations.optJSONObject(i);
            if (st == null) continue;
            String id = st.optString("id", "").trim();
            if (id.isEmpty()) continue;
            String legacyType = st.optString("type", "CUSTOM");
            String type = mapResourceType(legacyType);
            ContentValues v = new ContentValues();
            v.put("id", id);
            v.put("venue_id", LOCAL_VENUE_ID);
            v.put("name", st.optString("name", id));
            v.put("resource_type", type);
            v.put("legacy_station_type", legacyType);
            v.put("enabled", st.optBoolean("enabled", true) ? 1 : 0);
            v.put("sort_order", st.optInt("sort", i + 1));
            v.put("capabilities_json", mergeCapabilities(type, st.optJSONObject("capabilities")).toString());
            v.put("revision", Math.max(1L, revision));
            v.put("updated_at_ms", now);
            v.putNull("deleted_at_ms");
            db.insertWithOnConflict("resources", null, v, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private static void setAuthority(SQLiteDatabase db, String domain, long revision, long now) {
        ContentValues v = new ContentValues();
        v.put("domain", domain);
        v.put("authority", "SQLITE_DUAL_WRITE");
        v.put("migration_state", "PARITY_PROVING");
        v.put("source_revision", revision);
        v.put("updated_at_ms", now);
        db.insertWithOnConflict("domain_authority", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private static void checkpoint(SQLiteDatabase db, String domain, long revision, String checksum, int rows, long now) {
        try (Cursor c = db.rawQuery("SELECT checkpoint_id FROM migration_checkpoints WHERE domain=? AND source_revision=? LIMIT 1",
                new String[]{domain, String.valueOf(revision)})) {
            if (c.moveToFirst()) return;
        }
        ContentValues v = new ContentValues();
        v.put("checkpoint_id", "mig-" + domain.toLowerCase(Locale.ROOT) + "-" + UUID.randomUUID());
        v.put("domain", domain);
        v.put("source_revision", revision);
        v.put("source_checksum", checksum);
        v.put("row_count", rows);
        v.put("status", "PARITY_PROVING");
        v.put("created_at_ms", now);
        db.insertOrThrow("migration_checkpoints", null, v);
    }

    private static JSONObject readVenue(SQLiteDatabase db) {
        JSONObject o = new JSONObject();
        try (Cursor c = db.rawQuery("SELECT id,name,branch_name,currency,timezone,open_time,close_time,revision,updated_at_ms FROM venue_profile WHERE id=? LIMIT 1",
                new String[]{LOCAL_VENUE_ID})) {
            if (c.moveToFirst()) {
                o.put("id", c.getString(0)); o.put("name", c.getString(1)); o.put("branchName", c.getString(2));
                o.put("currency", c.getString(3)); o.put("timezone", c.getString(4)); o.put("openTime", c.getString(5));
                o.put("closeTime", c.getString(6)); o.put("revision", c.getLong(7)); o.put("updatedAtMs", c.getLong(8));
            }
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONArray readResources(SQLiteDatabase db) {
        JSONArray a = new JSONArray();
        try (Cursor c = db.rawQuery("SELECT id,name,resource_type,legacy_station_type,enabled,sort_order,capabilities_json,revision,updated_at_ms FROM resources WHERE deleted_at_ms IS NULL ORDER BY sort_order,id", null)) {
            while (c.moveToNext()) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", c.getString(0)); o.put("name", c.getString(1)); o.put("resourceType", c.getString(2));
                    o.put("legacyType", c.getString(3)); o.put("enabled", c.getInt(4) == 1); o.put("sort", c.getInt(5));
                    o.put("capabilities", new JSONObject(c.getString(6))); o.put("revision", c.getLong(7)); o.put("updatedAtMs", c.getLong(8));
                    a.put(o);
                } catch (Exception ignored) {}
            }
        }
        return a;
    }

    private static JSONArray readAuthority(SQLiteDatabase db) {
        JSONArray a = new JSONArray();
        try (Cursor c = db.rawQuery("SELECT domain,authority,migration_state,source_revision,updated_at_ms FROM domain_authority ORDER BY domain", null)) {
            while (c.moveToNext()) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("domain", c.getString(0)); o.put("authority", c.getString(1)); o.put("migrationState", c.getString(2));
                    o.put("sourceRevision", c.getLong(3)); o.put("updatedAtMs", c.getLong(4)); a.put(o);
                } catch (Exception ignored) {}
            }
        }
        return a;
    }

    static String mapResourceType(String legacy) {
        String t = legacy == null ? "" : legacy.trim().toUpperCase(Locale.ROOT);
        if (t.equals("PS5") || t.equals("PS4") || t.equals("XBOX") || t.equals("CONSOLE")) return "CONSOLE";
        if (t.equals("SIM") || t.equals("SIMULATOR") || t.equals("SIM_RACING")) return "SIM_RACING";
        if (t.equals("BILLIARD") || t.equals("BILLIARD_TABLE") || t.equals("POOL")) return "BILLIARD_TABLE";
        if (t.equals("SNOOKER") || t.equals("SNOOKER_TABLE")) return "SNOOKER_TABLE";
        if (t.equals("PC") || t.equals("PC_GAMING")) return "PC_GAMING";
        if (t.equals("TABLE_TENNIS") || t.equals("PING_PONG")) return "TABLE_TENNIS";
        if (t.equals("PRIVATE_ROOM") || t.equals("ROOM")) return "PRIVATE_ROOM";
        return "CUSTOM";
    }

    private static JSONObject mergeCapabilities(String type, JSONObject legacy) {
        JSONObject o = defaultCapabilities(type);
        if (legacy == null) return o;
        try {
            String[] keys = {"hasDisplay","hasController","hasDeviceAgent","supportsOverlay","supportsRemoteControl","meteredTime","maxPlayers"};
            for (String k : keys) if (legacy.has(k)) o.put(k, legacy.get(k));
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONObject defaultCapabilities(String type) {
        JSONObject o = new JSONObject();
        try {
            boolean display = type.equals("CONSOLE") || type.equals("SIM_RACING") || type.equals("PC_GAMING") || type.equals("PRIVATE_ROOM");
            boolean controller = type.equals("CONSOLE") || type.equals("SIM_RACING");
            int maxPlayers = type.equals("SIM_RACING") ? 1 : (type.equals("BILLIARD_TABLE") || type.equals("SNOOKER_TABLE") ? 4 : 2);
            o.put("hasDisplay", display); o.put("hasController", controller); o.put("hasDeviceAgent", false);
            o.put("supportsOverlay", false); o.put("supportsRemoteControl", false); o.put("meteredTime", true); o.put("maxPlayers", maxPlayers);
        } catch (Exception ignored) {}
        return o;
    }

    private static long count(SQLiteDatabase db, String sql) {
        try (Cursor c = db.rawQuery(sql, null)) { return c.moveToFirst() ? c.getLong(0) : 0L; }
    }

    private static String nonBlank(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}
