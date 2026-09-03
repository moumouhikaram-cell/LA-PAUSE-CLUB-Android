package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

final class CoreCommandSchemaV9 {
    private CoreCommandSchemaV9() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS command_log_v9 (command_id TEXT PRIMARY KEY NOT NULL,type TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,expected_revision INTEGER,entity_type TEXT,entity_id TEXT,actor_id TEXT NOT NULL,branch_id TEXT NOT NULL,origin_device_id TEXT NOT NULL,correlation_id TEXT,payload_json TEXT NOT NULL,fingerprint_sha256 TEXT NOT NULL,status TEXT NOT NULL,result_json TEXT,error_code TEXT,error_message TEXT,created_at_ms INTEGER NOT NULL,applied_at_ms INTEGER)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_command_log_v9_status ON command_log_v9(status,created_at_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_command_log_v9_entity ON command_log_v9(entity_type,entity_id,created_at_ms)");
        db.execSQL("CREATE TABLE IF NOT EXISTS entity_revisions_v9 (entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL,PRIMARY KEY(entity_type,entity_id))");
        db.execSQL("CREATE TABLE IF NOT EXISTS audit_events_v9 (id TEXT PRIMARY KEY NOT NULL,venue_id TEXT,branch_id TEXT NOT NULL,actor_id TEXT NOT NULL,device_id TEXT NOT NULL,entity_type TEXT,entity_id TEXT,action TEXT NOT NULL,diff_json TEXT,timestamp_ms INTEGER NOT NULL,previous_hash TEXT,hash TEXT NOT NULL,correlation_id TEXT,command_id TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_audit_v9_entity ON audit_events_v9(entity_type,entity_id,timestamp_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_audit_v9_time ON audit_events_v9(timestamp_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS domain_events_v9 (event_id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL,tenant_id TEXT,venue_id TEXT,branch_id TEXT NOT NULL,station_id TEXT,device_id TEXT,entity_type TEXT,entity_id TEXT,actor_id TEXT,server_timestamp_ms INTEGER NOT NULL,payload_json TEXT NOT NULL,correlation_id TEXT,causation_id TEXT,idempotency_key TEXT NOT NULL UNIQUE,severity TEXT NOT NULL DEFAULT 'INFO',schema_version INTEGER NOT NULL DEFAULT 1)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_domain_events_v9_type_time ON domain_events_v9(event_type,server_timestamp_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_domain_events_v9_entity ON domain_events_v9(entity_type,entity_id,server_timestamp_ms)");
        db.execSQL("CREATE TABLE IF NOT EXISTS outbox_events_v9 (event_id TEXT PRIMARY KEY NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at_ms INTEGER,last_error TEXT,dedupe_key TEXT NOT NULL UNIQUE,dead_letter INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER NOT NULL,FOREIGN KEY(event_id) REFERENCES domain_events_v9(event_id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_outbox_events_v9_pending ON outbox_events_v9(status,next_attempt_at_ms,created_at_ms)");
        ensureColumns(db);
        backfillRevisions(db);
    }

    private static void ensureColumns(SQLiteDatabase db) {
        addColumnIfMissing(db,"sessions_p1","requested_at_ms","INTEGER");
        addColumnIfMissing(db,"sessions_p1","paid_at_ms","INTEGER");
        addColumnIfMissing(db,"sessions_p1","request_expires_at_ms","INTEGER");
        addColumnIfMissing(db,"sessions_p1","venue_id","TEXT");
        addColumnIfMissing(db,"sessions_p1","branch_id","TEXT");
        addColumnIfMissing(db,"sessions_p1","actor_id","TEXT");
        addColumnIfMissing(db,"sessions_p1","origin_device_id","TEXT");
        addColumnIfMissing(db,"sessions_p1","correlation_id","TEXT");
        addColumnIfMissing(db,"sessions_p1","idempotency_key","TEXT");
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_p1_idempotency ON sessions_p1(idempotency_key) WHERE idempotency_key IS NOT NULL");
        addColumnIfMissing(db,"payments_p1","revision","INTEGER NOT NULL DEFAULT 1");
        addColumnIfMissing(db,"payments_p1","status","TEXT NOT NULL DEFAULT 'CAPTURED'");
        addColumnIfMissing(db,"payments_p1","refund_of_payment_id","TEXT");
        addColumnIfMissing(db,"payments_p1","actor_id","TEXT");
        addColumnIfMissing(db,"payments_p1","origin_device_id","TEXT");
        addColumnIfMissing(db,"payments_p1","correlation_id","TEXT");
        addColumnIfMissing(db,"payments_p1","idempotency_key","TEXT");
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_p1_idempotency ON payments_p1(idempotency_key) WHERE idempotency_key IS NOT NULL");
        addColumnIfMissing(db,"shifts_p1","revision","INTEGER NOT NULL DEFAULT 1");
        addColumnIfMissing(db,"shifts_p1","variance_reason","TEXT");
        addColumnIfMissing(db,"shifts_p1","opened_by","TEXT");
        addColumnIfMissing(db,"shifts_p1","closed_by","TEXT");
        addColumnIfMissing(db,"queue_entries_p1","revision","INTEGER NOT NULL DEFAULT 1");
        addColumnIfMissing(db,"queue_entries_p1","updated_at_ms","INTEGER");
    }

