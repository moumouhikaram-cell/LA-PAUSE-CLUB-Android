package com.lapauseclub.manager.a1.data;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public final class AppDatabase extends SQLiteOpenHelper {
    public static final String DB_NAME = "la_pause_a1.db";
    private static final int DB_VERSION = 2;

    public AppDatabase(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        setWriteAheadLoggingEnabled(true);
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        db.setForeignKeyConstraintsEnabled(true);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)");

        db.execSQL("CREATE TABLE venues (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "name TEXT NOT NULL," +
                "currency TEXT NOT NULL," +
                "operating_mode TEXT NOT NULL," +
                "authority_state TEXT NOT NULL," +
                "billing_increment_minutes INTEGER NOT NULL DEFAULT 1," +
                "minimum_charge_minutes INTEGER NOT NULL DEFAULT 1," +
                "created_at_ms INTEGER NOT NULL," +
                "updated_at_ms INTEGER NOT NULL)");

        db.execSQL("CREATE TABLE resources (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "resource_type TEXT NOT NULL," +
                "rate_per_hour_minor INTEGER NOT NULL," +
                "billing_increment_minutes INTEGER NOT NULL DEFAULT 0," +
                "minimum_charge_minutes INTEGER NOT NULL DEFAULT 0," +
                "metered_time INTEGER NOT NULL," +
                "has_display INTEGER NOT NULL," +
                "has_controller INTEGER NOT NULL," +
                "supports_overlay INTEGER NOT NULL," +
                "supports_remote_control INTEGER NOT NULL," +
                "max_players INTEGER NOT NULL," +
                "status TEXT NOT NULL DEFAULT 'AVAILABLE'," +
                "created_at_ms INTEGER NOT NULL," +
                "updated_at_ms INTEGER NOT NULL," +
                "FOREIGN KEY(venue_id) REFERENCES venues(id))");

        db.execSQL("CREATE TABLE sessions (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "resource_id TEXT NOT NULL," +
                "customer_name TEXT," +
                "player_count INTEGER NOT NULL," +
                "status TEXT NOT NULL," +
                "started_wall_ms INTEGER NOT NULL," +
                "started_elapsed_ms INTEGER NOT NULL," +
                "started_boot_marker TEXT NOT NULL," +
                "ended_wall_ms INTEGER," +
                "duration_seconds INTEGER," +
                "duration_source TEXT," +
                "rate_per_hour_minor INTEGER NOT NULL," +
                "billing_increment_minutes INTEGER NOT NULL DEFAULT 0," +
                "minimum_charge_minutes INTEGER NOT NULL DEFAULT 0," +
                "amount_minor INTEGER," +
                "payment_method TEXT," +
                "created_at_ms INTEGER NOT NULL," +
                "updated_at_ms INTEGER NOT NULL," +
                "FOREIGN KEY(venue_id) REFERENCES venues(id)," +
                "FOREIGN KEY(resource_id) REFERENCES resources(id))");

        db.execSQL("CREATE UNIQUE INDEX idx_one_active_session_per_resource " +
                "ON sessions(resource_id) WHERE status = 'ACTIVE'");

        db.execSQL("CREATE TABLE payments (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "session_id TEXT," +
                "amount_minor INTEGER NOT NULL," +
                "method TEXT NOT NULL," +
                "status TEXT NOT NULL," +
                "created_at_ms INTEGER NOT NULL," +
                "FOREIGN KEY(venue_id) REFERENCES venues(id)," +
                "FOREIGN KEY(session_id) REFERENCES sessions(id))");

        db.execSQL("CREATE TABLE domain_events (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT," +
                "device_id TEXT NOT NULL," +
                "event_type TEXT NOT NULL," +
                "entity_type TEXT," +
                "entity_id TEXT," +
                "payload_json TEXT NOT NULL," +
                "created_at_ms INTEGER NOT NULL)");

        db.execSQL("CREATE TABLE outbox_events (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "event_id TEXT NOT NULL UNIQUE," +
                "status TEXT NOT NULL DEFAULT 'PENDING'," +
                "attempts INTEGER NOT NULL DEFAULT 0," +
                "next_attempt_at_ms INTEGER," +
                "last_error TEXT," +
                "created_at_ms INTEGER NOT NULL," +
                "FOREIGN KEY(event_id) REFERENCES domain_events(id))");

        db.execSQL("CREATE TABLE authority_leases (" +
                "id TEXT PRIMARY KEY NOT NULL," +
                "venue_id TEXT NOT NULL," +
                "authority_state TEXT NOT NULL," +
                "holder_device_id TEXT NOT NULL," +
                "lease_version INTEGER NOT NULL," +
                "issued_at_ms INTEGER NOT NULL," +
                "expires_at_ms INTEGER," +
                "revoked_at_ms INTEGER," +
                "FOREIGN KEY(venue_id) REFERENCES venues(id))");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion == 1 && newVersion >= 2) {
            // SQLiteOpenHelper already wraps schema upgrades in a transaction.
            // Do not start a nested transaction here.
            db.execSQL("ALTER TABLE resources ADD COLUMN billing_increment_minutes INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE resources ADD COLUMN minimum_charge_minutes INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE sessions ADD COLUMN billing_increment_minutes INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE sessions ADD COLUMN minimum_charge_minutes INTEGER NOT NULL DEFAULT 0");
            oldVersion = 2;
        }
        if (oldVersion != newVersion) {
            throw new IllegalStateException(
                    "No destructive migration allowed. Missing explicit migration from " +
                            oldVersion + " to " + newVersion
            );
        }
    }
}
