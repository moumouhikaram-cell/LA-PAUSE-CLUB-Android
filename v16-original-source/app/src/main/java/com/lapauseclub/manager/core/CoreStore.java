package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

public final class CoreStore extends SQLiteOpenHelper {
    public static final String DB_NAME = "la_pause_core_v16.db";
    private static final int DB_VERSION = 3;
    private static final int MAX_SNAPSHOTS = 20;

    public CoreStore(Context context) { super(context, DB_NAME, null, DB_VERSION); setWriteAheadLoggingEnabled(true); }
    @Override public void onConfigure(SQLiteDatabase db) { super.onConfigure(db); db.setForeignKeyConstraintsEnabled(true); }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE core_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)");
        db.execSQL("CREATE TABLE state_snapshots (id TEXT PRIMARY KEY NOT NULL,checksum_sha256 TEXT NOT NULL,state_json TEXT NOT NULL,source TEXT NOT NULL,legacy_schema_version INTEGER,data_revision INTEGER,created_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX idx_state_snapshots_created ON state_snapshots(created_at_ms DESC)");
        db.execSQL("CREATE TABLE resources_shadow (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,resource_type TEXT NOT NULL,legacy_station_type TEXT,enabled INTEGER NOT NULL,sort_order INTEGER NOT NULL,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE domain_events (event_id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL,entity_id TEXT,payload_json TEXT,event_at_ms INTEGER,legacy_revision INTEGER,imported_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE sync_outbox (event_id TEXT PRIMARY KEY NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,next_attempt_at_ms INTEGER,created_at_ms INTEGER NOT NULL,FOREIGN KEY(event_id) REFERENCES domain_events(event_id))");
        CoreDomainSchemaV2.create(db);
        CoreOperationalSchemaP1.create(db);
        CoreBusinessSchemaP1.create(db);
        putMeta(db, "migration_mode", "DOMAIN_DUAL_WRITE");
        putMeta(db, "operating_mode", "STANDALONE");
        putMeta(db, "authority_state", "TABLET_PRIMARY");
        putMeta(db, "core_schema_version", String.valueOf(DB_VERSION));
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (newVersion != DB_VERSION || oldVersion < 1 || oldVersion > DB_VERSION) throw new IllegalStateException("Unsupported non-destructive CoreStore migration: " + oldVersion + " -> " + newVersion);
        db.beginTransaction();
        try {
            if (oldVersion < 2) { CoreDomainSchemaV2.create(db); CoreDomainSchemaV2.migrateShadowResources(db, System.currentTimeMillis()); }
            if (oldVersion < 3) { CoreOperationalSchemaP1.create(db); CoreBusinessSchemaP1.create(db); }
            putMeta(db, "core_schema_version", String.valueOf(DB_VERSION)); putMeta(db, "migration_mode", "DOMAIN_DUAL_WRITE"); db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    public synchronized void bootstrapFromLegacy(String json) { if (json == null || json.trim().isEmpty()) return; mirrorLegacyState(json, "BOOTSTRAP"); }
    public synchronized void mirrorLegacyState(String json) { mirrorLegacyState(json, "LEGACY_SAVE"); }

    private void mirrorLegacyState(String json, String source) {
        if (json == null || json.trim().isEmpty()) return;
        final JSONObject root; try { root = new JSONObject(json); } catch (Exception invalid) { return; }
        final String checksum = sha256(json); final long now = System.currentTimeMillis(); final int schemaVersion = root.optInt("schemaVersion", 0); final JSONObject meta = root.optJSONObject("meta"); final long dataRevision = meta == null ? 0L : meta.optLong("dataRevision", 0L);
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            boolean snapshotNeeded = true;
            try (Cursor c = db.rawQuery("SELECT checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT 1", null)) { if (c.moveToFirst() && checksum.equals(c.getString(0))) snapshotNeeded = false; }
            if (snapshotNeeded) {
                ContentValues snapshot = new ContentValues(); snapshot.put("id", "snapshot-" + UUID.randomUUID()); snapshot.put("checksum_sha256", checksum); snapshot.put("state_json", json); snapshot.put("source", source); snapshot.put("legacy_schema_version", schemaVersion); snapshot.put("data_revision", dataRevision); snapshot.put("created_at_ms", now); db.insertOrThrow("state_snapshots", null, snapshot);
                db.execSQL("DELETE FROM state_snapshots WHERE id NOT IN (SELECT id FROM state_snapshots ORDER BY created_at_ms DESC LIMIT " + MAX_SNAPSHOTS + ")");
            }
            mirrorStations(db, root.optJSONArray("stations"), now); importLegacyEvents(db, root.optJSONArray("outbox"), now);
            CoreDomainSchemaV2.dualWrite(db, root, dataRevision, checksum, now);
            CoreOperationalSchemaP1.dualWrite(db, root, dataRevision, checksum, now);
            CoreBusinessSchemaP1.dualWrite(db, root, dataRevision, now);
            putMeta(db, "migration_mode", "DOMAIN_DUAL_WRITE"); putMeta(db, "legacy_schema_version", String.valueOf(schemaVersion)); putMeta(db, "legacy_data_revision", String.valueOf(dataRevision)); putMeta(db, "last_mirror_checksum", checksum); putMeta(db, "last_mirror_at_ms", String.valueOf(now));
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    private static void mirrorStations(SQLiteDatabase db, JSONArray stations, long now) {
        if (stations == null) return; db.delete("resources_shadow", null, null);
        for (int i = 0; i < stations.length(); i++) { JSONObject station = stations.optJSONObject(i); if (station == null) continue; String id = station.optString("id", "").trim(); if (id.isEmpty()) continue; String legacyType = station.optString("type", "CUSTOM"); String resourceType = station.optString("osResourceType", CoreDomainSchemaV2.mapResourceType(legacyType)); ContentValues v = new ContentValues(); v.put("id", id); v.put("name", station.optString("name", id)); v.put("resource_type", resourceType); v.put("legacy_station_type", legacyType); v.put("enabled", station.optBoolean("enabled", true) ? 1 : 0); v.put("sort_order", station.optInt("sort", i + 1)); v.put("updated_at_ms", now); db.insertWithOnConflict("resources_shadow", null, v, SQLiteDatabase.CONFLICT_REPLACE); }
    }

    private static void importLegacyEvents(SQLiteDatabase db, JSONArray events, long now) {
        if (events == null) return;
        for (int i = 0; i < events.length(); i++) { JSONObject event = events.optJSONObject(i); if (event == null) continue; String eventId = event.optString("id", "").trim(); if (eventId.isEmpty()) continue; ContentValues v = new ContentValues(); v.put("event_id", eventId); v.put("event_type", event.optString("type", "legacy.unknown")); String entityId = event.optString("entityId", ""); if (!entityId.isEmpty()) v.put("entity_id", entityId); Object payload = event.opt("payload"); v.put("payload_json", payload == null || payload == JSONObject.NULL ? null : String.valueOf(payload)); v.put("event_at_ms", event.optLong("at", now)); v.put("legacy_revision", event.optLong("revision", 0L)); v.put("imported_at_ms", now); long inserted = db.insertWithOnConflict("domain_events", null, v, SQLiteDatabase.CONFLICT_IGNORE); if (inserted != -1) { ContentValues outbox = new ContentValues(); outbox.put("event_id", eventId); outbox.put("status", "PENDING"); outbox.put("attempts", 0); outbox.put("created_at_ms", now); db.insertWithOnConflict("sync_outbox", null, outbox, SQLiteDatabase.CONFLICT_IGNORE); } }
    }

    public synchronized String recoverLatestValidStateJson() {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.rawQuery("SELECT state_json,checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT " + MAX_SNAPSHOTS, null)) { while (c.moveToNext()) { String json = c.getString(0), checksum = c.getString(1); try { new JSONObject(json); if (checksum.equals(sha256(json))) return json; } catch (Exception ignored) {} } }
        return "";
    }

    public synchronized JSONObject getStatusJson() {
        SQLiteDatabase db = getReadableDatabase(); JSONObject out = new JSONObject();
        try {
            JSONObject a2 = CoreDomainSchemaV2.status(db); JSONObject p1 = CoreOperationalSchemaP1.status(db); JSONObject business = CoreBusinessSchemaP1.status(db); JSONArray resourceRegistry = a2.optJSONArray("resourceRegistry");
            out.put("coreVersion", "p1-dev.2"); out.put("dbSchemaVersion", DB_VERSION); out.put("migrationMode", getMeta(db, "migration_mode", "DOMAIN_DUAL_WRITE")); out.put("operatingMode", getMeta(db, "operating_mode", "STANDALONE")); out.put("authorityState", getMeta(db, "authority_state", "TABLET_PRIMARY")); out.put("legacySchemaVersion", parseLong(getMeta(db, "legacy_schema_version", "0"))); out.put("legacyDataRevision", parseLong(getMeta(db, "legacy_data_revision", "0"))); out.put("lastMirrorAtMs", parseLong(getMeta(db, "last_mirror_at_ms", "0")));
            out.put("snapshotCount", scalarLong(db, "SELECT COUNT(*) FROM state_snapshots")); out.put("resourceCount", resourceRegistry == null ? 0 : resourceRegistry.length()); out.put("eventCount", scalarLong(db, "SELECT COUNT(*) FROM domain_events")); out.put("pendingSyncCount", scalarLong(db, "SELECT COUNT(*) FROM sync_outbox WHERE status='PENDING'")); out.put("checkpointCount", scalarLong(db, "SELECT COUNT(*) FROM migration_checkpoints")); out.put("venueProfile", a2.optJSONObject("venueProfile")); out.put("resourceRegistry", resourceRegistry); out.put("domainAuthority", a2.optJSONArray("domainAuthority")); out.put("normalizedDomains", a2.optJSONArray("normalizedDomains")); out.put("p1Operational", p1); out.put("p1Business", business);
            out.put("authorityProgress", "P1_CORE_DUAL_WRITE_17_DOMAINS"); out.put("legacyStillAuthoritative", true); out.put("networkRequired", false);
        } catch (Exception ignored) {}
        return out;
    }

    public synchronized String getOperatingMode() { return getMeta(getReadableDatabase(), "operating_mode", "STANDALONE"); }
    public synchronized void setOperatingMode(String mode) { String normalized = mode == null ? "" : mode.trim().toUpperCase(Locale.ROOT); if (!"STANDALONE".equals(normalized) && !"CONNECTED_LOCAL".equals(normalized)) throw new IllegalArgumentException("Unsupported operating mode"); SQLiteDatabase db = getWritableDatabase(); putMeta(db, "operating_mode", normalized); putMeta(db, "authority_state", "TABLET_PRIMARY"); }
    private static void putMeta(SQLiteDatabase db, String key, String value) { ContentValues v = new ContentValues(); v.put("key", key); v.put("value", value == null ? "" : value); db.insertWithOnConflict("core_meta", null, v, SQLiteDatabase.CONFLICT_REPLACE); }
    private static String getMeta(SQLiteDatabase db, String key, String fallback) { try (Cursor c = db.rawQuery("SELECT value FROM core_meta WHERE key=?", new String[]{key})) { return c.moveToFirst() ? c.getString(0) : fallback; } }
    private static long scalarLong(SQLiteDatabase db, String sql) { try (Cursor c = db.rawQuery(sql, null)) { c.moveToFirst(); return c.getLong(0); } }
    private static long parseLong(String value) { try { return Long.parseLong(value); } catch (Exception ignored) { return 0L; } }
    private static String sha256(String value) { try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8)); StringBuilder sb = new StringBuilder(bytes.length * 2); for (byte b : bytes) sb.append(String.format(Locale.ROOT, "%02x", b & 0xff)); return sb.toString(); } catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable", e); } }
}