    static long entityRevision(SQLiteDatabase db,String type,String id){
        if(type==null||id==null||type.isEmpty()||id.isEmpty()) return 0L;
        try(Cursor c=db.rawQuery("SELECT revision FROM entity_revisions_v9 WHERE entity_type=? AND entity_id=?",new String[]{type,id})){return c.moveToFirst()?c.getLong(0):0L;}
    }

    static void setEntityRevision(SQLiteDatabase db,String type,String id,long revision,long now){
        if(type==null||id==null||type.isEmpty()||id.isEmpty()) return;
        ContentValues v=new ContentValues();v.put("entity_type",type);v.put("entity_id",id);v.put("revision",Math.max(0,revision));v.put("updated_at_ms",now);db.insertWithOnConflict("entity_revisions_v9",null,v,SQLiteDatabase.CONFLICT_REPLACE);
    }

    static String commandResult(SQLiteDatabase db,String idempotencyKey,String fingerprint){
        try(Cursor c=db.rawQuery("SELECT fingerprint_sha256,status,result_json,error_code,error_message FROM command_log_v9 WHERE idempotency_key=? LIMIT 1",new String[]{idempotencyKey})){
            if(!c.moveToFirst()) return null;
            if(!fingerprint.equals(c.getString(0))) return "{\"ok\":false,\"code\":\"IDEMPOTENCY_CONFLICT\",\"message\":\"Same idempotencyKey with different command\"}";
            String status=c.getString(1),result=c.isNull(2)?null:c.getString(2);
            if("APPLIED".equals(status)&&result!=null)return result;
            String code=c.isNull(3)?"COMMAND_REJECTED":c.getString(3),msg=c.isNull(4)?"Command rejected":c.getString(4);
            return "{\"ok\":false,\"code\":\""+escape(code)+"\",\"message\":\""+escape(msg)+"\"}";
        }
    }

    static void insertPendingCommand(SQLiteDatabase db,String commandId,String type,String idempotencyKey,Long expectedRevision,String entityType,String entityId,String actorId,String branchId,String deviceId,String correlationId,String payloadJson,String fingerprint,long now){
        ContentValues v=new ContentValues();v.put("command_id",commandId);v.put("type",type);v.put("idempotency_key",idempotencyKey);if(expectedRevision==null)v.putNull("expected_revision");else v.put("expected_revision",expectedRevision);put(v,"entity_type",entityType);put(v,"entity_id",entityId);v.put("actor_id",actorId);v.put("branch_id",branchId);v.put("origin_device_id",deviceId);put(v,"correlation_id",correlationId);v.put("payload_json",payloadJson);v.put("fingerprint_sha256",fingerprint);v.put("status","PENDING");v.put("created_at_ms",now);db.insertOrThrow("command_log_v9",null,v);
    }

    static void markApplied(SQLiteDatabase db,String commandId,String result,long now){ContentValues v=new ContentValues();v.put("status","APPLIED");v.put("result_json",result);v.put("applied_at_ms",now);db.update("command_log_v9",v,"command_id=?",new String[]{commandId});}
    static void markRejected(SQLiteDatabase db,String commandId,String code,String message,long now){ContentValues v=new ContentValues();v.put("status","REJECTED");v.put("error_code",code);v.put("error_message",message);v.put("applied_at_ms",now);db.update("command_log_v9",v,"command_id=?",new String[]{commandId});}

