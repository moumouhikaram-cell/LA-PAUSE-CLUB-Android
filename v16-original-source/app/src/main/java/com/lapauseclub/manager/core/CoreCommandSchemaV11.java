package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

/** Scoped transactional command/audit/event core. Legacy V9 tables stay intact. */
final class CoreCommandSchemaV11 {
    static final int SCHEMA_VERSION = 11;
    private CoreCommandSchemaV11() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS command_log_v11 (" +
                "command_id TEXT PRIMARY KEY NOT NULL," +
                "tenant_id TEXT NOT NULL,venue_id TEXT NOT NULL,branch_id TEXT NOT NULL," +
                "type TEXT NOT NULL,idempotency_key TEXT NOT NULL,expected_revision INTEGER," +
                "entity_type TEXT,entity_id TEXT,actor_id TEXT NOT NULL,origin_device_id TEXT NOT NULL," +
                "correlation_id TEXT,payload_json TEXT NOT NULL,fingerprint_sha256 TEXT NOT NULL," +
                "status TEXT NOT NULL,result_json TEXT,error_code TEXT,error_message TEXT," +
                "created_at_ms INTEGER NOT NULL,applied_at_ms INTEGER," +
                "UNIQUE(tenant_id,venue_id,branch_id,idempotency_key))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_command_v11_scope_status ON command_log_v11(tenant_id,venue_id,branch_id,status,created_at_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_command_v11_scope_entity ON command_log_v11(tenant_id,venue_id,branch_id,entity_type,entity_id,created_at_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS entity_revisions_v11 (" +
                "tenant_id TEXT NOT NULL,venue_id TEXT NOT NULL,branch_id TEXT NOT NULL," +
                "entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL," +
                "PRIMARY KEY(tenant_id,venue_id,branch_id,entity_type,entity_id))");

        db.execSQL("CREATE TABLE IF NOT EXISTS audit_events_v11 (" +
                "id TEXT PRIMARY KEY NOT NULL,tenant_id TEXT NOT NULL,venue_id TEXT NOT NULL,branch_id TEXT NOT NULL," +
                "actor_id TEXT NOT NULL,device_id TEXT NOT NULL,entity_type TEXT,entity_id TEXT,action TEXT NOT NULL," +
                "diff_json TEXT,timestamp_ms INTEGER NOT NULL,previous_hash TEXT,hash TEXT NOT NULL,correlation_id TEXT,command_id TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_audit_v11_scope_time ON audit_events_v11(tenant_id,venue_id,branch_id,timestamp_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_audit_v11_scope_entity ON audit_events_v11(tenant_id,venue_id,branch_id,entity_type,entity_id,timestamp_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS domain_events_v11 (" +
                "event_id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL," +
                "tenant_id TEXT NOT NULL,venue_id TEXT NOT NULL,branch_id TEXT NOT NULL," +
                "station_id TEXT,device_id TEXT,entity_type TEXT,entity_id TEXT,actor_id TEXT," +
                "server_timestamp_ms INTEGER NOT NULL,payload_json TEXT NOT NULL,correlation_id TEXT,causation_id TEXT," +
                "idempotency_key TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'INFO',schema_version INTEGER NOT NULL DEFAULT 1," +
                "UNIQUE(tenant_id,venue_id,branch_id,idempotency_key))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_v11_scope_time ON domain_events_v11(tenant_id,venue_id,branch_id,server_timestamp_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_v11_scope_entity ON domain_events_v11(tenant_id,venue_id,branch_id,entity_type,entity_id,server_timestamp_ms)");

