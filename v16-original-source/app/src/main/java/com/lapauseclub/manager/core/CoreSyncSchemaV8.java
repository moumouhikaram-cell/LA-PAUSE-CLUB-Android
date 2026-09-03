package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;

final class CoreSyncSchemaV8 {
    static final int SCHEMA_VERSION = 8;
    private CoreSyncSchemaV8() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS command_outbox_v8 (command_id TEXT PRIMARY KEY NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,command_type TEXT NOT NULL,entity_type TEXT,entity_id TEXT,tenant_id TEXT,venue_id TEXT,branch_id TEXT,device_id TEXT,actor_id TEXT,base_revision INTEGER,issued_at_ms INTEGER NOT NULL,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,next_attempt_at_ms INTEGER,created_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_command_outbox_v8_status ON command_outbox_v8(status,issued_at_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS sync_inbox_v8 (message_id TEXT PRIMARY KEY NOT NULL,message_type TEXT NOT NULL,entity_type TEXT,entity_id TEXT,revision INTEGER,cursor_value TEXT,payload_json TEXT,received_at_ms INTEGER NOT NULL,applied_at_ms INTEGER,status TEXT NOT NULL DEFAULT 'RECEIVED',error TEXT)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_inbox_v8_status ON sync_inbox_v8(status,received_at_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS tombstones_v8 (entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,revision INTEGER NOT NULL,deleted_at_ms INTEGER NOT NULL,device_id TEXT,reason TEXT,synced INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(entity_type,entity_id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_tombstones_v8_synced ON tombstones_v8(synced,deleted_at_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS sync_checkpoints_v8 (checkpoint_id TEXT PRIMARY KEY NOT NULL,cursor_value TEXT,client_revision INTEGER NOT NULL DEFAULT 0,server_time_ms INTEGER,last_sync_at_ms INTEGER NOT NULL,accepted_commands INTEGER NOT NULL DEFAULT 0,rejected_commands INTEGER NOT NULL DEFAULT 0,accepted_events INTEGER NOT NULL DEFAULT 0,rejected_events INTEGER NOT NULL DEFAULT 0,change_count INTEGER NOT NULL DEFAULT 0,conflict_count INTEGER NOT NULL DEFAULT 0,authority_state TEXT,protocol_version TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_v8_time ON sync_checkpoints_v8(last_sync_at_ms DESC)");

        db.execSQL("CREATE TABLE IF NOT EXISTS consent_evidence_v8 (consent_id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,scope TEXT NOT NULL,text_version TEXT,granted INTEGER NOT NULL,actor_id TEXT,device_id TEXT,local_timestamp_ms INTEGER NOT NULL,server_timestamp_ms INTEGER,evidence_hash TEXT,evidence_hmac TEXT,revokes_consent_id TEXT,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_consent_evidence_v8_customer ON consent_evidence_v8(customer_id,scope,local_timestamp_ms DESC)");
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long now) {
        upsertCommands(db, root.optJSONArray("commandOutbox"), now);
        upsertInbox(db, root.optJSONArray("syncInbox"), now);
        upsertTombstones(db, root.optJSONArray("tombstones"));
        upsertConsentEvidence(db, root.optJSONArray("consentEvidence"), now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject out = new JSONObject();
        try {
            out.put("pendingCommandCount", scalar(db,"SELECT COUNT(*) FROM command_outbox_v8 WHERE status='PENDING'"));
            out.put("unappliedInboxCount", scalar(db,"SELECT COUNT(*) FROM sync_inbox_v8 WHERE status IN ('RECEIVED','ERROR')"));
            out.put("unsyncedTombstoneCount", scalar(db,"SELECT COUNT(*) FROM tombstones_v8 WHERE synced=0"));
            out.put("consentEvidenceCount", scalar(db,"SELECT COUNT(*) FROM consent_evidence_v8"));
            out.put("syncCheckpointCount", scalar(db,"SELECT COUNT(*) FROM sync_checkpoints_v8"));
        } catch (Exception ignored) {}
        return out;
    }

    private static void upsertCommands(SQLiteDatabase db, JSONArray a, long now){
        if(a==null)return;
        for(int i=0;i<a.length();i++){
            JSONObject c=a.optJSONObject(i); if(c==null)continue;
            String id=c.optString("commandId",c.optString("id","")).trim(); if(id.isEmpty())continue;
            String idem=c.optString("idempotencyKey",id).trim(); if(idem.isEmpty())idem=id;
            ContentValues v=new ContentValues();
            v.put("command_id",id);v.put("idempotency_key",idem);v.put("command_type",c.optString("commandType","UNKNOWN"));
            putNullable(v,"entity_type",c.optString("entityType",""));putNullable(v,"entity_id",c.optString("entityId",""));
            putNullable(v,"tenant_id",c.optString("tenantId",""));putNullable(v,"venue_id",c.optString("venueId",""));putNullable(v,"branch_id",c.optString("branchId",""));putNullable(v,"device_id",c.optString("deviceId",""));putNullable(v,"actor_id",c.optString("actorId",""));
            if(c.has("baseRevision")&&!c.isNull("baseRevision"))v.put("base_revision",c.optLong("baseRevision"));else v.putNull("base_revision");
            v.put("issued_at_ms",c.optLong("issuedAt",now));Object p=c.opt("payload");v.put("payload_json",p==null||p==JSONObject.NULL?"{}":String.valueOf(p));
            v.put("status",c.optString("status","PENDING"));v.put("attempts",c.optInt("attempts",0));putNullable(v,"last_error",c.optString("lastError",""));
            if(c.has("nextAttemptAt")&&!c.isNull("nextAttemptAt"))v.put("next_attempt_at_ms",c.optLong("nextAttemptAt"));else v.putNull("next_attempt_at_ms");
            v.put("created_at_ms",c.optLong("createdAt",c.optLong("issuedAt",now)));
            db.insertWithOnConflict("command_outbox_v8",null,v,SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private static void upsertInbox(SQLiteDatabase db, JSONArray a, long now){
        if(a==null)return;
        for(int i=0;i<a.length();i++){
            JSONObject m=a.optJSONObject(i); if(m==null)continue;String id=m.optString("messageId",m.optString("id","")).trim();if(id.isEmpty())continue;
            ContentValues v=new ContentValues();v.put("message_id",id);v.put("message_type",m.optString("messageType","CHANGE"));putNullable(v,"entity_type",m.optString("entityType",""));putNullable(v,"entity_id",m.optString("entityId",""));
            if(m.has("revision")&&!m.isNull("revision"))v.put("revision",m.optLong("revision"));else v.putNull("revision");putNullable(v,"cursor_value",m.optString("cursor",""));Object p=m.opt("payload");v.put("payload_json",p==null||p==JSONObject.NULL?"{}":String.valueOf(p));v.put("received_at_ms",m.optLong("receivedAt",now));if(m.has("appliedAt")&&!m.isNull("appliedAt"))v.put("applied_at_ms",m.optLong("appliedAt"));else v.putNull("applied_at_ms");v.put("status",m.optString("status","RECEIVED"));putNullable(v,"error",m.optString("error",""));db.insertWithOnConflict("sync_inbox_v8",null,v,SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private static void upsertTombstones(SQLiteDatabase db, JSONArray a){
        if(a==null)return;for(int i=0;i<a.length();i++){JSONObject t=a.optJSONObject(i);if(t==null)continue;String type=t.optString("entityType","").trim(),id=t.optString("entityId","").trim();if(type.isEmpty()||id.isEmpty())continue;ContentValues v=new ContentValues();v.put("entity_type",type);v.put("entity_id",id);v.put("revision",Math.max(1,t.optLong("revision",1)));v.put("deleted_at_ms",t.optLong("deletedAt",System.currentTimeMillis()));putNullable(v,"device_id",t.optString("deviceId",""));putNullable(v,"reason",t.optString("reason",""));v.put("synced",t.optBoolean("synced",false)?1:0);db.insertWithOnConflict("tombstones_v8",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }

    private static void upsertConsentEvidence(SQLiteDatabase db, JSONArray a,long now){
        if(a==null)return;for(int i=0;i<a.length();i++){JSONObject c=a.optJSONObject(i);if(c==null)continue;String id=c.optString("consentId",c.optString("id","")).trim(),customer=c.optString("customerId","").trim();if(id.isEmpty()||customer.isEmpty())continue;ContentValues v=new ContentValues();v.put("consent_id",id);v.put("customer_id",customer);v.put("scope",c.optString("scope",c.optString("type","UNKNOWN")));putNullable(v,"text_version",c.optString("textVersion",""));v.put("granted",c.optBoolean("granted",false)?1:0);putNullable(v,"actor_id",c.optString("actorId",""));putNullable(v,"device_id",c.optString("deviceId",""));v.put("local_timestamp_ms",c.optLong("localTimestamp",c.optLong("at",now)));if(c.has("serverTimestamp")&&!c.isNull("serverTimestamp"))v.put("server_timestamp_ms",c.optLong("serverTimestamp"));else v.putNull("server_timestamp_ms");putNullable(v,"evidence_hash",c.optString("evidenceHash",""));putNullable(v,"evidence_hmac",c.optString("evidenceHmac",""));putNullable(v,"revokes_consent_id",c.optString("revokesConsentId",""));v.put("raw_json",c.toString());db.insertWithOnConflict("consent_evidence_v8",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }

    private static void putNullable(ContentValues v,String k,String x){if(x==null||x.trim().isEmpty())v.putNull(k);else v.put(k,x.trim());}
    private static long scalar(SQLiteDatabase db,String q){try(Cursor c=db.rawQuery(q,null)){return c.moveToFirst()?c.getLong(0):0;}}
}
