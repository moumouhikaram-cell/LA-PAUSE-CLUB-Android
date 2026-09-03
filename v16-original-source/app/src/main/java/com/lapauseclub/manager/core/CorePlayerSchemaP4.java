package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

/** P4 player/community normalized domains. Android org.json compatible. */
final class CorePlayerSchemaP4 {
    private CorePlayerSchemaP4() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS player_tokens_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,session_id TEXT,token_hash TEXT NOT NULL,status TEXT NOT NULL,expires_at_ms INTEGER NOT NULL,created_at_ms INTEGER NOT NULL,used_at_ms INTEGER,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_player_tokens_p4_customer ON player_tokens_p4(customer_id,status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS memberships_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,membership_type TEXT,status TEXT NOT NULL,starts_at_ms INTEGER,expires_at_ms INTEGER,benefits_json TEXT NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS missions_p4 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,mission_type TEXT NOT NULL,target_json TEXT NOT NULL,reward_points INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS mission_progress_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,mission_id TEXT NOT NULL,status TEXT NOT NULL,progress REAL NOT NULL DEFAULT 0,reward_claimed INTEGER NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_mission_progress_p4_customer ON mission_progress_p4(customer_id,status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS service_requests_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT,session_id TEXT,resource_id TEXT,request_type TEXT NOT NULL,status TEXT NOT NULL,priority TEXT NOT NULL,note TEXT,created_at_ms INTEGER NOT NULL,ack_at_ms INTEGER,done_at_ms INTEGER,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_service_requests_p4_status ON service_requests_p4(status,priority)");
        db.execSQL("CREATE TABLE IF NOT EXISTS referrals_p4 (id TEXT PRIMARY KEY NOT NULL,referrer_customer_id TEXT NOT NULL,code TEXT NOT NULL,status TEXT NOT NULL,uses INTEGER NOT NULL DEFAULT 0,reward_points INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_p4_code ON referrals_p4(code)");
        db.execSQL("CREATE TABLE IF NOT EXISTS player_dna_p4 (customer_id TEXT PRIMARY KEY NOT NULL,visits INTEGER NOT NULL DEFAULT 0,last_visit_at_ms INTEGER,favorite_resource_type TEXT,favorite_game TEXT,avg_session_minutes INTEGER NOT NULL DEFAULT 0,total_spend_minor INTEGER NOT NULL DEFAULT 0,visits_per_30_days REAL NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS elo_ratings_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,game TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 1000,wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_elo_p4_game_rating ON elo_ratings_p4(game,rating DESC)");
        db.execSQL("CREATE TABLE IF NOT EXISTS match_records_p4 (id TEXT PRIMARY KEY NOT NULL,player_a TEXT NOT NULL,player_b TEXT NOT NULL,score_a REAL NOT NULL,score_b REAL NOT NULL,game TEXT NOT NULL,rating_a_after INTEGER,rating_b_after INTEGER,played_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS game_demand_p4 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,title TEXT NOT NULL,created_at_ms INTEGER NOT NULL,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_game_demand_p4_title ON game_demand_p4(title)");
        db.execSQL("CREATE TABLE IF NOT EXISTS media_proofs_p4 (id TEXT PRIMARY KEY NOT NULL,command_id TEXT,device_id TEXT,campaign_id TEXT,creative_id TEXT,played_at_ms INTEGER NOT NULL,proof_type TEXT NOT NULL,status TEXT NOT NULL,raw_json TEXT NOT NULL)");
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, long now) {
        upsertTokens(db, root.optJSONArray("playerAccessTokens"), now);
        upsertMemberships(db, root.optJSONArray("memberships"));
        upsertMissions(db, root.optJSONArray("missions"));
        upsertMissionProgress(db, root.optJSONArray("missionProgress"), now);
        upsertServices(db, root.optJSONArray("serviceRequests"), now);
        upsertReferrals(db, root.optJSONArray("referrals"), now);
        upsertDna(db, root.optJSONArray("playerDna"), now);
        upsertElo(db, root.optJSONArray("eloRatings"), now);
        upsertMatches(db, root.optJSONArray("matchRecords"), now);
        upsertDemand(db, root.optJSONArray("gameDemandVotes"), now);
        upsertProofs(db, root.optJSONArray("mediaPlayProofs"), now);
        String[] domains={"PLAYER_TOKENS","MEMBERSHIPS","MISSIONS","SERVICE_REQUESTS","REFERRALS","PLAYER_DNA","ELO","MATCH_RECORDS","GAME_DEMAND","MEDIA_PROOFS"};
        for(String domain:domains) markDomain(db,domain,revision,now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject o=new JSONObject();
        try {
            o.put("activePlayerTokenCountNormalized", scalar(db,"SELECT COUNT(*) FROM player_tokens_p4 WHERE UPPER(status)='ACTIVE'"));
            o.put("membershipCountNormalized", scalar(db,"SELECT COUNT(*) FROM memberships_p4"));
            o.put("missionCompletedCountNormalized", scalar(db,"SELECT COUNT(*) FROM mission_progress_p4 WHERE UPPER(status)='COMPLETED'"));
            o.put("openServiceRequestCountNormalized", scalar(db,"SELECT COUNT(*) FROM service_requests_p4 WHERE UPPER(status) NOT IN ('DONE','CANCELLED')"));
            o.put("playerDnaCountNormalized", scalar(db,"SELECT COUNT(*) FROM player_dna_p4"));
            o.put("matchCountNormalized", scalar(db,"SELECT COUNT(*) FROM match_records_p4"));
            o.put("gameDemandVoteCountNormalized", scalar(db,"SELECT COUNT(*) FROM game_demand_p4"));
            o.put("proofOfPlayCountNormalized", scalar(db,"SELECT COUNT(*) FROM media_proofs_p4 WHERE UPPER(status)='CONFIRMED'"));
            o.put("normalizedPlayerDomains",new JSONArray().put("PLAYER_TOKENS").put("MEMBERSHIPS").put("MISSIONS").put("SERVICE_REQUESTS").put("REFERRALS").put("PLAYER_DNA").put("ELO").put("MATCH_RECORDS").put("GAME_DEMAND").put("MEDIA_PROOFS"));
        } catch(Exception ignored) {}
        return o;
    }

    private static void upsertTokens(SQLiteDatabase db, JSONArray rows, long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",x.optString("customerId","unknown"));nullable(v,"session_id",x.optString("sessionId",""));v.put("token_hash",x.optString("tokenHash",""));v.put("status",x.optString("status","ACTIVE"));v.put("expires_at_ms",x.optLong("expiresAt",now));v.put("created_at_ms",x.optLong("createdAt",now));nullableTime(v,"used_at_ms",x.opt("usedAt"));v.put("raw_json",x.toString());db.insertWithOnConflict("player_tokens_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertMemberships(SQLiteDatabase db, JSONArray rows){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",x.optString("customerId","unknown"));nullable(v,"membership_type",x.optString("type",""));v.put("status",x.optString("status","ACTIVE"));nullableTime(v,"starts_at_ms",x.opt("startsAt"));nullableTime(v,"expires_at_ms",x.opt("expiresAt"));v.put("benefits_json",jsonText(x.opt("benefits"),"{}"));v.put("raw_json",x.toString());db.insertWithOnConflict("memberships_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertMissions(SQLiteDatabase db, JSONArray rows){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("name",x.optString("name",id));v.put("mission_type",x.optString("type",x.optString("metric","UNKNOWN")));v.put("target_json",jsonText(x.opt("target"),"null"));v.put("reward_points",x.optInt("rewardPoints",0));v.put("enabled",x.optBoolean("enabled",true)?1:0);v.put("raw_json",x.toString());db.insertWithOnConflict("missions_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertMissionProgress(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",x.optString("customerId","unknown"));v.put("mission_id",x.optString("missionId","unknown"));v.put("status",x.optString("status","ACTIVE"));v.put("progress",x.optDouble("progress",0));v.put("reward_claimed",x.optBoolean("rewardClaimed",false)?1:0);v.put("updated_at_ms",x.optLong("updatedAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("mission_progress_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertServices(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);nullable(v,"customer_id",x.optString("customerId",""));nullable(v,"session_id",x.optString("sessionId",""));nullable(v,"resource_id",x.optString("resourceId",""));v.put("request_type",x.optString("type","ASSISTANCE"));v.put("status",x.optString("status","NEW"));v.put("priority",x.optString("priority","NORMAL"));nullable(v,"note",x.optString("note",x.optString("detail","")));v.put("created_at_ms",x.optLong("createdAt",now));nullableTime(v,"ack_at_ms",x.opt("ackAt"));nullableTime(v,"done_at_ms",x.opt("doneAt"));v.put("raw_json",x.toString());db.insertWithOnConflict("service_requests_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertReferrals(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("referrer_customer_id",x.optString("referrerCustomerId","unknown"));v.put("code",x.optString("code",id));v.put("status",x.optString("status","ACTIVE"));v.put("uses",x.optInt("uses",0));v.put("reward_points",x.optInt("rewardPoints",0));v.put("created_at_ms",x.optLong("createdAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("referrals_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertDna(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("customerId","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("customer_id",id);v.put("visits",x.optInt("visits",0));nullableTime(v,"last_visit_at_ms",x.opt("lastVisitAt"));nullable(v,"favorite_resource_type",x.optString("favoriteResourceType",""));nullable(v,"favorite_game",x.optString("favoriteGame",""));v.put("avg_session_minutes",x.optInt("avgSessionMinutes",0));v.put("total_spend_minor",money(x.optDouble("totalSpend",0)));v.put("visits_per_30_days",x.optDouble("visitsPer30Days",0));v.put("updated_at_ms",x.optLong("updatedAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("player_dna_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertElo(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",x.optString("customerId","unknown"));v.put("game",x.optString("game","GENERAL"));v.put("rating",x.optInt("rating",1000));v.put("wins",x.optInt("wins",0));v.put("losses",x.optInt("losses",0));v.put("draws",x.optInt("draws",0));v.put("updated_at_ms",x.optLong("updatedAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("elo_ratings_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertMatches(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("player_a",x.optString("playerA","unknown"));v.put("player_b",x.optString("playerB","unknown"));v.put("score_a",x.optDouble("scoreA",0));v.put("score_b",x.optDouble("scoreB",0));v.put("game",x.optString("game","GENERAL"));v.put("rating_a_after",x.optInt("ratingAAfter",1000));v.put("rating_b_after",x.optInt("ratingBAfter",1000));v.put("played_at_ms",x.optLong("playedAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("match_records_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertDemand(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",x.optString("customerId","unknown"));v.put("title",x.optString("title","Unknown"));v.put("created_at_ms",x.optLong("createdAt",now));v.put("updated_at_ms",x.optLong("updatedAt",now));v.put("raw_json",x.toString());db.insertWithOnConflict("game_demand_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertProofs(SQLiteDatabase db, JSONArray rows,long now){
        if(rows==null)return;
        for(int i=0;i<rows.length();i++){JSONObject x=rows.optJSONObject(i);if(x==null)continue;String id=x.optString("id","");if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);nullable(v,"command_id",x.optString("commandId",""));nullable(v,"device_id",x.optString("deviceId",""));nullable(v,"campaign_id",x.optString("campaignId",""));nullable(v,"creative_id",x.optString("creativeId",""));v.put("played_at_ms",x.optLong("playedAt",now));v.put("proof_type",x.optString("proofType","DEVICE_ACK"));v.put("status",x.optString("status","CONFIRMED"));v.put("raw_json",x.toString());db.insertWithOnConflict("media_proofs_p4",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }

    private static void markDomain(SQLiteDatabase db,String domain,long revision,long now){ContentValues v=new ContentValues();v.put("domain",domain);v.put("authority","SQLITE_DUAL_WRITE");v.put("migration_state","PARITY_PROVING");v.put("source_revision",revision);v.put("updated_at_ms",now);db.insertWithOnConflict("domain_authority",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static long scalar(SQLiteDatabase db,String sql){try(Cursor c=db.rawQuery(sql,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static long money(double amount){return Math.round(amount*100D);}
    private static void nullable(ContentValues v,String key,String value){if(value==null||value.trim().isEmpty())v.putNull(key);else v.put(key,value.trim());}
    private static void nullableTime(ContentValues v,String key,Object value){long t=time(value);if(t<=0)v.putNull(key);else v.put(key,t);}
    private static long time(Object value){if(value==null||value==JSONObject.NULL)return 0L;if(value instanceof Number)return ((Number)value).longValue();String s=String.valueOf(value).trim();if(s.isEmpty())return 0L;try{return Long.parseLong(s);}catch(Exception ignored){}try{return java.time.Instant.parse(s).toEpochMilli();}catch(Exception ignored){}return 0L;}
    private static String jsonText(Object value,String fallback){if(value==null||value==JSONObject.NULL)return fallback;if(value instanceof JSONObject||value instanceof JSONArray)return value.toString();if(value instanceof Number||value instanceof Boolean)return String.valueOf(value);return String.valueOf(value);}
}
