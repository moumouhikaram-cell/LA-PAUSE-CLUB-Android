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
    public static final String DB_NAME="la_pause_core_v16.db";
    private static final int DB_VERSION=9;
    private static final int MAX_SNAPSHOTS=20;

    public CoreStore(Context c){super(c,DB_NAME,null,DB_VERSION);setWriteAheadLoggingEnabled(true);}
    @Override public void onConfigure(SQLiteDatabase db){super.onConfigure(db);db.setForeignKeyConstraintsEnabled(true);}

    @Override public void onCreate(SQLiteDatabase db){
        createBase(db);
        createAllSchemas(db);
        putMeta(db,"migration_mode","DOMAIN_DUAL_WRITE");
        putMeta(db,"operating_mode","STANDALONE");
        putMeta(db,"authority_state","TABLET_PRIMARY");
        putMeta(db,"core_schema_version",String.valueOf(DB_VERSION));
        putMeta(db,"master_contract_version","2026-09-02-v2-audited");
    }

    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){
        if(newVersion!=DB_VERSION||oldVersion<1||oldVersion>DB_VERSION)throw new IllegalStateException("Unsupported non-destructive CoreStore migration: "+oldVersion+" -> "+newVersion);
        db.beginTransaction();
        try{
            if(oldVersion<2){CoreDomainSchemaV2.create(db);CoreDomainSchemaV2.migrateShadowResources(db,System.currentTimeMillis());}
            if(oldVersion<3){CoreOperationalSchemaP1.create(db);CoreBusinessSchemaP1.create(db);}
            if(oldVersion<4)CoreDeviceSchemaP2.create(db);
            if(oldVersion<5)CoreOwnerSchemaP3.create(db);
            if(oldVersion<6)CorePlayerSchemaP4.create(db);
            if(oldVersion<7)CoreSaasSchemaP5.create(db);
            if(oldVersion<8)CoreSyncSchemaV8.create(db);
            if(oldVersion<9)CoreCommandSchemaV9.create(db);
            putMeta(db,"core_schema_version",String.valueOf(DB_VERSION));
            putMeta(db,"master_contract_version","2026-09-02-v2-audited");
            putMeta(db,"migration_mode","DOMAIN_DUAL_WRITE");
            db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }

    private static void createBase(SQLiteDatabase db){
        db.execSQL("CREATE TABLE IF NOT EXISTS core_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS state_snapshots (id TEXT PRIMARY KEY NOT NULL,checksum_sha256 TEXT NOT NULL,state_json TEXT NOT NULL,source TEXT NOT NULL,legacy_schema_version INTEGER,data_revision INTEGER,created_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_state_snapshots_created ON state_snapshots(created_at_ms DESC)");
        db.execSQL("CREATE TABLE IF NOT EXISTS resources_shadow (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,resource_type TEXT NOT NULL,legacy_station_type TEXT,enabled INTEGER NOT NULL,sort_order INTEGER NOT NULL,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS domain_events (event_id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL,entity_id TEXT,payload_json TEXT,event_at_ms INTEGER,legacy_revision INTEGER,imported_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS sync_outbox (event_id TEXT PRIMARY KEY NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,next_attempt_at_ms INTEGER,created_at_ms INTEGER NOT NULL,FOREIGN KEY(event_id) REFERENCES domain_events(event_id))");
    }

    private static void createAllSchemas(SQLiteDatabase db){
        CoreDomainSchemaV2.create(db);CoreOperationalSchemaP1.create(db);CoreBusinessSchemaP1.create(db);CoreDeviceSchemaP2.create(db);CoreOwnerSchemaP3.create(db);CorePlayerSchemaP4.create(db);CoreSaasSchemaP5.create(db);CoreSyncSchemaV8.create(db);CoreCommandSchemaV9.create(db);
    }

    public synchronized void bootstrapFromLegacy(String json){if(json==null||json.trim().isEmpty())return;mirror(json,"BOOTSTRAP");}
    public synchronized void mirrorLegacyState(String json){mirror(json,"LEGACY_SAVE");}

    private void mirror(String json,String source){
        if(json==null||json.trim().isEmpty())return;
        final JSONObject root;try{root=new JSONObject(json);}catch(Exception e){return;}
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{writeStateInTx(db,root,json,source,System.currentTimeMillis());db.setTransactionSuccessful();}finally{db.endTransaction();}
    }

    private static void writeStateInTx(SQLiteDatabase db,JSONObject root,String json,String source,long now){
        final String checksum=sha256(json);final int schema=root.optInt("schemaVersion",0);final JSONObject meta=root.optJSONObject("meta");final long rev=meta==null?0:meta.optLong("dataRevision",0);
        boolean snapshot=true;try(Cursor c=db.rawQuery("SELECT checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT 1",null)){if(c.moveToFirst()&&checksum.equals(c.getString(0)))snapshot=false;}
        if(snapshot){ContentValues v=new ContentValues();v.put("id","snapshot-"+UUID.randomUUID());v.put("checksum_sha256",checksum);v.put("state_json",json);v.put("source",source);v.put("legacy_schema_version",schema);v.put("data_revision",rev);v.put("created_at_ms",now);db.insertOrThrow("state_snapshots",null,v);db.execSQL("DELETE FROM state_snapshots WHERE id NOT IN (SELECT id FROM state_snapshots ORDER BY created_at_ms DESC LIMIT "+MAX_SNAPSHOTS+")");}
        mirrorStations(db,root.optJSONArray("stations"),now);importLegacyEvents(db,root.optJSONArray("outbox"),now);
        CoreDomainSchemaV2.dualWrite(db,root,rev,checksum,now);CoreOperationalSchemaP1.dualWrite(db,root,rev,checksum,now);CoreBusinessSchemaP1.dualWrite(db,root,rev,now);CoreDeviceSchemaP2.dualWrite(db,root,rev,now);CoreOwnerSchemaP3.dualWrite(db,root,rev,now);CorePlayerSchemaP4.dualWrite(db,root,rev,now);CoreSaasSchemaP5.dualWrite(db,root,rev,now);CoreSyncSchemaV8.dualWrite(db,root,now);
        putMeta(db,"migration_mode","DOMAIN_DUAL_WRITE");putMeta(db,"legacy_schema_version",String.valueOf(schema));putMeta(db,"legacy_data_revision",String.valueOf(rev));putMeta(db,"last_mirror_checksum",checksum);putMeta(db,"last_mirror_at_ms",String.valueOf(now));
    }

    public synchronized String commitCommand(String commandJson,String nextStateJson,String eventJson){
        final long now=System.currentTimeMillis();
        try{
            if(commandJson==null||commandJson.length()>512*1024)return error("MALFORMED","Invalid command body");
            if(nextStateJson==null||nextStateJson.length()>8*1024*1024)return error("MALFORMED","Invalid state body");
            JSONObject cmd=new JSONObject(commandJson),next=new JSONObject(nextStateJson);
            String commandId=required(cmd,"commandId"),type=nonBlank(cmd.optString("type"),cmd.optString("commandType"));if(type.isEmpty())return error("MALFORMED","type required");
            String idem=required(cmd,"idempotencyKey"),actor=required(cmd,"actorId"),branch=required(cmd,"branchId"),device=required(cmd,"originDeviceId");
            String entityType=blankToNull(cmd.optString("entityType")),entityId=blankToNull(cmd.optString("entityId")),correlation=blankToNull(cmd.optString("correlationId"));
            Long expected=cmd.has("expectedRevision")&&!cmd.isNull("expectedRevision")?cmd.optLong("expectedRevision"):null;
            Object payloadObj=cmd.opt("payload");String payload=payloadObj==null||payloadObj==JSONObject.NULL?"{}":String.valueOf(payloadObj);
            String fingerprint=sha256(type+"|"+idem+"|"+(expected==null?"":expected)+"|"+(entityType==null?"":entityType)+"|"+(entityId==null?"":entityId)+"|"+payload);
            SQLiteDatabase db=getWritableDatabase();
            String replay=CoreCommandSchemaV9.commandResult(db,idem,fingerprint);if(replay!=null)return replay;
            db.beginTransaction();
            try{
                replay=CoreCommandSchemaV9.commandResult(db,idem,fingerprint);if(replay!=null){db.setTransactionSuccessful();return replay;}
                long currentRevision=CoreCommandSchemaV9.entityRevision(db,entityType,entityId);
                if(expected!=null&&expected!=currentRevision)return rejectInTx(db,commandId,type,idem,expected,entityType,entityId,actor,branch,device,correlation,payload,fingerprint,"REVISION_CONFLICT","Expected "+expected+" but current is "+currentRevision,now);
                String previousJson=latestStateJson(db);JSONObject previous=previousJson.isEmpty()?new JSONObject():new JSONObject(previousJson);
                String transitionError=validateTransition(type,entityType,entityId,previous,next,payloadObj instanceof JSONObject?(JSONObject)payloadObj:new JSONObject());
                if(transitionError!=null)return rejectInTx(db,commandId,type,idem,expected,entityType,entityId,actor,branch,device,correlation,payload,fingerprint,"BUSINESS_RULE",transitionError,now);
                CoreCommandSchemaV9.insertPendingCommand(db,commandId,type,idem,expected,entityType,entityId,actor,branch,device,correlation,payload,fingerprint,now);
                long newRevision=(entityType!=null&&entityId!=null)?currentRevision+1:currentRevision;
                if(entityType!=null&&entityId!=null){CoreCommandSchemaV9.setEntityRevision(db,entityType,entityId,newRevision,now);applyRevision(next,entityType,entityId,newRevision,now);}
                JSONObject meta=next.optJSONObject("meta");if(meta==null){meta=new JSONObject();next.put("meta",meta);}meta.put("dataRevision",Math.max(meta.optLong("dataRevision",0),parseLong(getMeta(db,"legacy_data_revision","0"))+1));meta.put("updatedAt",now);
                String canonicalState=next.toString();writeStateInTx(db,next,canonicalState,"COMMAND:"+type,now);
                JSONObject evt=eventJson==null||eventJson.trim().isEmpty()?new JSONObject():new JSONObject(eventJson);
                String eventType=nonBlank(evt.optString("eventType"),eventTypeForCommand(type));String eventId=nonBlank(evt.optString("eventId"),"evt-"+UUID.randomUUID());String eventIdem=nonBlank(evt.optString("idempotencyKey"),"event:"+commandId+":"+eventType);
                String tenant=blankToNull(evt.optString("tenantId",cmd.optString("tenantId"))),venue=blankToNull(evt.optString("venueId",cmd.optString("venueId"))),station=blankToNull(evt.optString("stationId")),severity=nonBlank(evt.optString("severity"),"INFO"),causation=blankToNull(evt.optString("causationId",commandId));Object eventPayload=evt.has("payload")?evt.opt("payload"):payloadObj;String eventPayloadJson=eventPayload==null||eventPayload==JSONObject.NULL?"{}":String.valueOf(eventPayload);
                CoreCommandSchemaV9.appendEvent(db,eventId,eventType,tenant,venue,branch,station,device,entityType,entityId,actor,now,eventPayloadJson,correlation,causation,eventIdem,severity,Math.max(1,evt.optInt("schemaVersion",1)));
                String prevHash=CoreCommandSchemaV9.lastAuditHash(db);String auditId="audit-"+UUID.randomUUID();String auditCanonical=auditId+"|"+branch+"|"+actor+"|"+device+"|"+type+"|"+(entityId==null?"":entityId)+"|"+now+"|"+prevHash+"|"+commandId;String auditHash=sha256(auditCanonical);CoreCommandSchemaV9.appendAudit(db,auditId,venue,branch,actor,device,entityType,entityId,type,payload,now,prevHash,auditHash,correlation,commandId);
                JSONObject result=new JSONObject();result.put("ok",true);result.put("commandId",commandId);result.put("idempotencyKey",idem);result.put("newRevision",newRevision);result.put("eventId",eventId);result.put("state",next);String resultJson=result.toString();CoreCommandSchemaV9.markApplied(db,commandId,resultJson,now);db.setTransactionSuccessful();return resultJson;
            }finally{db.endTransaction();}
        }catch(Exception e){return error("MALFORMED",e.getMessage()==null?"Command rejected":e.getMessage());}
    }

    private static String rejectInTx(SQLiteDatabase db,String commandId,String type,String idem,Long expected,String entityType,String entityId,String actor,String branch,String device,String correlation,String payload,String fingerprint,String code,String message,long now){
        CoreCommandSchemaV9.insertPendingCommand(db,commandId,type,idem,expected,entityType,entityId,actor,branch,device,correlation,payload,fingerprint,now);CoreCommandSchemaV9.markRejected(db,commandId,code,message,now);JSONObject out=new JSONObject();try{out.put("ok",false);out.put("code",code);out.put("message",message);out.put("commandId",commandId);}catch(Exception ignored){}db.setTransactionSuccessful();return out.toString();
    }

    private static String validateTransition(String type,String entityType,String entityId,JSONObject previous,JSONObject next,JSONObject payload){
        String t=type.toUpperCase(Locale.ROOT);
        if(t.startsWith("SESSION.")){
            JSONObject before=findById(previous.optJSONArray("sessions"),entityId),after=findById(next.optJSONArray("sessions"),entityId);String b=status(before),a=status(after);
            if("SESSION.REQUEST".equals(t)){if(before!=null)return "Session already exists";if(!("REQUESTED".equals(a)||"AWAITING_PAYMENT".equals(a)))return "SESSION.REQUEST must create REQUESTED or AWAITING_PAYMENT";}
            else if("SESSION.PAY".equals(t)){if(!isOne(b,"REQUESTED","AWAITING_PAYMENT"))return "SESSION.PAY requires REQUESTED/AWAITING_PAYMENT";if(!"PAID".equals(a))return "SESSION.PAY must produce PAID";}
            else if("SESSION.START".equals(t)){if(!isOne(b,"PAID","REQUESTED"))return "SESSION.START requires PAID (or zero-value REQUESTED)";if(!"ACTIVE".equals(a))return "SESSION.START must produce ACTIVE";if("REQUESTED".equals(b)&&num(after,"totalAmount")>0)return "Paid session required before ACTIVE";}
            else if("SESSION.PAUSE".equals(t)){if(!"ACTIVE".equals(b)||!"PAUSED".equals(a))return "ACTIVE -> PAUSED required";}
            else if("SESSION.RESUME".equals(t)){if(!"PAUSED".equals(b)||!"ACTIVE".equals(a))return "PAUSED -> ACTIVE required";}
            else if("SESSION.EXPIRE".equals(t)){if(!isOne(b,"ACTIVE","PAUSED")||!"EXPIRED".equals(a))return "ACTIVE/PAUSED -> EXPIRED required";}
            else if("SESSION.COMPLETE".equals(t)){if(!isOne(b,"ACTIVE","PAUSED","EXPIRED")||!"COMPLETED".equals(a))return "ACTIVE/PAUSED/EXPIRED -> COMPLETED required";}
            else if("SESSION.CANCEL".equals(t)){if(!isOne(b,"REQUESTED","AWAITING_PAYMENT","PAID")||!"CANCELLED".equals(a))return "Only non-active session request may be cancelled";}
        }
        if(t.startsWith("QUEUE.")){
            JSONObject before=findById(previous.optJSONArray("queue"),entityId),after=findById(next.optJSONArray("queue"),entityId);String b=status(before),a=status(after);
            if("QUEUE.JOIN".equals(t)){if(before!=null||!"WAITING".equals(a))return "QUEUE.JOIN must create WAITING";}
            else if("QUEUE.CALL".equals(t)){if(!"WAITING".equals(b)||!"CALLED".equals(a))return "WAITING -> CALLED required";}
            else if("QUEUE.SEAT".equals(t)){if(!"CALLED".equals(b)||!"SEATED".equals(a))return "CALLED -> SEATED required";}
            else if("QUEUE.LEAVE".equals(t)){if(!isOne(b,"WAITING","CALLED")||!"LEFT".equals(a))return "WAITING/CALLED -> LEFT required";}
        }
        if("PAYMENT.RECORD".equals(t)){double amount=payload.optDouble("amount",0);if(amount<=0)return "PAYMENT.RECORD amount must be > 0";}
        if(t.startsWith("REFUND.")){double amount=Math.abs(payload.optDouble("amount",0));if(amount<=0)return "Refund amount must be > 0";String origin=payload.optString("originPaymentId",payload.optString("refundOfPaymentId",""));if(origin.isEmpty())return "Refund origin payment required";double paid=paymentAmount(previous.optJSONArray("payments"),origin);double refunded=refundedAmount(previous.optJSONArray("payments"),origin);if(paid<=0||amount>paid-refunded+0.0001)return "Refund exceeds refundable balance";}
        return null;
    }

    private static void applyRevision(JSONObject root,String entityType,String entityId,long revision,long now){JSONArray arr=arrayFor(root,entityType);JSONObject x=findById(arr,entityId);if(x!=null){try{x.put("revision",revision);x.put("updatedAt",now);}catch(Exception ignored){}}}
    private static JSONArray arrayFor(JSONObject root,String entityType){if(entityType==null)return null;String x=entityType.toUpperCase(Locale.ROOT);if("SESSION".equals(x))return root.optJSONArray("sessions");if("PAYMENT".equals(x))return root.optJSONArray("payments");if("QUEUE_ENTRY".equals(x)||"QUEUE".equals(x))return root.optJSONArray("queue");if("SHIFT".equals(x))return root.optJSONArray("shifts");if("CUSTOMER".equals(x))return root.optJSONArray("clients");if("BOOKING".equals(x))return root.optJSONArray("bookings");return null;}
    private static JSONObject findById(JSONArray a,String id){if(a==null||id==null)return null;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x!=null&&id.equals(x.optString("id")))return x;}return null;}
    private static String status(JSONObject x){return x==null?"":x.optString("status","").toUpperCase(Locale.ROOT);}
    private static boolean isOne(String x,String... vals){for(String v:vals)if(v.equals(x))return true;return false;}
    private static double num(JSONObject x,String key){return x==null?0:x.optDouble(key,0);}
    private static double paymentAmount(JSONArray a,String id){JSONObject p=findById(a,id);return p==null?0:Math.max(0,p.optDouble("amount",0));}
    private static double refundedAmount(JSONArray a,String origin){if(a==null)return 0;double sum=0;for(int i=0;i<a.length();i++){JSONObject p=a.optJSONObject(i);if(p!=null&&origin.equals(p.optString("refundOfPaymentId")))sum+=Math.abs(Math.min(0,p.optDouble("amount",0)));}return sum;}
    private static String eventTypeForCommand(String type){String t=type.toUpperCase(Locale.ROOT);if("SESSION.REQUEST".equals(t))return "SESSION_REQUESTED";if("SESSION.PAY".equals(t))return "SESSION_PAID";if("SESSION.START".equals(t))return "SESSION_STARTED";if("SESSION.PAUSE".equals(t))return "SESSION_PAUSED";if("SESSION.RESUME".equals(t))return "SESSION_RESUMED";if("SESSION.EXPIRE".equals(t))return "SESSION_EXPIRED";if("SESSION.COMPLETE".equals(t))return "SESSION_COMPLETED";if("SESSION.CANCEL".equals(t))return "SESSION_CANCELLED";if("PAYMENT.RECORD".equals(t))return "PAYMENT_RECORDED";if(t.startsWith("REFUND."))return "REFUND_CREATED";if("SHIFT.OPEN".equals(t))return "SHIFT_OPENED";if("SHIFT.CLOSE".equals(t))return "SHIFT_CLOSED";if("QUEUE.JOIN".equals(t))return "QUEUE_JOINED";if("QUEUE.CALL".equals(t))return "QUEUE_CALLED";if("QUEUE.SEAT".equals(t))return "QUEUE_SEATED";if("QUEUE.LEAVE".equals(t))return "QUEUE_LEFT";return t.replace('.','_');}

    private static void mirrorStations(SQLiteDatabase db,JSONArray a,long now){if(a==null)return;db.delete("resources_shadow",null,null);for(int i=0;i<a.length();i++){JSONObject s=a.optJSONObject(i);if(s==null)continue;String id=s.optString("id","").trim();if(id.isEmpty())continue;String legacy=s.optString("type","CUSTOM"),type=s.optString("osResourceType",CoreDomainSchemaV2.mapResourceType(legacy));ContentValues v=new ContentValues();v.put("id",id);v.put("name",s.optString("name",id));v.put("resource_type",type);v.put("legacy_station_type",legacy);v.put("enabled",s.optBoolean("enabled",true)?1:0);v.put("sort_order",s.optInt("sort",i+1));v.put("updated_at_ms",now);db.insertWithOnConflict("resources_shadow",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void importLegacyEvents(SQLiteDatabase db,JSONArray a,long now){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject e=a.optJSONObject(i);if(e==null)continue;String id=e.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("event_id",id);v.put("event_type",e.optString("type","legacy.unknown"));String entity=e.optString("entityId","");if(!entity.isEmpty())v.put("entity_id",entity);Object p=e.opt("payload");v.put("payload_json",p==null||p==JSONObject.NULL?null:String.valueOf(p));v.put("event_at_ms",e.optLong("at",now));v.put("legacy_revision",e.optLong("revision",0));v.put("imported_at_ms",now);long inserted=db.insertWithOnConflict("domain_events",null,v,SQLiteDatabase.CONFLICT_IGNORE);if(inserted!=-1){ContentValues o=new ContentValues();o.put("event_id",id);o.put("status","PENDING");o.put("attempts",0);o.put("created_at_ms",now);db.insertWithOnConflict("sync_outbox",null,o,SQLiteDatabase.CONFLICT_IGNORE);}}}

    public synchronized String recoverLatestValidStateJson(){SQLiteDatabase db=getReadableDatabase();try(Cursor c=db.rawQuery("SELECT state_json,checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT "+MAX_SNAPSHOTS,null)){while(c.moveToNext()){String j=c.getString(0),h=c.getString(1);try{new JSONObject(j);if(h.equals(sha256(j)))return j;}catch(Exception ignored){}}}return "";}
    private static String latestStateJson(SQLiteDatabase db){try(Cursor c=db.rawQuery("SELECT state_json,checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT 1",null)){if(c.moveToFirst()){String j=c.getString(0);if(c.getString(1).equals(sha256(j)))return j;}}return "";}

    public synchronized JSONObject getTimelineJson(){JSONObject out=new JSONObject();JSONArray ss=new JSONArray(),ev=new JSONArray();SQLiteDatabase db=getReadableDatabase();try(Cursor c=db.rawQuery("SELECT id,source,data_revision,created_at_ms,checksum_sha256 FROM state_snapshots ORDER BY created_at_ms DESC LIMIT 20",null)){while(c.moveToNext()){JSONObject x=new JSONObject();x.put("id",c.getString(0));x.put("source",c.getString(1));x.put("revision",c.getLong(2));x.put("createdAtMs",c.getLong(3));x.put("checksum",c.getString(4));ss.put(x);}}catch(Exception ignored){}try(Cursor c=db.rawQuery("SELECT event_id,event_type,entity_id,server_timestamp_ms FROM domain_events_v9 ORDER BY server_timestamp_ms DESC LIMIT 60",null)){while(c.moveToNext()){JSONObject x=new JSONObject();x.put("eventId",c.getString(0));x.put("eventType",c.getString(1));x.put("entityId",c.isNull(2)?JSONObject.NULL:c.getString(2));x.put("eventAtMs",c.getLong(3));ev.put(x);}}catch(Exception ignored){}try{out.put("snapshots",ss);out.put("events",ev);}catch(Exception ignored){}return out;}

    public synchronized JSONObject getStatusJson(){SQLiteDatabase db=getReadableDatabase();JSONObject out=new JSONObject();try{JSONObject a2=CoreDomainSchemaV2.status(db),p1=CoreOperationalSchemaP1.status(db),biz=CoreBusinessSchemaP1.status(db),p2=CoreDeviceSchemaP2.status(db),p3=CoreOwnerSchemaP3.status(db),p4=CorePlayerSchemaP4.status(db),p5=CoreSaasSchemaP5.status(db),sync=CoreSyncSchemaV8.status(db),cmd=new JSONObject(CoreCommandSchemaV9.statusJson(db));JSONArray rr=a2.optJSONArray("resourceRegistry");out.put("coreVersion","master-v2-command-v9");out.put("dbSchemaVersion",DB_VERSION);out.put("masterContractVersion",getMeta(db,"master_contract_version",""));out.put("migrationMode",getMeta(db,"migration_mode","DOMAIN_DUAL_WRITE"));out.put("operatingMode",getMeta(db,"operating_mode","STANDALONE"));out.put("authorityState",getMeta(db,"authority_state","TABLET_PRIMARY"));out.put("legacySchemaVersion",parseLong(getMeta(db,"legacy_schema_version","0")));out.put("legacyDataRevision",parseLong(getMeta(db,"legacy_data_revision","0")));out.put("lastMirrorAtMs",parseLong(getMeta(db,"last_mirror_at_ms","0")));out.put("snapshotCount",scalar(db,"SELECT COUNT(*) FROM state_snapshots"));out.put("resourceCount",rr==null?0:rr.length());out.put("eventCount",scalar(db,"SELECT COUNT(*) FROM domain_events_v9"));out.put("pendingSyncCount",scalar(db,"SELECT COUNT(*) FROM outbox_events_v9 WHERE status='PENDING'"));out.put("checkpointCount",scalar(db,"SELECT COUNT(*) FROM migration_checkpoints"));out.put("venueProfile",a2.optJSONObject("venueProfile"));out.put("resourceRegistry",rr);out.put("domainAuthority",a2.optJSONArray("domainAuthority"));out.put("normalizedDomains",a2.optJSONArray("normalizedDomains"));out.put("p1Operational",p1);out.put("p1Business",biz);out.put("p2Device",p2);out.put("p3Owner",p3);out.put("p4Player",p4);out.put("p5Saas",p5);out.put("webParitySync",sync);out.put("commandCore",cmd);out.put("authorityProgress","MASTER_V2_PHASE_1_2_COMMAND_CORE_V9");out.put("legacyStillAuthoritative",true);out.put("networkRequired",false);}catch(Exception ignored){}return out;}

    public synchronized String getOperatingMode(){return getMeta(getReadableDatabase(),"operating_mode","STANDALONE");}
    public synchronized void setOperatingMode(String mode){String x=mode==null?"":mode.trim().toUpperCase(Locale.ROOT);if(!"STANDALONE".equals(x)&&!"CONNECTED_LOCAL".equals(x))throw new IllegalArgumentException("Unsupported operating mode");SQLiteDatabase db=getWritableDatabase();putMeta(db,"operating_mode",x);putMeta(db,"authority_state","TABLET_PRIMARY");}

    private static String required(JSONObject o,String key)throws Exception{String x=o.optString(key,"").trim();if(x.isEmpty())throw new IllegalArgumentException(key+" required");return x;}
    private static String nonBlank(String a,String b){return a==null||a.trim().isEmpty()?(b==null?"":b.trim()):a.trim();}
    private static String blankToNull(String x){return x==null||x.trim().isEmpty()?null:x.trim();}
    private static String error(String code,String message){JSONObject o=new JSONObject();try{o.put("ok",false);o.put("code",code);o.put("message",message==null?"Error":message);}catch(Exception ignored){}return o.toString();}
    private static void putMeta(SQLiteDatabase db,String k,String x){ContentValues v=new ContentValues();v.put("key",k);v.put("value",x==null?"":x);db.insertWithOnConflict("core_meta",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static String getMeta(SQLiteDatabase db,String k,String f){try(Cursor c=db.rawQuery("SELECT value FROM core_meta WHERE key=?",new String[]{k})){return c.moveToFirst()?c.getString(0):f;}}
    private static long scalar(SQLiteDatabase db,String q){try(Cursor c=db.rawQuery(q,null)){return c.moveToFirst()?c.getLong(0):0;}}
    private static long parseLong(String x){try{return Long.parseLong(x);}catch(Exception e){return 0;}}
    public static String sha256(String x){try{MessageDigest d=MessageDigest.getInstance("SHA-256");byte[] b=d.digest(x.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder(b.length*2);for(byte z:b)s.append(String.format(Locale.ROOT,"%02x",z&0xff));return s.toString();}catch(Exception e){throw new IllegalStateException("SHA-256 unavailable",e);}}
}
