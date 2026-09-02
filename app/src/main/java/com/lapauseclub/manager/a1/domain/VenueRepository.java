package com.lapauseclub.manager.a1.domain;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.SystemClock;

import com.lapauseclub.manager.a1.core.AuthorityState;
import com.lapauseclub.manager.a1.core.OperatingMode;
import com.lapauseclub.manager.a1.core.ResourceCapabilities;
import com.lapauseclub.manager.a1.core.ResourceType;
import com.lapauseclub.manager.a1.data.AppDatabase;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

public final class VenueRepository {
    private final AppDatabase helper;
    private final String deviceId;

    public VenueRepository(AppDatabase helper, String deviceId) {
        this.helper = helper;
        this.deviceId = deviceId;
    }

    private static String id(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    public synchronized JSONObject bootstrap() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = new JSONObject();
        out.put("deviceId", deviceId);

        try (Cursor c = db.rawQuery(
                "SELECT id,name,currency,operating_mode,authority_state,billing_increment_minutes,minimum_charge_minutes " +
                        "FROM venues ORDER BY created_at_ms LIMIT 1", null)) {
            if (!c.moveToFirst()) {
                out.put("initialized", false);
                out.put("resources", new JSONArray());
                out.put("activeSessions", new JSONArray());
                return out;
            }
            JSONObject venue = venueFromCursor(c);
            out.put("initialized", true);
            out.put("venue", venue);
            String venueId = venue.getString("id");
            out.put("resources", listResourcesInternal(db, venueId));
            out.put("activeSessions", listActiveSessionsInternal(db, venueId));
            out.put("recentSessions", listRecentSessionsInternal(db, venueId, 20));
            out.put("dashboard", dashboardInternal(db, venueId));
        }
        return out;
    }

    public synchronized JSONObject initializeVenue(String venueName, String currency, OperatingMode mode)
            throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        long now = System.currentTimeMillis();

        try (Cursor existing = db.rawQuery("SELECT COUNT(*) FROM venues", null)) {
            existing.moveToFirst();
            if (existing.getInt(0) > 0) throw new IllegalStateException("Venue already initialized");
        }

        String venueId = id("venue");
        AuthorityState authority = AuthorityState.TABLET_PRIMARY;

        db.beginTransaction();
        try {
            ContentValues venue = new ContentValues();
            venue.put("id", venueId);
            venue.put("name", sanitizeName(venueName, "Ma salle"));
            venue.put("currency", sanitizeCurrency(currency));
            venue.put("operating_mode", mode.name());
            venue.put("authority_state", authority.name());
            venue.put("billing_increment_minutes", 1);
            venue.put("minimum_charge_minutes", 1);
            venue.put("created_at_ms", now);
            venue.put("updated_at_ms", now);
            db.insertOrThrow("venues", null, venue);

            ContentValues lease = new ContentValues();
            lease.put("id", id("lease"));
            lease.put("venue_id", venueId);
            lease.put("authority_state", authority.name());
            lease.put("holder_device_id", deviceId);
            lease.put("lease_version", 1);
            lease.put("issued_at_ms", now);
            db.insertOrThrow("authority_leases", null, lease);

            appendEvent(db, venueId, "VENUE_INITIALIZED", "venue", venueId,
                    new JSONObject().put("operatingMode", mode.name())
                            .put("authorityState", authority.name()));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return bootstrap();
    }

    public synchronized JSONObject addResource(
            String name, ResourceType type, long ratePerHourMinor, int maxPlayers,
            int billingIncrementMinutes, int minimumChargeMinutes
    ) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        JSONObject venue = requireVenue(db);
        String venueId = venue.getString("id");
        String resourceId = id("resource");
        long now = System.currentTimeMillis();

        ResourceCapabilities defaults = ResourceCapabilities.defaultsFor(type);
        ResourceCapabilities caps = new ResourceCapabilities(
                defaults.meteredTime, defaults.hasDisplay, defaults.hasController,
                defaults.supportsOverlay, defaults.supportsRemoteControl,
                maxPlayers > 0 ? maxPlayers : defaults.maxPlayers
        );
        int increment = clampIncrement(billingIncrementMinutes);
        int minimum = clampMinimum(minimumChargeMinutes);

