package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

final class CoreExpansionSchema {
    static final int SCHEMA_VERSION = 4;
    private CoreExpansionSchema() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS devices_p2 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,device_type TEXT NOT NULL,resource_id TEXT,status TEXT NOT NULL,paired INTEGER NOT NULL DEFAULT 0,capabilities_json TEXT NOT NULL,version TEXT,last_heartbeat_ms INTEGER,created_at_ms INTEGER,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_devices_p2_resource ON devices_p2(resource_id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_devices_p2_status ON devices_p2(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS owner_alerts_p3 (id TEXT PRIMARY KEY NOT NULL,severity TEXT NOT NULL,title TEXT NOT NULL,detail TEXT,status TEXT NOT NULL,at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS revenue_actions_p3 (id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,impact TEXT,reason TEXT,action_text TEXT,status TEXT NOT NULL,suggested_at_ms INTEGER,approved_at_ms INTEGER,executed_at_ms INTEGER,measured_at_ms INTEGER)");
        db.execSQL("CREATE TABLE IF NOT EXISTS player_missions_p4 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,metric TEXT NOT NULL,target REAL NOT NULL,reward_points INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1)");
        db.execSQL("CREATE TABLE IF NOT EXISTS service_requests_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT,request_type TEXT NOT NULL,detail TEXT,status TEXT NOT NULL,priority TEXT NOT NULL,created_at_ms INTEGER NOT NULL,ack_at_ms INTEGER,resolved_at_ms INTEGER)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_service_requests_p4_status ON service_requests_p4(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS campaigns_p4 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,audience TEXT NOT NULL,message TEXT,status TEXT NOT NULL,channels_json TEXT NOT NULL,frequency_cap INTEGER NOT NULL DEFAULT 1,start_at_ms INTEGER,end_at_ms INTEGER,created_at_ms INTEGER,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS proof_of_play_p4 (id TEXT PRIMARY KEY NOT NULL,campaign_id TEXT NOT NULL,device_id TEXT,resource_id TEXT,at_ms INTEGER NOT NULL,duration_ms INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pop_campaign ON proof_of_play_p4(campaign_id,at_ms)");
        db.execSQL("CREATE TABLE IF NOT EXISTS automation_rules_p5 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,trigger_type TEXT NOT NULL,conditions_json TEXT NOT NULL,action_text TEXT NOT NULL,mode TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,last_run_ms INTEGER,run_count INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER)");
        db.execSQL("CREATE TABLE IF NOT EXISTS feature_registry_p5 (feature_id TEXT PRIMARY KEY NOT NULL,status TEXT NOT NULL,phase TEXT NOT NULL,reason TEXT,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS sync_state_p5 (singleton_id INTEGER PRIMARY KEY CHECK(singleton_id=1),authority TEXT NOT NULL,compatibility TEXT NOT NULL,cursor TEXT,last_handshake_ms INTEGER,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS domain_events_v2 (event_id TEXT PRIMARY KEY NOT NULL,event_type TEXT NOT NULL,tenant_id TEXT,venue_id TEXT,branch_id TEXT,device_id TEXT,entity_type TEXT,entity_id TEXT,actor_id TEXT,local_timestamp_ms INTEGER NOT NULL,payload_json TEXT,correlation_id TEXT,causation_id TEXT,idempotency_key TEXT,severity TEXT,schema_version INTEGER NOT NULL DEFAULT 1)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_domain_events_v2_entity ON domain_events_v2(entity_type,entity_id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_domain_events_v2_time ON domain_events_v2(local_timestamp_ms)");
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, long now) {
        upsertDevices(db, root.optJSONArray("devices"), now);
        upsertAlerts(db, root.optJSONArray("ownerAlerts"), now);
        upsertRevenue(db, root.optJSONArray("revenueActions"));
        upsertMissions(db, root.optJSONArray("playerMissions"));
        upsertService(db, root.optJSONArray("serviceRequests"));
        upsertCampaigns(db, root.optJSONArray("campaigns"), now);
        upsertProof(db, root.optJSONArray("proofOfPlay"));
        upsertAutomations(db, root.optJSONArray("automationRules"));
        upsertFeatures(db, root.optJSONObject("featureMatrix"), now);
        upsertNetwork(db, root.optJSONObject("network"), now);
        upsertEvents(db, root.optJSONArray("domainEventsV2"), now);
        for (String domain : new String[]{"DEVICES","OWNER_ALERTS","REVENUE_ACTIONS","PLAYER_MISSIONS","SERVICE_REQUESTS","CAMPAIGNS","PROOF_OF_PLAY","AUTOMATIONS","FEATURE_REGISTRY","SYNC_STATE","DOMAIN_EVENTS_V2"}) {
            markDomain(db, domain, revision, now);
        }
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject o = new JSONObject();
        try {
            o.put("devices", scalar(db,"SELECT COUNT(*) FROM devices_p2"));
            o.put("alerts", scalar(db,"SELECT COUNT(*) FROM owner_alerts_p3 WHERE status='OPEN'"));
            o.put("revenueActions", scalar(db,"SELECT COUNT(*) FROM revenue_actions_p3"));
            o.put("missions", scalar(db,"SELECT COUNT(*) FROM player_missions_p4 WHERE enabled=1"));
            o.put("serviceOpen", scalar(db,"SELECT COUNT(*) FROM service_requests_p4 WHERE status!='RESOLVED'"));
            o.put("campaigns", scalar(db,"SELECT COUNT(*) FROM campaigns_p4"));
            o.put("proofOfPlay", scalar(db,"SELECT COUNT(*) FROM proof_of_play_p4"));
            o.put("automations", scalar(db,"SELECT COUNT(*) FROM automation_rules_p5 WHERE enabled=1"));
            o.put("features", scalar(db,"SELECT COUNT(*) FROM feature_registry_p5"));
            o.put("eventsV2", scalar(db,"SELECT COUNT(*) FROM domain_events_v2"));
            o.put("normalizedExpansionDomains", new JSONArray().put("DEVICES").put("OWNER_ALERTS").put("REVENUE_ACTIONS").put("PLAYER_MISSIONS").put("SERVICE_REQUESTS").put("CAMPAIGNS").put("PROOF_OF_PLAY").put("AUTOMATIONS").put("FEATURE_REGISTRY").put("SYNC_STATE").put("DOMAIN_EVENTS_V2"));
        } catch (Exception ignored) {}
        return o;
    }

    private static void upsertDevices(SQLiteDatabase db, JSONArray a, long now){
        if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",nb(x.optString("name"),id));v.put("device_type",nb(x.optString("type"),"UNKNOWN"));putN(v,"resource_id",x.optString("resourceId",""));v.put("status",nb(x.optString("status"),"OFFLINE"));v.put("paired",x.optBoolean("paired",false)?1:0);Object c=x.opt("capabilities");v.put("capabilities_json",c==null||c==JSONObject.NULL?"{}":String.valueOf(c));putN(v,"version",x.optString("version",""));putT(v,"last_heartbeat_ms",x.opt("lastHeartbeatAt"));putT(v,"created_at_ms",x.opt("createdAt"));v.put("updated_at_ms",time(x.opt("updatedAt"),now));db.insertWithOnConflict("devices_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertAlerts(SQLiteDatabase db, JSONArray a,long now){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("severity",nb(x.optString("severity"),"INFO"));v.put("title",nb(x.optString("title"),"Alerte"));putN(v,"detail",x.optString("detail",""));v.put("status",nb(x.optString("status"),"OPEN"));v.put("at_ms",time(x.opt("at"),now));db.insertWithOnConflict("owner_alerts_p3",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertRevenue(SQLiteDatabase db,JSONArray a){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("kind",nb(x.optString("kind"),"GENERIC"));v.put("title",nb(x.optString("title"),id));putN(v,"impact",x.optString("impact",""));putN(v,"reason",x.optString("reason",""));putN(v,"action_text",x.optString("action",""));v.put("status",nb(x.optString("status"),"SUGGESTED"));putT(v,"suggested_at_ms",x.opt("suggestedAt"));putT(v,"approved_at_ms",x.opt("approvedAt"));putT(v,"executed_at_ms",x.opt("executedAt"));putT(v,"measured_at_ms",x.opt("measuredAt"));db.insertWithOnConflict("revenue_actions_p3",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertMissions(SQLiteDatabase db,JSONArray a){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",nb(x.optString("name"),id));v.put("metric",nb(x.optString("metric"),"VISITS"));v.put("target",x.optDouble("target",1D));v.put("reward_points",x.optInt("rewardPoints",0));v.put("enabled",x.optBoolean("enabled",true)?1:0);db.insertWithOnConflict("player_missions_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertService(SQLiteDatabase db,JSONArray a){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);putN(v,"customer_id",x.optString("customerId",""));v.put("request_type",nb(x.optString("type"),"ASSISTANCE"));putN(v,"detail",x.optString("detail",""));v.put("status",nb(x.optString("status"),"OPEN"));v.put("priority",nb(x.optString("priority"),"NORMAL"));v.put("created_at_ms",time(x.opt("createdAt"),System.currentTimeMillis()));putT(v,"ack_at_ms",x.opt("ackAt"));putT(v,"resolved_at_ms",x.opt("resolvedAt"));db.insertWithOnConflict("service_requests_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertCampaigns(SQLiteDatabase db,JSONArray a,long now){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",nb(x.optString("name"),id));v.put("audience",nb(x.optString("audience"),"ALL"));putN(v,"message",x.optString("message",""));v.put("status",nb(x.optString("status"),"DRAFT"));Object ch=x.opt("channels");v.put("channels_json",ch==null||ch==JSONObject.NULL?"[]":String.valueOf(ch));v.put("frequency_cap",Math.max(1,x.optInt("frequencyCap",1)));putT(v,"start_at_ms",x.opt("startAt"));putT(v,"end_at_ms",x.opt("endAt"));putT(v,"created_at_ms",x.opt("createdAt"));v.put("updated_at_ms",time(x.opt("updatedAt"),now));db.insertWithOnConflict("campaigns_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertProof(SQLiteDatabase db,JSONArray a){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("campaign_id",nb(x.optString("campaignId"),"unknown"));putN(v,"device_id",x.optString("deviceId",""));putN(v,"resource_id",x.optString("resourceId",""));v.put("at_ms",time(x.opt("at"),System.currentTimeMillis()));v.put("duration_ms",x.optLong("durationMs",0));v.put("status",nb(x.optString("status"),"LOCAL_PROOF"));db.insertWithOnConflict("proof_of_play_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertAutomations(SQLiteDatabase db,JSONArray a){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",nb(x.optString("name"),id));v.put("trigger_type",nb(x.optString("trigger"),"MANUAL"));Object c=x.opt("conditions");v.put("conditions_json",c==null||c==JSONObject.NULL?"[]":String.valueOf(c));v.put("action_text",nb(x.optString("action"),"NONE"));v.put("mode",nb(x.optString("mode"),"SUGGEST"));v.put("enabled",x.optBoolean("enabled",true)?1:0);putT(v,"last_run_ms",x.opt("lastRunAt"));v.put("run_count",x.optInt("runCount",0));putT(v,"created_at_ms",x.opt("createdAt"));db.insertWithOnConflict("automation_rules_p5",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertFeatures(SQLiteDatabase db,JSONObject o,long now){if(o==null)return;JSONArray names=o.names();if(names==null)return;for(int i=0;i<names.length();i++){String key=names.optString(i);JSONObject x=o.optJSONObject(key);if(x==null)continue;ContentValues v=new ContentValues();v.put("feature_id",key);v.put("status",nb(x.optString("status"),"TO_IMPLEMENT"));v.put("phase",nb(x.optString("phase"),"UNKNOWN"));putN(v,"reason",x.optString("reason",""));v.put("updated_at_ms",time(x.opt("updatedAt"),now));db.insertWithOnConflict("feature_registry_p5",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertNetwork(SQLiteDatabase db,JSONObject x,long now){if(x==null)return;ContentValues v=new ContentValues();v.put("singleton_id",1);v.put("authority",nb(x.optString("authority"),"TABLET_PRIMARY"));v.put("compatibility",nb(x.optString("compatibility"),"UNKNOWN"));putN(v,"cursor",x.optString("syncCursor",""));putT(v,"last_handshake_ms",x.opt("lastHandshakeAt"));v.put("updated_at_ms",now);db.insertWithOnConflict("sync_state_p5",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static void upsertEvents(SQLiteDatabase db,JSONArray a,long now){if(a==null)return;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String id=x.optString("eventId","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("event_id",id);v.put("event_type",nb(x.optString("eventType"),"unknown"));putN(v,"tenant_id",x.optString("tenantId",""));putN(v,"venue_id",x.optString("venueId",""));putN(v,"branch_id",x.optString("branchId",""));putN(v,"device_id",x.optString("deviceId",""));putN(v,"entity_type",x.optString("entityType",""));putN(v,"entity_id",x.optString("entityId",""));putN(v,"actor_id",x.optString("actorId",""));v.put("local_timestamp_ms",time(x.opt("localTimestamp"),now));Object p=x.opt("payload");putN(v,"payload_json",p==null||p==JSONObject.NULL?"":String.valueOf(p));putN(v,"correlation_id",x.optString("correlationId",""));putN(v,"causation_id",x.optString("causationId",""));putN(v,"idempotency_key",x.optString("idempotencyKey",""));putN(v,"severity",x.optString("severity","INFO"));v.put("schema_version",x.optInt("schemaVersion",1));db.insertWithOnConflict("domain_events_v2",null,v,SQLiteDatabase.CONFLICT_IGNORE);}}
    private static void markDomain(SQLiteDatabase db,String domain,long revision,long now){ContentValues v=new ContentValues();v.put("domain",domain);v.put("authority","SQLITE_DUAL_WRITE");v.put("migration_state","PARITY_PROVING");v.put("source_revision",revision);v.put("updated_at_ms",now);db.insertWithOnConflict("domain_authority",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static long scalar(SQLiteDatabase db,String sql){try(Cursor c=db.rawQuery(sql,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static String nb(String v,String f){return v==null||v.trim().isEmpty()?f:v.trim();}
    private static void putN(ContentValues v,String c,String x){if(x==null||x.trim().isEmpty())v.putNull(c);else v.put(c,x.trim());}
    private static void putT(ContentValues v,String c,Object x){long t=time(x,0);if(t<=0)v.putNull(c);else v.put(c,t);}
    private static long time(Object x,long f){if(x==null||x==JSONObject.NULL)return f;if(x instanceof Number)return ((Number)x).longValue();String s=String.valueOf(x).trim();if(s.isEmpty())return f;try{return Long.parseLong(s);}catch(Exception ignored){}try{return java.time.Instant.parse(s).toEpochMilli();}catch(Exception ignored){}return f;}
}