        db.execSQL("CREATE TABLE IF NOT EXISTS outbox_events_v11 (" +
                "event_id TEXT PRIMARY KEY NOT NULL,tenant_id TEXT NOT NULL,venue_id TEXT NOT NULL,branch_id TEXT NOT NULL," +
                "status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at_ms INTEGER,last_error TEXT," +
                "dedupe_key TEXT NOT NULL,dead_letter INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER NOT NULL," +
                "UNIQUE(tenant_id,venue_id,branch_id,dedupe_key)," +
                "FOREIGN KEY(event_id) REFERENCES domain_events_v11(event_id))");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_outbox_v11_scope_pending ON outbox_events_v11(tenant_id,venue_id,branch_id,status,next_attempt_at_ms,created_at_ms)");
    }

    static void migrateLegacy(SQLiteDatabase db, long now) {
        create(db);
        if (scalar(db,"SELECT COUNT(*) FROM command_log_v11") > 0 || scalar(db,"SELECT COUNT(*) FROM entity_revisions_v11") > 0) return;
        String[] s = activeScope(db);
        String tenant=s[0], venue=s[1], branch=s[2];
        try {
            db.execSQL("INSERT OR IGNORE INTO command_log_v11(command_id,tenant_id,venue_id,branch_id,type,idempotency_key,expected_revision,entity_type,entity_id,actor_id,origin_device_id,correlation_id,payload_json,fingerprint_sha256,status,result_json,error_code,error_message,created_at_ms,applied_at_ms) " +
                    "SELECT command_id,?,?,COALESCE(NULLIF(branch_id,''),?),type,idempotency_key,expected_revision,entity_type,entity_id,actor_id,origin_device_id,correlation_id,payload_json,fingerprint_sha256,status,result_json,error_code,error_message,created_at_ms,applied_at_ms FROM command_log_v9",
                    new Object[]{tenant,venue,branch});
        } catch(Exception ignored) {}
        try {
            db.execSQL("INSERT OR IGNORE INTO entity_revisions_v11(tenant_id,venue_id,branch_id,entity_type,entity_id,revision,updated_at_ms) SELECT ?,?,?,entity_type,entity_id,revision,updated_at_ms FROM entity_revisions_v9",
                    new Object[]{tenant,venue,branch});
        } catch(Exception ignored) {}
        try {
            db.execSQL("INSERT OR IGNORE INTO audit_events_v11(id,tenant_id,venue_id,branch_id,actor_id,device_id,entity_type,entity_id,action,diff_json,timestamp_ms,previous_hash,hash,correlation_id,command_id) " +
                    "SELECT id,?,COALESCE(NULLIF(venue_id,''),?),COALESCE(NULLIF(branch_id,''),?),actor_id,device_id,entity_type,entity_id,action,diff_json,timestamp_ms,previous_hash,hash,correlation_id,command_id FROM audit_events_v9",
                    new Object[]{tenant,venue,branch});
        } catch(Exception ignored) {}
        try {
            db.execSQL("INSERT OR IGNORE INTO domain_events_v11(event_id,event_type,tenant_id,venue_id,branch_id,station_id,device_id,entity_type,entity_id,actor_id,server_timestamp_ms,payload_json,correlation_id,causation_id,idempotency_key,severity,schema_version) " +
                    "SELECT event_id,event_type,COALESCE(NULLIF(tenant_id,''),?),COALESCE(NULLIF(venue_id,''),?),COALESCE(NULLIF(branch_id,''),?),station_id,device_id,entity_type,entity_id,actor_id,server_timestamp_ms,payload_json,correlation_id,causation_id,idempotency_key,severity,schema_version FROM domain_events_v9",
                    new Object[]{tenant,venue,branch});
        } catch(Exception ignored) {}
        try {
            db.execSQL("INSERT OR IGNORE INTO outbox_events_v11(event_id,tenant_id,venue_id,branch_id,status,attempts,next_attempt_at_ms,last_error,dedupe_key,dead_letter,created_at_ms) " +
                    "SELECT o.event_id,d.tenant_id,d.venue_id,d.branch_id,o.status,o.attempts,o.next_attempt_at_ms,o.last_error,o.dedupe_key,o.dead_letter,o.created_at_ms FROM outbox_events_v9 o JOIN domain_events_v11 d ON d.event_id=o.event_id");
        } catch(Exception ignored) {}
    }

    static long entityRevision(SQLiteDatabase db,String tenant,String venue,String branch,String type,String id){
        if(blank(type)||blank(id)) return 0L;
        try(Cursor c=db.rawQuery("SELECT revision FROM entity_revisions_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND entity_type=? AND entity_id=?",
                new String[]{tenant,venue,branch,type,id})){return c.moveToFirst()?c.getLong(0):0L;}
    }

    static void setEntityRevision(SQLiteDatabase db,String tenant,String venue,String branch,String type,String id,long revision,long now){
        if(blank(type)||blank(id)) return;
        ContentValues v=scope(tenant,venue,branch);v.put("entity_type",type);v.put("entity_id",id);v.put("revision",Math.max(0,revision));v.put("updated_at_ms",now);
        db.insertWithOnConflict("entity_revisions_v11",null,v,SQLiteDatabase.CONFLICT_REPLACE);
    }

    static String commandResult(SQLiteDatabase db,String tenant,String venue,String branch,String idempotencyKey,String fingerprint){
        try(Cursor c=db.rawQuery("SELECT fingerprint_sha256,status,result_json,error_code,error_message FROM command_log_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND idempotency_key=? LIMIT 1",
                new String[]{tenant,venue,branch,idempotencyKey})){
            if(!c.moveToFirst()) return null;
            if(!fingerprint.equals(c.getString(0))) return "{\"ok\":false,\"code\":\"IDEMPOTENCY_CONFLICT\",\"message\":\"Same scoped idempotencyKey with different command\"}";
            String status=c.getString(1),result=c.isNull(2)?null:c.getString(2);
            if("APPLIED".equals(status)&&result!=null)return result;
            String code=c.isNull(3)?"COMMAND_REJECTED":c.getString(3),msg=c.isNull(4)?"Command rejected":c.getString(4);
            return "{\"ok\":false,\"code\":\""+escape(code)+"\",\"message\":\""+escape(msg)+"\"}";
        }
    }

    static void insertPendingCommand(SQLiteDatabase db,String commandId,String tenant,String venue,String branch,String type,String idempotencyKey,Long expectedRevision,String entityType,String entityId,String actorId,String deviceId,String correlationId,String payloadJson,String fingerprint,long now){
        ContentValues v=scope(tenant,venue,branch);v.put("command_id",commandId);v.put("type",type);v.put("idempotency_key",idempotencyKey);if(expectedRevision==null)v.putNull("expected_revision");else v.put("expected_revision",expectedRevision);put(v,"entity_type",entityType);put(v,"entity_id",entityId);v.put("actor_id",actorId);v.put("origin_device_id",deviceId);put(v,"correlation_id",correlationId);v.put("payload_json",payloadJson);v.put("fingerprint_sha256",fingerprint);v.put("status","PENDING");v.put("created_at_ms",now);db.insertOrThrow("command_log_v11",null,v);
    }

    static void markApplied(SQLiteDatabase db,String commandId,String result,long now){ContentValues v=new ContentValues();v.put("status","APPLIED");v.put("result_json",result);v.put("applied_at_ms",now);db.update("command_log_v11",v,"command_id=?",new String[]{commandId});}
    static void markRejected(SQLiteDatabase db,String commandId,String code,String message,long now){ContentValues v=new ContentValues();v.put("status","REJECTED");v.put("error_code",code);v.put("error_message",message);v.put("applied_at_ms",now);db.update("command_log_v11",v,"command_id=?",new String[]{commandId});}

    static void appendAudit(SQLiteDatabase db,String id,String tenant,String venue,String branch,String actorId,String deviceId,String entityType,String entityId,String action,String diff,long now,String previousHash,String hash,String correlationId,String commandId){ContentValues v=scope(tenant,venue,branch);v.put("id",id);v.put("actor_id",actorId);v.put("device_id",deviceId);put(v,"entity_type",entityType);put(v,"entity_id",entityId);v.put("action",action);put(v,"diff_json",diff);v.put("timestamp_ms",now);put(v,"previous_hash",previousHash);v.put("hash",hash);put(v,"correlation_id",correlationId);v.put("command_id",commandId);db.insertOrThrow("audit_events_v11",null,v);}
    static String lastAuditHash(SQLiteDatabase db,String tenant,String venue,String branch){try(Cursor c=db.rawQuery("SELECT hash FROM audit_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=? ORDER BY timestamp_ms DESC,id DESC LIMIT 1",new String[]{tenant,venue,branch})){return c.moveToFirst()?c.getString(0):"GENESIS";}}

    static void appendEvent(SQLiteDatabase db,String eventId,String eventType,String tenant,String venue,String branch,String stationId,String deviceId,String entityType,String entityId,String actorId,long serverTimestamp,String payloadJson,String correlationId,String causationId,String idempotencyKey,String severity,int schemaVersion){
        ContentValues v=scope(tenant,venue,branch);v.put("event_id",eventId);v.put("event_type",eventType);put(v,"station_id",stationId);put(v,"device_id",deviceId);put(v,"entity_type",entityType);put(v,"entity_id",entityId);put(v,"actor_id",actorId);v.put("server_timestamp_ms",serverTimestamp);v.put("payload_json",payloadJson==null?"{}":payloadJson);put(v,"correlation_id",correlationId);put(v,"causation_id",causationId);v.put("idempotency_key",idempotencyKey);v.put("severity",severity==null?"INFO":severity);v.put("schema_version",Math.max(1,schemaVersion));db.insertOrThrow("domain_events_v11",null,v);
        ContentValues o=scope(tenant,venue,branch);o.put("event_id",eventId);o.put("status","PENDING");o.put("attempts",0);o.put("dedupe_key",idempotencyKey);o.put("dead_letter",0);o.put("created_at_ms",serverTimestamp);db.insertOrThrow("outbox_events_v11",null,o);
    }

    static String statusJson(SQLiteDatabase db,String tenant,String venue,String branch){
        String[] a={tenant,venue,branch};
        long commands=scalar(db,"SELECT COUNT(*) FROM command_log_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?",a),
                rejected=scalar(db,"SELECT COUNT(*) FROM command_log_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND status='REJECTED'",a),
                revisions=scalar(db,"SELECT COUNT(*) FROM entity_revisions_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?",a),
                audits=scalar(db,"SELECT COUNT(*) FROM audit_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?",a),
                events=scalar(db,"SELECT COUNT(*) FROM domain_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?",a),
                outbox=scalar(db,"SELECT COUNT(*) FROM outbox_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND status='PENDING'",a);
        return "{\"schemaVersion\":11,\"scope\":{\"tenantId\":\""+escape(tenant)+"\",\"venueId\":\""+escape(venue)+"\",\"branchId\":\""+escape(branch)+"\"},\"commandCount\":"+commands+",\"rejectedCommandCount\":"+rejected+",\"entityRevisionCount\":"+revisions+",\"auditCount\":"+audits+",\"canonicalEventCount\":"+events+",\"canonicalOutboxPending\":"+outbox+"}";
    }

    private static String[] activeScope(SQLiteDatabase db){
        try(Cursor c=db.rawQuery("SELECT tenant_id,venue_id,branch_id FROM workspace_scope_v10 WHERE is_active=1 ORDER BY activated_at_ms DESC LIMIT 1",null)){if(c.moveToFirst())return new String[]{nz(c.getString(0),"local"),nz(c.getString(1),"local"),nz(c.getString(2),"local")};}catch(Exception ignored){}
        return new String[]{"local","local","local"};
    }
    private static ContentValues scope(String tenant,String venue,String branch){ContentValues v=new ContentValues();v.put("tenant_id",tenant);v.put("venue_id",venue);v.put("branch_id",branch);return v;}
    private static void put(ContentValues v,String k,String x){if(blank(x))v.putNull(k);else v.put(k,x);}
    private static boolean blank(String x){return x==null||x.trim().isEmpty();}
    private static String nz(String x,String f){return blank(x)?f:x.trim();}
    private static long scalar(SQLiteDatabase db,String q){try(Cursor c=db.rawQuery(q,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static long scalar(SQLiteDatabase db,String q,String[] a){try(Cursor c=db.rawQuery(q,a)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static String escape(String s){return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"");}
}