        db.beginTransaction();
        try {
            ContentValues v = new ContentValues();
            v.put("id", resourceId);
            v.put("venue_id", venueId);
            v.put("name", sanitizeName(name, type.name()));
            v.put("resource_type", type.name());
            v.put("rate_per_hour_minor", Math.max(0L, ratePerHourMinor));
            v.put("billing_increment_minutes", increment);
            v.put("minimum_charge_minutes", minimum);
            v.put("metered_time", caps.meteredTime ? 1 : 0);
            v.put("has_display", caps.hasDisplay ? 1 : 0);
            v.put("has_controller", caps.hasController ? 1 : 0);
            v.put("supports_overlay", caps.supportsOverlay ? 1 : 0);
            v.put("supports_remote_control", caps.supportsRemoteControl ? 1 : 0);
            v.put("max_players", caps.maxPlayers);
            v.put("status", "AVAILABLE");
            v.put("created_at_ms", now);
            v.put("updated_at_ms", now);
            db.insertOrThrow("resources", null, v);

            appendEvent(db, venueId, "RESOURCE_CREATED", "resource", resourceId,
                    new JSONObject()
                            .put("name", sanitizeName(name, type.name()))
                            .put("resourceType", type.name())
                            .put("ratePerHourMinor", Math.max(0L, ratePerHourMinor))
                            .put("billingIncrementMinutes", increment)
                            .put("minimumChargeMinutes", minimum)
                            .put("capabilities", caps.toJson()));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return getResource(db, resourceId);
    }

    public synchronized JSONObject startSession(
            String resourceId, String customerName, int playerCount, String bootMarker
    ) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        JSONObject venue = requireVenue(db);
        String venueId = venue.getString("id");
        JSONObject resource = getResource(db, resourceId);

        if (!"AVAILABLE".equals(resource.getString("status"))) {
            throw new IllegalStateException("Resource is not available");
        }
        int maxPlayers = resource.getInt("maxPlayers");
        int players = Math.max(1, playerCount);
        if (players > maxPlayers) throw new IllegalStateException("Player count exceeds resource capacity");

        int increment = resource.optInt("billingIncrementMinutes", 0);
        int minimum = resource.optInt("minimumChargeMinutes", 0);
        if (increment <= 0) increment = venue.getInt("billingIncrementMinutes");
        if (minimum <= 0) minimum = venue.getInt("minimumChargeMinutes");

        String sessionId = id("session");
        long nowWall = System.currentTimeMillis();
        long nowElapsed = SystemClock.elapsedRealtime();

        db.beginTransaction();
        try {
            ContentValues s = new ContentValues();
            s.put("id", sessionId);
            s.put("venue_id", venueId);
            s.put("resource_id", resourceId);
            s.put("customer_name", sanitizeOptional(customerName));
            s.put("player_count", players);
            s.put("status", "ACTIVE");
            s.put("started_wall_ms", nowWall);
            s.put("started_elapsed_ms", nowElapsed);
            s.put("started_boot_marker", bootMarker == null ? "unknown" : bootMarker);
            s.put("rate_per_hour_minor", resource.getLong("ratePerHourMinor"));
            s.put("billing_increment_minutes", clampIncrement(increment));
            s.put("minimum_charge_minutes", clampMinimum(minimum));
            s.put("created_at_ms", nowWall);
            s.put("updated_at_ms", nowWall);
            db.insertOrThrow("sessions", null, s);

            ContentValues r = new ContentValues();
            r.put("status", "OCCUPIED");
            r.put("updated_at_ms", nowWall);
            db.update("resources", r, "id=?", new String[]{resourceId});

            appendEvent(db, venueId, "SESSION_STARTED", "session", sessionId,
                    new JSONObject().put("resourceId", resourceId)
                            .put("playerCount", players)
                            .put("ratePerHourMinor", resource.getLong("ratePerHourMinor"))
                            .put("billingIncrementMinutes", clampIncrement(increment))
                            .put("minimumChargeMinutes", clampMinimum(minimum)));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return getSession(db, sessionId);
    }