    static void appendAudit(SQLiteDatabase db,String id,String venueId,String branchId,String actorId,String deviceId,String entityType,String entityId,String action,String diff,long now,String previousHash,String hash,String correlationId,String commandId){ContentValues v=new ContentValues();v.put("id",id);put(v,"venue_id",venueId);v.put("branch_id",branchId);v.put("actor_id",actorId);v.put("device_id",deviceId);put(v,"entity_type",entityType);put(v,"entity_id",entityId);v.put("action",action);put(v,"diff_json",diff);v.put("timestamp_ms",now);put(v,"previous_hash",previousHash);v.put("hash",hash);put(v,"correlation_id",correlationId);v.put("command_id",commandId);db.insertOrThrow("audit_events_v9",null,v);}
    static String lastAuditHash(SQLiteDatabase db){try(Cursor c=db.rawQuery("SELECT hash FROM audit_events_v9 ORDER BY timestamp_ms DESC,id DESC LIMIT 1",null)){return c.moveToFirst()?c.getString(0):"GENESIS";}}

    static void appendEvent(SQLiteDatabase db,String eventId,String eventType,String tenantId,String venueId,String branchId,String stationId,String deviceId,String entityType,String entityId,String actorId,long serverTimestamp,String payloadJson,String correlationId,String causationId,String idempotencyKey,String severity,int schemaVersion){
        ContentValues v=new ContentValues();v.put("event_id",eventId);v.put("event_type",eventType);put(v,"tenant_id",tenantId);put(v,"venue_id",venueId);v.put("branch_id",branchId);put(v,"station_id",stationId);put(v,"device_id",deviceId);put(v,"entity_type",entityType);put(v,"entity_id",entityId);put(v,"actor_id",actorId);v.put("server_timestamp_ms",serverTimestamp);v.put("payload_json",payloadJson==null?"{}":payloadJson);put(v,"correlation_id",correlationId);put(v,"causation_id",causationId);v.put("idempotency_key",idempotencyKey);v.put("severity",severity==null?"INFO":severity);v.put("schema_version",Math.max(1,schemaVersion));db.insertOrThrow("domain_events_v9",null,v);
        ContentValues o=new ContentValues();o.put("event_id",eventId);o.put("status","PENDING");o.put("attempts",0);o.put("dedupe_key",idempotencyKey);o.put("dead_letter",0);o.put("created_at_ms",serverTimestamp);db.insertOrThrow("outbox_events_v9",null,o);
    }

    static String statusJson(SQLiteDatabase db){long commands=scalar(db,"SELECT COUNT(*) FROM command_log_v9"),rejected=scalar(db,"SELECT COUNT(*) FROM command_log_v9 WHERE status='REJECTED'"),revisions=scalar(db,"SELECT COUNT(*) FROM entity_revisions_v9"),audits=scalar(db,"SELECT COUNT(*) FROM audit_events_v9"),events=scalar(db,"SELECT COUNT(*) FROM domain_events_v9"),outbox=scalar(db,"SELECT COUNT(*) FROM outbox_events_v9 WHERE status='PENDING'");return "{\"commandCount\":"+commands+",\"rejectedCommandCount\":"+rejected+",\"entityRevisionCount\":"+revisions+",\"auditV9Count\":"+audits+",\"canonicalEventCount\":"+events+",\"canonicalOutboxPending\":"+outbox+"}";}

    private static void backfillRevisions(SQLiteDatabase db){backfill(db,"SESSION","sessions_p1");backfill(db,"PAYMENT","payments_p1");backfill(db,"QUEUE_ENTRY","queue_entries_p1");backfill(db,"RATE_PLAN","rate_plans");}
    private static void backfill(SQLiteDatabase db,String type,String table){try{db.execSQL("INSERT OR IGNORE INTO entity_revisions_v9(entity_type,entity_id,revision,updated_at_ms) SELECT '"+type+"',id,COALESCE(revision,1),CAST(strftime('%s','now') AS INTEGER)*1000 FROM "+table);}catch(Exception ignored){}}
    private static void addColumnIfMissing(SQLiteDatabase db,String table,String col,String ddl){if(!hasColumn(db,table,col))db.execSQL("ALTER TABLE "+table+" ADD COLUMN "+col+" "+ddl);}
    private static boolean hasColumn(SQLiteDatabase db,String table,String col){try(Cursor c=db.rawQuery("PRAGMA table_info("+table+")",null)){while(c.moveToNext())if(col.equalsIgnoreCase(c.getString(c.getColumnIndexOrThrow("name"))))return true;}return false;}
    private static void put(ContentValues v,String k,String x){if(x==null||x.isEmpty())v.putNull(k);else v.put(k,x);}
    private static long scalar(SQLiteDatabase db,String q){try(Cursor c=db.rawQuery(q,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static String escape(String s){return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"");}
}
