package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Transport-facing view over the canonical V11 event outbox.
 *
 * This class does not perform network I/O and does not apply remote state. It only
 * exposes already-committed canonical events and scoped ACK/failure bookkeeping so
 * the WebView transport cannot fall back to the legacy mutable state.outbox.
 */
public final class CoreSyncTransportV12 {
    public static final String PROTOCOL_VERSION = "la-pause-sync/2";
    public static final int SCHEMA_VERSION = 2;
    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 250;
    private static final long RETRY_DELAY_MS = 15_000L;

    private CoreSyncTransportV12() {}

    public static JSONObject pendingBatch(SQLiteDatabase db, String tenantId, String venueId, String branchId, int requestedLimit, long now) {
        String tenant = required(tenantId, "tenantId");
        String venue = required(venueId, "venueId");
        String branch = required(branchId, "branchId");
        int limit = requestedLimit <= 0 ? DEFAULT_LIMIT : Math.min(requestedLimit, MAX_LIMIT);
        JSONObject out = new JSONObject();
        JSONArray events = new JSONArray();
        String sql = "SELECT e.event_id,e.event_type,e.tenant_id,e.venue_id,e.branch_id,e.station_id,e.device_id," +
                "e.entity_type,e.entity_id,e.actor_id,e.server_timestamp_ms,e.payload_json,e.correlation_id,e.causation_id," +
                "e.idempotency_key,e.severity,e.schema_version,o.attempts,o.created_at_ms " +
                "FROM outbox_events_v11 o JOIN domain_events_v11 e ON e.event_id=o.event_id " +
                "WHERE o.tenant_id=? AND o.venue_id=? AND o.branch_id=? AND o.status='PENDING' AND o.dead_letter=0 " +
                "AND (o.next_attempt_at_ms IS NULL OR o.next_attempt_at_ms<=?) ORDER BY o.created_at_ms ASC LIMIT ?";
        try (Cursor c = db.rawQuery(sql, new String[]{tenant, venue, branch, String.valueOf(now), String.valueOf(limit)})) {
            while (c.moveToNext()) {
                JSONObject event = new JSONObject();
                event.put("eventId", c.getString(0));
                event.put("eventType", c.getString(1));
                event.put("tenantId", c.getString(2));
                event.put("venueId", c.getString(3));
                event.put("branchId", c.getString(4));
                putNullable(event, "stationId", c, 5);
                putNullable(event, "deviceId", c, 6);
                putNullable(event, "entityType", c, 7);
                putNullable(event, "entityId", c, 8);
                putNullable(event, "actorId", c, 9);
                event.put("serverTimestamp", c.getLong(10));
                event.put("payload", parseJsonValue(c.getString(11)));
                putNullable(event, "correlationId", c, 12);
                putNullable(event, "causationId", c, 13);
                event.put("idempotencyKey", c.getString(14));
                event.put("severity", c.getString(15));
                event.put("schemaVersion", c.getInt(16));
                event.put("attempts", c.getInt(17));
                event.put("createdAt", c.getLong(18));
                events.put(event);
            }
        }
        JSONObject scope = new JSONObject();
        scope.put("tenantId", tenant);
        scope.put("venueId", venue);
        scope.put("branchId", branch);
        out.put("schemaVersion", SCHEMA_VERSION);
        out.put("protocolVersion", PROTOCOL_VERSION);
        out.put("scope", scope);
        out.put("events", events);
        out.put("eventCount", events.length());
        out.put("generatedAt", now);
        return out;
    }

    public static int acknowledge(SQLiteDatabase db, String tenantId, String venueId, String branchId, JSONArray eventIds, long now) {
        String tenant = required(tenantId, "tenantId");
        String venue = required(venueId, "venueId");
        String branch = required(branchId, "branchId");
        if (eventIds == null || eventIds.length() == 0) return 0;
        int changed = 0;
        db.beginTransaction();
        try {
            for (int i = 0; i < eventIds.length(); i++) {
                String eventId = eventIds.optString(i, "").trim();
                if (eventId.isEmpty()) continue;
                ContentValues values = new ContentValues();
                values.put("status", "ACKED");
                values.putNull("last_error");
                values.putNull("next_attempt_at_ms");
                changed += db.update("outbox_events_v11", values,
                        "event_id=? AND tenant_id=? AND venue_id=? AND branch_id=? AND status='PENDING'",
                        new String[]{eventId, tenant, venue, branch});
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return changed;
    }

    public static int markFailed(SQLiteDatabase db, String tenantId, String venueId, String branchId, JSONArray eventIds, String error, long now) {
        String tenant = required(tenantId, "tenantId");
        String venue = required(venueId, "venueId");
        String branch = required(branchId, "branchId");
        if (eventIds == null || eventIds.length() == 0) return 0;
        String message = error == null ? "SYNC_FAILED" : error.trim();
        if (message.length() > 500) message = message.substring(0, 500);
        int changed = 0;
        db.beginTransaction();
        try {
            for (int i = 0; i < eventIds.length(); i++) {
                String eventId = eventIds.optString(i, "").trim();
                if (eventId.isEmpty()) continue;
                db.execSQL("UPDATE outbox_events_v11 SET attempts=attempts+1,last_error=?,next_attempt_at_ms=? " +
                                "WHERE event_id=? AND tenant_id=? AND venue_id=? AND branch_id=? AND status='PENDING'",
                        new Object[]{message, now + RETRY_DELAY_MS, eventId, tenant, venue, branch});
                changed += scalar(db, "SELECT changes()", null);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return changed;
    }

    private static Object parseJsonValue(String raw) {
        if (raw == null || raw.trim().isEmpty()) return new JSONObject();
        try {
            Object parsed = new JSONTokener(raw).nextValue();
            return parsed == null ? JSONObject.NULL : parsed;
        } catch (Exception ignored) {
            return raw;
        }
    }

    private static void putNullable(JSONObject target, String key, Cursor cursor, int index) {
        if (cursor.isNull(index)) target.put(key, JSONObject.NULL);
        else target.put(key, cursor.getString(index));
    }

    private static String required(String value, String label) {
        String out = value == null ? "" : value.trim();
        if (out.isEmpty()) throw new IllegalArgumentException(label + " required");
        return out;
    }

    private static int scalar(SQLiteDatabase db, String sql, String[] args) {
        try (Cursor c = db.rawQuery(sql, args)) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }
}