    public synchronized JSONObject previewStopSession(String sessionId, String currentBootMarker)
            throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject venue = requireVenue(db);
        JSONObject session = getSession(db, sessionId);
        if (!"ACTIVE".equals(session.getString("status"))) {
            throw new IllegalStateException("Session is not active");
        }
        return calculatePreview(session, venue, currentBootMarker);
    }

    public synchronized JSONObject stopSession(
            String sessionId, String paymentMethod, String currentBootMarker
    ) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        JSONObject venue = requireVenue(db);
        String venueId = venue.getString("id");
        JSONObject session = getSession(db, sessionId);

        if (!"ACTIVE".equals(session.getString("status"))) {
            throw new IllegalStateException("Session is not active");
        }

        JSONObject preview = calculatePreview(session, venue, currentBootMarker);
        long nowWall = System.currentTimeMillis();
        long durationSeconds = preview.getLong("durationSeconds");
        String durationSource = preview.getString("durationSource");
        long amountMinor = preview.getLong("amountMinor");
        String method = sanitizePaymentMethod(paymentMethod);
        String paymentId = id("payment");

        db.beginTransaction();
        try {
            ContentValues s = new ContentValues();
            s.put("status", "COMPLETED");
            s.put("ended_wall_ms", nowWall);
            s.put("duration_seconds", durationSeconds);
            s.put("duration_source", durationSource);
            s.put("amount_minor", amountMinor);
            s.put("payment_method", method);
            s.put("updated_at_ms", nowWall);
            int changed = db.update("sessions", s, "id=? AND status='ACTIVE'", new String[]{sessionId});
            if (changed != 1) throw new IllegalStateException("Session was already changed");

            ContentValues p = new ContentValues();
            p.put("id", paymentId);
            p.put("venue_id", venueId);
            p.put("session_id", sessionId);
            p.put("amount_minor", amountMinor);
            p.put("method", method);
            p.put("status", "RECORDED");
            p.put("created_at_ms", nowWall);
            db.insertOrThrow("payments", null, p);

            ContentValues r = new ContentValues();
            r.put("status", "AVAILABLE");
            r.put("updated_at_ms", nowWall);
            db.update("resources", r, "id=?", new String[]{session.getString("resourceId")});

            appendEvent(db, venueId, "SESSION_COMPLETED", "session", sessionId,
                    new JSONObject().put("durationSeconds", durationSeconds)
                            .put("durationSource", durationSource)
                            .put("amountMinor", amountMinor)
                            .put("billingIncrementMinutes", preview.getInt("billingIncrementMinutes"))
                            .put("minimumChargeMinutes", preview.getInt("minimumChargeMinutes")));
            appendEvent(db, venueId, "PAYMENT_RECORDED", "payment", paymentId,
                    new JSONObject().put("sessionId", sessionId)
                            .put("amountMinor", amountMinor).put("method", method));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }

        return new JSONObject().put("session", getSession(db, sessionId))
                .put("paymentId", paymentId)
                .put("dashboard", dashboardInternal(db, venueId));
    }

    private JSONObject calculatePreview(JSONObject session, JSONObject venue, String currentBootMarker)
            throws JSONException {
        long nowWall = System.currentTimeMillis();
        long nowElapsed = SystemClock.elapsedRealtime();
        long durationSeconds;
        String durationSource;

        String startedBoot = session.getString("startedBootMarker");
        long startedElapsed = session.getLong("startedElapsedMs");
        long startedWall = session.getLong("startedWallMs");

        if (currentBootMarker != null && currentBootMarker.equals(startedBoot) && nowElapsed >= startedElapsed) {
            durationSeconds = (nowElapsed - startedElapsed) / 1000L;
            durationSource = "ELAPSED_REALTIME";
        } else {
            durationSeconds = Math.max(0L, (nowWall - startedWall) / 1000L);
            durationSource = "WALL_CLOCK_FALLBACK";
        }

        int increment = session.optInt("billingIncrementMinutes", 0);
        int minimum = session.optInt("minimumChargeMinutes", 0);
        if (increment <= 0) increment = venue.getInt("billingIncrementMinutes");
        if (minimum <= 0) minimum = venue.getInt("minimumChargeMinutes");
        increment = clampIncrement(increment);
        minimum = clampMinimum(minimum);

        long amountMinor = BillingEngine.calculateAmountMinor(
                durationSeconds, session.getLong("ratePerHourMinor"), increment, minimum
        );

        return new JSONObject()
                .put("durationSeconds", durationSeconds)
                .put("durationSource", durationSource)
                .put("ratePerHourMinor", session.getLong("ratePerHourMinor"))
                .put("billingIncrementMinutes", increment)
                .put("minimumChargeMinutes", minimum)
                .put("amountMinor", amountMinor);
    }

    public synchronized JSONObject setBillingPolicy(int incrementMinutes, int minimumMinutes)
            throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        JSONObject venue = requireVenue(db);
        long now = System.currentTimeMillis();
        int increment = clampIncrement(incrementMinutes);
        int minimum = clampMinimum(minimumMinutes);

        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("billing_increment_minutes", increment);
            values.put("minimum_charge_minutes", minimum);
            values.put("updated_at_ms", now);
            db.update("venues", values, "id=?", new String[]{venue.getString("id")});

            appendEvent(db, venue.getString("id"), "VENUE_BILLING_POLICY_CHANGED", "venue", venue.getString("id"),
                    new JSONObject().put("billingIncrementMinutes", increment)
                            .put("minimumChargeMinutes", minimum));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return requireVenue(db);
    }

    public synchronized JSONObject setResourceBillingPolicy(
            String resourceId, int incrementMinutes, int minimumMinutes
    ) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        JSONObject venue = requireVenue(db);
        getResource(db, resourceId);
        int increment = clampIncrement(incrementMinutes);
        int minimum = clampMinimum(minimumMinutes);
        long now = System.currentTimeMillis();

        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("billing_increment_minutes", increment);
            values.put("minimum_charge_minutes", minimum);
            values.put("updated_at_ms", now);
            int changed = db.update("resources", values, "id=?", new String[]{resourceId});
            if (changed != 1) throw new IllegalArgumentException("Unknown resource");

            appendEvent(db, venue.getString("id"), "RESOURCE_BILLING_POLICY_CHANGED", "resource", resourceId,
                    new JSONObject().put("billingIncrementMinutes", increment)
                            .put("minimumChargeMinutes", minimum));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return getResource(db, resourceId);
    }

    private JSONObject dashboardInternal(SQLiteDatabase db, String venueId) throws JSONException {
        JSONObject out = new JSONObject();
        out.put("resourceCount", scalarLong(db,
                "SELECT COUNT(*) FROM resources WHERE venue_id=?", new String[]{venueId}));
        out.put("activeSessionCount", scalarLong(db,
                "SELECT COUNT(*) FROM sessions WHERE venue_id=? AND status='ACTIVE'", new String[]{venueId}));
        out.put("todayRevenueMinor", scalarLong(db,
                "SELECT COALESCE(SUM(amount_minor),0) FROM payments WHERE venue_id=? " +
                        "AND status='RECORDED' AND created_at_ms>=?",
                new String[]{venueId, String.valueOf(startOfLocalDayMs())}));
        out.put("pendingOutboxCount", scalarLong(db,
                "SELECT COUNT(*) FROM outbox_events WHERE status='PENDING'", null));
        out.put("localEventCount", scalarLong(db,
                "SELECT COUNT(*) FROM domain_events WHERE venue_id=?", new String[]{venueId}));
        return out;
    }

    private JSONArray listResourcesInternal(SQLiteDatabase db, String venueId) throws JSONException {
        JSONArray out = new JSONArray();
        try (Cursor c = db.rawQuery(
                "SELECT id,name,resource_type,rate_per_hour_minor,billing_increment_minutes,minimum_charge_minutes," +
                        "metered_time,has_display,has_controller,supports_overlay,supports_remote_control,max_players,status " +
                        "FROM resources WHERE venue_id=? ORDER BY created_at_ms", new String[]{venueId})) {
            while (c.moveToNext()) out.put(resourceFromCursor(c));
        }
        return out;
    }

    private JSONArray listActiveSessionsInternal(SQLiteDatabase db, String venueId) throws JSONException {
        JSONArray out = new JSONArray();
        try (Cursor c = db.rawQuery(
                "SELECT id,resource_id,customer_name,player_count,status,started_wall_ms," +
                        "started_elapsed_ms,started_boot_marker,ended_wall_ms,duration_seconds," +
                        "duration_source,rate_per_hour_minor,billing_increment_minutes,minimum_charge_minutes," +
                        "amount_minor,payment_method " +
                        "FROM sessions WHERE venue_id=? AND status='ACTIVE' ORDER BY started_wall_ms",
                new String[]{venueId})) {
            while (c.moveToNext()) out.put(sessionFromCursor(c));
        }
        return out;
    }

    private JSONArray listRecentSessionsInternal(SQLiteDatabase db, String venueId, int limit)
            throws JSONException {
        JSONArray out = new JSONArray();
        try (Cursor c = db.rawQuery(
                "SELECT id,resource_id,customer_name,player_count,status,started_wall_ms," +
                        "started_elapsed_ms,started_boot_marker,ended_wall_ms,duration_seconds," +
                        "duration_source,rate_per_hour_minor,billing_increment_minutes,minimum_charge_minutes," +
                        "amount_minor,payment_method " +
                        "FROM sessions WHERE venue_id=? AND status='COMPLETED' " +
                        "ORDER BY ended_wall_ms DESC LIMIT " + Math.max(1, Math.min(100, limit)),
                new String[]{venueId})) {
            while (c.moveToNext()) out.put(sessionFromCursor(c));
        }
        return out;
    }

    private JSONObject requireVenue(SQLiteDatabase db) throws JSONException {
        try (Cursor c = db.rawQuery(
                "SELECT id,name,currency,operating_mode,authority_state,billing_increment_minutes,minimum_charge_minutes " +
                        "FROM venues ORDER BY created_at_ms LIMIT 1", null)) {
            if (!c.moveToFirst()) throw new IllegalStateException("Venue is not initialized");
            return venueFromCursor(c);
        }
    }

    private JSONObject getResource(SQLiteDatabase db, String resourceId) throws JSONException {
        try (Cursor c = db.rawQuery(
                "SELECT id,name,resource_type,rate_per_hour_minor,billing_increment_minutes,minimum_charge_minutes," +
                        "metered_time,has_display,has_controller,supports_overlay,supports_remote_control,max_players,status " +
                        "FROM resources WHERE id=?", new String[]{resourceId})) {
            if (!c.moveToFirst()) throw new IllegalArgumentException("Unknown resource");
            return resourceFromCursor(c);
        }
    }

    private JSONObject getSession(SQLiteDatabase db, String sessionId) throws JSONException {
        try (Cursor c = db.rawQuery(
                "SELECT id,resource_id,customer_name,player_count,status,started_wall_ms," +
                        "started_elapsed_ms,started_boot_marker,ended_wall_ms,duration_seconds," +
                        "duration_source,rate_per_hour_minor,billing_increment_minutes,minimum_charge_minutes," +
                        "amount_minor,payment_method FROM sessions WHERE id=?", new String[]{sessionId})) {
            if (!c.moveToFirst()) throw new IllegalArgumentException("Unknown session");
            return sessionFromCursor(c);
        }
    }

    private JSONObject venueFromCursor(Cursor c) throws JSONException {
        return new JSONObject().put("id", c.getString(0)).put("name", c.getString(1))
                .put("currency", c.getString(2)).put("operatingMode", c.getString(3))
                .put("authorityState", c.getString(4)).put("billingIncrementMinutes", c.getInt(5))
                .put("minimumChargeMinutes", c.getInt(6));
    }

    private JSONObject resourceFromCursor(Cursor c) throws JSONException {
        return new JSONObject().put("id", c.getString(0)).put("name", c.getString(1))
                .put("resourceType", c.getString(2)).put("ratePerHourMinor", c.getLong(3))
                .put("billingIncrementMinutes", c.getInt(4)).put("minimumChargeMinutes", c.getInt(5))
                .put("meteredTime", c.getInt(6) == 1).put("hasDisplay", c.getInt(7) == 1)
                .put("hasController", c.getInt(8) == 1).put("supportsOverlay", c.getInt(9) == 1)
                .put("supportsRemoteControl", c.getInt(10) == 1).put("maxPlayers", c.getInt(11))
                .put("status", c.getString(12));
    }

    private JSONObject sessionFromCursor(Cursor c) throws JSONException {
        JSONObject out = new JSONObject().put("id", c.getString(0)).put("resourceId", c.getString(1))
                .put("customerName", c.isNull(2) ? JSONObject.NULL : c.getString(2))
                .put("playerCount", c.getInt(3)).put("status", c.getString(4))
                .put("startedWallMs", c.getLong(5)).put("startedElapsedMs", c.getLong(6))
                .put("startedBootMarker", c.getString(7)).put("ratePerHourMinor", c.getLong(11))
                .put("billingIncrementMinutes", c.getInt(12)).put("minimumChargeMinutes", c.getInt(13));
        out.put("endedWallMs", c.isNull(8) ? JSONObject.NULL : c.getLong(8));
        out.put("durationSeconds", c.isNull(9) ? JSONObject.NULL : c.getLong(9));
        out.put("durationSource", c.isNull(10) ? JSONObject.NULL : c.getString(10));
        out.put("amountMinor", c.isNull(14) ? JSONObject.NULL : c.getLong(14));
        out.put("paymentMethod", c.isNull(15) ? JSONObject.NULL : c.getString(15));
        return out;
    }

    private void appendEvent(SQLiteDatabase db, String venueId, String eventType,
                             String entityType, String entityId, JSONObject payload) {
        long now = System.currentTimeMillis();
        String eventId = id("event");
        ContentValues event = new ContentValues();
        event.put("id", eventId);
        event.put("venue_id", venueId);
        event.put("device_id", deviceId);
        event.put("event_type", eventType);
        event.put("entity_type", entityType);
        event.put("entity_id", entityId);
        event.put("payload_json", payload.toString());
        event.put("created_at_ms", now);
        db.insertOrThrow("domain_events", null, event);

        ContentValues outbox = new ContentValues();
        outbox.put("id", id("outbox"));
        outbox.put("event_id", eventId);
        outbox.put("status", "PENDING");
        outbox.put("attempts", 0);
        outbox.put("created_at_ms", now);
        db.insertOrThrow("outbox_events", null, outbox);
    }

    private static long scalarLong(SQLiteDatabase db, String sql, String[] args) {
        try (Cursor c = db.rawQuery(sql, args)) {
            c.moveToFirst();
            return c.getLong(0);
        }
    }

    private static long startOfLocalDayMs() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    private static int clampIncrement(int value) {
        return Math.max(1, Math.min(60, value));
    }

    private static int clampMinimum(int value) {
        return Math.max(1, Math.min(240, value));
    }

    private static String sanitizeName(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        if (clean.isEmpty()) clean = fallback;
        return clean.length() > 80 ? clean.substring(0, 80) : clean;
    }

    private static String sanitizeOptional(String value) {
        if (value == null) return null;
        String clean = value.trim();
        if (clean.isEmpty()) return null;
        return clean.length() > 80 ? clean.substring(0, 80) : clean;
    }

    private static String sanitizeCurrency(String value) {
        String clean = value == null ? "MAD" : value.trim().toUpperCase();
        return clean.matches("[A-Z]{3}") ? clean : "MAD";
    }

    private static String sanitizePaymentMethod(String value) {
        if ("CARD".equalsIgnoreCase(value)) return "CARD";
        if ("OTHER".equalsIgnoreCase(value)) return "OTHER";
        return "CASH";
    }
}
