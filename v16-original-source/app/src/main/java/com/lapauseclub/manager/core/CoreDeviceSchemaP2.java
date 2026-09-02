package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

final class CoreDeviceSchemaP2 {
    private CoreDeviceSchemaP2() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS devices_p2 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,device_type TEXT NOT NULL,resource_id TEXT,status TEXT NOT NULL,pairing_state TEXT,address TEXT,capabilities_json TEXT NOT NULL,last_heartbeat_at_ms INTEGER,last_seen_at_ms INTEGER,version TEXT,required_for_session INTEGER NOT NULL DEFAULT 0,sequence_no INTEGER NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_devices_p2_resource ON devices_p2(resource_id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_devices_p2_status ON devices_p2(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS device_leases_p2 (id TEXT PRIMARY KEY NOT NULL,device_id TEXT NOT NULL,resource_id TEXT NOT NULL,session_id TEXT NOT NULL,status TEXT NOT NULL,issued_at_ms INTEGER NOT NULL,expires_at_ms INTEGER NOT NULL,released_at_ms INTEGER,sequence_no INTEGER NOT NULL DEFAULT 1,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_device_leases_p2_session ON device_leases_p2(session_id,status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS device_commands_p2 (id TEXT PRIMARY KEY NOT NULL,device_id TEXT NOT NULL,sequence_no INTEGER NOT NULL,command_type TEXT NOT NULL,payload_json TEXT NOT NULL,idempotency_key TEXT NOT NULL,requires_ack INTEGER NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER NOT NULL,updated_at_ms INTEGER NOT NULL,ack_at_ms INTEGER,last_error TEXT,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_device_commands_p2_device_seq ON device_commands_p2(device_id,sequence_no)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_device_commands_p2_status ON device_commands_p2(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS device_alerts_p2 (id TEXT PRIMARY KEY NOT NULL,device_id TEXT,severity TEXT NOT NULL,alert_type TEXT NOT NULL,status TEXT NOT NULL,created_at_ms INTEGER NOT NULL,closed_at_ms INTEGER,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS resource_readiness_p2 (resource_id TEXT PRIMARY KEY NOT NULL,status TEXT NOT NULL,reason TEXT,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS staff_tasks_p2 (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,priority TEXT NOT NULL,resource_id TEXT,created_at_ms INTEGER NOT NULL,completed_at_ms INTEGER,raw_json TEXT NOT NULL)");
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, long now) {
        upsertDevices(db, root.optJSONArray("deviceRegistry"), now);
        upsertLeases(db, root.optJSONArray("deviceLeases"), now);
        upsertCommands(db, root.optJSONArray("deviceCommands"), now);
        upsertAlerts(db, root.optJSONArray("deviceAlerts"), now);
        upsertReadiness(db, root.optJSONArray("resourceReadiness"), now);
        upsertTasks(db, root.optJSONArray("staffTasks"), now);
        for (String d : new String[]{"DEVICES","DEVICE_LEASES","DEVICE_COMMANDS","DEVICE_ALERTS","READINESS","STAFF_TASKS"}) markDomain(db,d,revision,now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject o=new JSONObject();try{
            o.put("deviceCountNormalized",scalar(db,"SELECT COUNT(*) FROM devices_p2"));
            o.put("deviceOnlineNormalized",scalar(db,"SELECT COUNT(*) FROM devices_p2 WHERE UPPER(status)='ONLINE'"));
            o.put("activeLeaseCountNormalized",scalar(db,"SELECT COUNT(*) FROM device_leases_p2 WHERE UPPER(status)='ACTIVE'"));
            o.put("pendingDeviceCommandCountNormalized",scalar(db,"SELECT COUNT(*) FROM device_commands_p2 WHERE UPPER(status) IN ('PENDING','ERROR','BLOCKED_EXTERNAL','SENDING')"));
            o.put("openDeviceAlertCountNormalized",scalar(db,"SELECT COUNT(*) FROM device_alerts_p2 WHERE UPPER(status)='OPEN'"));
            o.put("blockedReadinessCountNormalized",scalar(db,"SELECT COUNT(*) FROM resource_readiness_p2 WHERE UPPER(status)<>'READY'"));
            o.put("openStaffTaskCountNormalized",scalar(db,"SELECT COUNT(*) FROM staff_tasks_p2 WHERE UPPER(status)='OPEN'"));
            o.put("normalizedDeviceDomains",new JSONArray().put("DEVICES").put("DEVICE_LEASES").put("DEVICE_COMMANDS").put("DEVICE_ALERTS").put("READINESS").put("STAFF_TASKS"));
        }catch(Exception ignored){}return o;
    }

    private static void upsertDevices(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject d=rows.optJSONObject(i);if(d==null)continue;String id=d.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",blank(d.optString("name"),id));v.put("device_type",blank(d.optString("deviceType"),"CUSTOM_DEVICE"));putNullable(v,"resource_id",d.optString("resourceId",""));v.put("status",blank(d.optString("status"),"UNKNOWN"));putNullable(v,"pairing_state",d.optString("pairingState",""));putNullable(v,"address",d.optString("address",""));Object c=d.opt("capabilities");v.put("capabilities_json",c==null||c==JSONObject.NULL?"{}":String.valueOf(c));putTime(v,"last_heartbeat_at_ms",d.opt("lastHeartbeatAt"));putTime(v,"last_seen_at_ms",d.opt("lastSeenAt"));putNullable(v,"version",d.optString("version",""));v.put("required_for_session",d.optBoolean("requiredForSession",false)?1:0);v.put("sequence_no",d.optLong("sequence",0));v.put("updated_at_ms",time(d.opt("updatedAt"),now));v.put("raw_json",d.toString());db.insertWithOnConflict("devices_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertLeases(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject l=rows.optJSONObject(i);if(l==null)continue;String id=l.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("device_id",blank(l.optString("deviceId"),"unknown"));v.put("resource_id",blank(l.optString("resourceId"),"unknown"));v.put("session_id",blank(l.optString("sessionId"),"unknown"));v.put("status",blank(l.optString("status"),"ACTIVE"));v.put("issued_at_ms",time(l.opt("issuedAt"),now));v.put("expires_at_ms",time(l.opt("expiresAt"),now));putTime(v,"released_at_ms",l.opt("releasedAt"));v.put("sequence_no",l.optLong("sequence",1));v.put("updated_at_ms",time(l.opt("updatedAt"),now));v.put("raw_json",l.toString());db.insertWithOnConflict("device_leases_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertCommands(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject c=rows.optJSONObject(i);if(c==null)continue;String id=c.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("device_id",blank(c.optString("deviceId"),"unknown"));v.put("sequence_no",c.optLong("sequence",0));v.put("command_type",blank(c.optString("commandType"),"UNKNOWN"));Object p=c.opt("payload");v.put("payload_json",p==null||p==JSONObject.NULL?"{}":String.valueOf(p));v.put("idempotency_key",blank(c.optString("idempotencyKey"),id));v.put("requires_ack",c.optBoolean("requiresAck",true)?1:0);v.put("status",blank(c.optString("status"),"PENDING"));v.put("attempts",c.optLong("attempts",0));v.put("created_at_ms",time(c.opt("createdAt"),now));v.put("updated_at_ms",time(c.opt("updatedAt"),now));putTime(v,"ack_at_ms",c.opt("ackAt"));putNullable(v,"last_error",c.optString("lastError",""));v.put("raw_json",c.toString());db.insertWithOnConflict("device_commands_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertAlerts(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject a=rows.optJSONObject(i);if(a==null)continue;String id=a.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);putNullable(v,"device_id",a.optString("deviceId",""));v.put("severity",blank(a.optString("severity"),"INFO"));v.put("alert_type",blank(a.optString("type"),"UNKNOWN"));v.put("status",blank(a.optString("status"),"OPEN"));v.put("created_at_ms",time(a.opt("createdAt"),now));putTime(v,"closed_at_ms",a.opt("closedAt"));v.put("raw_json",a.toString());db.insertWithOnConflict("device_alerts_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertReadiness(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r==null)continue;String id=r.optString("resourceId","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("resource_id",id);v.put("status",blank(r.optString("status"),"READY"));putNullable(v,"reason",r.optString("reason",""));v.put("updated_at_ms",time(r.opt("updatedAt"),now));v.put("raw_json",r.toString());db.insertWithOnConflict("resource_readiness_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void upsertTasks(SQLiteDatabase db,JSONArray rows,long now){if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject t=rows.optJSONObject(i);if(t==null)continue;String id=t.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("title",blank(t.optString("title"),id));v.put("status",blank(t.optString("status"),"OPEN"));v.put("priority",blank(t.optString("priority"),"NORMAL"));putNullable(v,"resource_id",t.optString("resourceId",""));v.put("created_at_ms",time(t.opt("createdAt"),now));putTime(v,"completed_at_ms",t.opt("completedAt"));v.put("raw_json",t.toString());db.insertWithOnConflict("staff_tasks_p2",null,v,SQLiteDatabase.CONFLICT_REPLACE);}}
    private static void markDomain(SQLiteDatabase db,String domain,long revision,long now){ContentValues v=new ContentValues();v.put("domain",domain);v.put("authority","SQLITE_DUAL_WRITE");v.put("migration_state","PARITY_PROVING");v.put("source_revision",revision);v.put("updated_at_ms",now);db.insertWithOnConflict("domain_authority",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static long scalar(SQLiteDatabase db,String sql){try(Cursor c=db.rawQuery(sql,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static String blank(String v,String f){return v==null||v.trim().isEmpty()?f:v.trim();}
    private static void putNullable(ContentValues v,String k,String x){if(x==null||x.trim().isEmpty())v.putNull(k);else v.put(k,x.trim());}
    private static void putTime(ContentValues v,String k,Object x){long t=time(x,0);if(t<=0)v.putNull(k);else v.put(k,t);}
    private static long time(Object x,long f){if(x==null||x==JSONObject.NULL)return f;if(x instanceof Number)return ((Number)x).longValue();String s=String.valueOf(x).trim();if(s.isEmpty())return f;try{return Long.parseLong(s);}catch(Exception ignored){}try{return java.time.Instant.parse(s).toEpochMilli();}catch(Exception ignored){}return f;}
}
