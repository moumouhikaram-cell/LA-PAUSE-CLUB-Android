package com.lapauseclub.manager.core;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

final class CoreBusinessSchemaP1 {
    private CoreBusinessSchemaP1() {}

    static void create(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS customers_p1 (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,first_name TEXT,last_name TEXT,phone TEXT,email TEXT,status TEXT NOT NULL,profile_type TEXT,points INTEGER NOT NULL DEFAULT 0,tier TEXT,member_number TEXT,consent_marketing INTEGER NOT NULL DEFAULT 0,media_consent_json TEXT,note TEXT,created_at_ms INTEGER,updated_at_ms INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_customers_p1_phone ON customers_p1(phone)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_customers_p1_status ON customers_p1(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS products_p1 (id TEXT PRIMARY KEY NOT NULL,sku TEXT,name TEXT NOT NULL,category TEXT,price_minor INTEGER NOT NULL DEFAULT 0,cost_minor INTEGER NOT NULL DEFAULT 0,stock_qty REAL NOT NULL DEFAULT 0,threshold_qty REAL NOT NULL DEFAULT 0,supplier TEXT,active INTEGER NOT NULL DEFAULT 1,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_products_p1_active ON products_p1(active)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_products_p1_sku ON products_p1(sku)");
        db.execSQL("CREATE TABLE IF NOT EXISTS orders_p1 (id TEXT PRIMARY KEY NOT NULL,resource_id TEXT,session_id TEXT,customer_id TEXT,status TEXT NOT NULL,total_minor INTEGER NOT NULL DEFAULT 0,items_json TEXT NOT NULL,created_at_ms INTEGER NOT NULL,paid_at_ms INTEGER,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_orders_p1_status ON orders_p1(status)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_orders_p1_resource ON orders_p1(resource_id)");
        db.execSQL("CREATE TABLE IF NOT EXISTS bookings_p1 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT,customer_name TEXT,phone TEXT,resource_ids_json TEXT NOT NULL,resource_kind TEXT,party_size INTEGER NOT NULL DEFAULT 1,start_at_ms INTEGER NOT NULL,end_at_ms INTEGER NOT NULL,status TEXT NOT NULL,channel TEXT,price_minor INTEGER NOT NULL DEFAULT 0,paid_minor INTEGER NOT NULL DEFAULT 0,refunded_minor INTEGER NOT NULL DEFAULT 0,payment_method TEXT,notes TEXT,created_at_ms INTEGER,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_bookings_p1_time ON bookings_p1(start_at_ms,end_at_ms)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_bookings_p1_status ON bookings_p1(status)");
        db.execSQL("CREATE TABLE IF NOT EXISTS queue_entries_p1 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT,name TEXT,phone TEXT,preference TEXT,status TEXT NOT NULL,party_size INTEGER NOT NULL DEFAULT 1,resource_id TEXT,created_at_ms INTEGER NOT NULL,called_at_ms INTEGER,seated_at_ms INTEGER,left_at_ms INTEGER,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_queue_p1_status_created ON queue_entries_p1(status,created_at_ms)");
        db.execSQL("CREATE TABLE IF NOT EXISTS passes_p1 (id TEXT PRIMARY KEY NOT NULL,customer_id TEXT NOT NULL,pass_type TEXT NOT NULL,resource_kind TEXT,status TEXT NOT NULL,balance_minutes REAL NOT NULL DEFAULT 0,balance_visits REAL NOT NULL DEFAULT 0,expires_at_ms INTEGER,price_minor INTEGER NOT NULL DEFAULT 0,created_at_ms INTEGER,updated_at_ms INTEGER NOT NULL,raw_json TEXT NOT NULL)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_passes_p1_customer_status ON passes_p1(customer_id,status)");
    }

    static void dualWrite(SQLiteDatabase db, JSONObject root, long revision, long now) {
        upsertCustomers(db, root.optJSONArray("clients"), now);
        upsertProducts(db, root.optJSONArray("products"), now);
        upsertOrders(db, root.optJSONArray("orders"), now);
        JSONArray bookings = root.optJSONArray("bookings"); if (bookings == null || bookings.length() == 0) bookings = root.optJSONArray("reservations");
        upsertBookings(db, bookings, now); upsertQueue(db, root.optJSONArray("queue"), now); upsertPasses(db, root.optJSONArray("prepaidPasses"), now);
        for (String domain : new String[]{"CUSTOMERS","PRODUCTS","ORDERS","BOOKINGS","QUEUE","PASSES"}) markDomain(db, domain, revision, now);
    }

    static JSONObject status(SQLiteDatabase db) {
        JSONObject out = new JSONObject();
        try {
            out.put("customerCountNormalized", scalar(db, "SELECT COUNT(*) FROM customers_p1"));
            out.put("productCountNormalized", scalar(db, "SELECT COUNT(*) FROM products_p1"));
            out.put("orderCountNormalized", scalar(db, "SELECT COUNT(*) FROM orders_p1"));
            out.put("bookingCountNormalized", scalar(db, "SELECT COUNT(*) FROM bookings_p1"));
            out.put("queueWaitingNormalized", scalar(db, "SELECT COUNT(*) FROM queue_entries_p1 WHERE UPPER(status) IN ('WAITING','CALLED')"));
            out.put("passActiveNormalized", scalar(db, "SELECT COUNT(*) FROM passes_p1 WHERE UPPER(status)='ACTIVE'"));
            out.put("normalizedBusinessDomains", new JSONArray().put("CUSTOMERS").put("PRODUCTS").put("ORDERS").put("BOOKINGS").put("QUEUE").put("PASSES"));
        } catch (Exception ignored) {}
        return out;
    }

    private static void upsertCustomers(SQLiteDatabase db, JSONArray rows, long now) {
        if (rows == null) return; for (int i=0;i<rows.length();i++) {JSONObject c=rows.optJSONObject(i); if(c==null)continue; String id=c.optString("id","").trim(); if(id.isEmpty())continue; ContentValues v=new ContentValues(); v.put("id",id); v.put("name",nonBlank(c.optString("name"),id)); putNullable(v,"first_name",c.optString("firstName","")); putNullable(v,"last_name",c.optString("lastName","")); putNullable(v,"phone",c.optString("phone","")); putNullable(v,"email",c.optString("email","")); v.put("status",nonBlank(c.optString("status"),"ACTIVE")); putNullable(v,"profile_type",c.optString("profileType","")); v.put("points",c.optLong("points",0)); putNullable(v,"tier",c.optString("tier","")); putNullable(v,"member_number",c.optString("memberNumber","")); v.put("consent_marketing",c.optBoolean("consentMarketing",false)?1:0); Object mc=c.opt("mediaConsent"); if(mc==null||mc==JSONObject.NULL)v.putNull("media_consent_json");else v.put("media_consent_json",String.valueOf(mc)); putNullable(v,"note",c.optString("note","")); putNullableTime(v,"created_at_ms",c.opt("createdAt")); v.put("updated_at_ms",time(c.opt("updatedAt"),now)); db.insertWithOnConflict("customers_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertProducts(SQLiteDatabase db, JSONArray rows, long now) {
        if(rows==null)return; for(int i=0;i<rows.length();i++){JSONObject p=rows.optJSONObject(i);if(p==null)continue;String id=p.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);putNullable(v,"sku",p.optString("sku",""));v.put("name",nonBlank(p.optString("name"),id));putNullable(v,"category",p.optString("category",""));v.put("price_minor",moneyFromCentsOrDh(p,"priceCents","price"));v.put("cost_minor",moneyFromCentsOrDh(p,"costCents","cost"));v.put("stock_qty",p.optDouble("stock",0D));v.put("threshold_qty",p.has("threshold")?p.optDouble("threshold",0D):p.optDouble("alertStock",0D));putNullable(v,"supplier",p.optString("supplier",""));boolean active=p.has("active")?p.optBoolean("active",true):p.optBoolean("enabled",true);v.put("active",active?1:0);v.put("updated_at_ms",time(p.opt("updatedAt"),now));v.put("raw_json",p.toString());db.insertWithOnConflict("products_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertOrders(SQLiteDatabase db, JSONArray rows, long now) {
        if(rows==null)return; for(int i=0;i<rows.length();i++){JSONObject o=rows.optJSONObject(i);if(o==null)continue;String id=o.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);putNullable(v,"resource_id",nonBlank(o.optString("resourceId"),o.optString("stationId")));putNullable(v,"session_id",o.optString("sessionId",""));putNullable(v,"customer_id",o.optString("customerId",""));v.put("status",nonBlank(o.optString("status"),"open"));v.put("total_minor",moneyFromCentsOrDh(o,"totalCents","total"));Object items=o.opt("items");v.put("items_json",items==null||items==JSONObject.NULL?"[]":String.valueOf(items));v.put("created_at_ms",time(o.opt("createdAt"),now));putNullableTime(v,"paid_at_ms",o.opt("paidAt"));v.put("updated_at_ms",time(o.opt("updatedAt"),now));v.put("raw_json",o.toString());db.insertWithOnConflict("orders_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertBookings(SQLiteDatabase db, JSONArray rows, long now) {
        if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject b=rows.optJSONObject(i);if(b==null)continue;String id=b.optString("id","").trim();if(id.isEmpty())continue;long start=time(first(b,"startAt","startsAt"),0L);if(start<=0)continue;long end=time(first(b,"endAt","endsAt"),0L);if(end<=start)end=start+Math.max(1,b.optLong("durationMinutes",60))*60000L;ContentValues v=new ContentValues();v.put("id",id);putNullable(v,"customer_id",b.optString("customerId",""));putNullable(v,"customer_name",nonBlank(b.optString("customerName"),b.optString("name")));putNullable(v,"phone",b.optString("phone",""));Object stationIds=b.opt("stationIds");if(stationIds==null||stationIds==JSONObject.NULL){String stationId=b.optString("stationId","");v.put("resource_ids_json",stationId.isEmpty()?"[]":new JSONArray().put(stationId).toString());}else v.put("resource_ids_json",String.valueOf(stationIds));putNullable(v,"resource_kind",nonBlank(b.optString("resourceKind"),b.optString("stationKind")));v.put("party_size",Math.max(1,b.optInt("partySize",1)));v.put("start_at_ms",start);v.put("end_at_ms",end);v.put("status",nonBlank(b.optString("status"),"CONFIRMED"));putNullable(v,"channel",b.optString("channel",""));v.put("price_minor",moneyFromCentsOrDh(b,"priceCents","amount"));v.put("paid_minor",moneyFromCentsOrDh(b,"paidCents","paidAmount"));v.put("refunded_minor",b.optLong("refundedCents",0L));putNullable(v,"payment_method",b.optString("paymentMethod",""));putNullable(v,"notes",nonBlank(b.optString("notes"),b.optString("note")));putNullableTime(v,"created_at_ms",b.opt("createdAt"));v.put("updated_at_ms",time(b.opt("updatedAt"),now));v.put("raw_json",b.toString());db.insertWithOnConflict("bookings_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertQueue(SQLiteDatabase db, JSONArray rows, long now) {
        if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject q=rows.optJSONObject(i);if(q==null)continue;String id=q.optString("id","").trim();if(id.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);putNullable(v,"customer_id",q.optString("customerId",""));putNullable(v,"name",q.optString("name",""));putNullable(v,"phone",q.optString("phone",""));putNullable(v,"preference",q.optString("preference",""));v.put("status",nonBlank(q.optString("status"),"WAITING").toUpperCase());v.put("party_size",Math.max(1,q.optInt("partySize",1)));putNullable(v,"resource_id",nonBlank(q.optString("resourceId"),q.optString("stationId")));v.put("created_at_ms",time(q.opt("createdAt"),now));putNullableTime(v,"called_at_ms",q.opt("calledAt"));putNullableTime(v,"seated_at_ms",q.opt("seatedAt"));putNullableTime(v,"left_at_ms",q.opt("leftAt"));v.put("raw_json",q.toString());db.insertWithOnConflict("queue_entries_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void upsertPasses(SQLiteDatabase db, JSONArray rows, long now) {
        if(rows==null)return;for(int i=0;i<rows.length();i++){JSONObject p=rows.optJSONObject(i);if(p==null)continue;String id=p.optString("id","").trim();String customerId=p.optString("customerId","").trim();if(id.isEmpty()||customerId.isEmpty())continue;ContentValues v=new ContentValues();v.put("id",id);v.put("customer_id",customerId);v.put("pass_type",nonBlank(p.optString("type"),"TIME_WALLET"));putNullable(v,"resource_kind",nonBlank(p.optString("resourceKind"),p.optString("stationKind")));v.put("status",nonBlank(p.optString("status"),"ACTIVE"));v.put("balance_minutes",p.optDouble("balanceMinutes",p.optDouble("minutes",0D)));v.put("balance_visits",p.optDouble("balanceVisits",p.optDouble("visits",0D)));putNullableTime(v,"expires_at_ms",p.opt("expiresAt"));v.put("price_minor",moneyFromCentsOrDh(p,"priceCents","price"));putNullableTime(v,"created_at_ms",p.opt("createdAt"));v.put("updated_at_ms",time(p.opt("updatedAt"),now));v.put("raw_json",p.toString());db.insertWithOnConflict("passes_p1",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    }
    private static void markDomain(SQLiteDatabase db,String domain,long revision,long now){ContentValues v=new ContentValues();v.put("domain",domain);v.put("authority","SQLITE_DUAL_WRITE");v.put("migration_state","PARITY_PROVING");v.put("source_revision",revision);v.put("updated_at_ms",now);db.insertWithOnConflict("domain_authority",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    private static long scalar(SQLiteDatabase db,String sql){try(Cursor c=db.rawQuery(sql,null)){return c.moveToFirst()?c.getLong(0):0L;}}
    private static String nonBlank(String value,String fallback){return value==null||value.trim().isEmpty()?fallback:value.trim();}
    private static void putNullable(ContentValues v,String col,String value){if(value==null||value.trim().isEmpty())v.putNull(col);else v.put(col,value.trim());}
    private static void putNullableTime(ContentValues v,String col,Object value){long t=time(value,0L);if(t<=0)v.putNull(col);else v.put(col,t);}
    private static Object first(JSONObject o,String a,String b){Object x=o.opt(a);return x==null||x==JSONObject.NULL?o.opt(b):x;}
    private static long time(Object value,long fallback){if(value==null||value==JSONObject.NULL)return fallback;if(value instanceof Number)return ((Number)value).longValue();String s=String.valueOf(value).trim();if(s.isEmpty())return fallback;try{return Long.parseLong(s);}catch(Exception ignored){}try{return java.time.Instant.parse(s).toEpochMilli();}catch(Exception ignored){}return fallback;}
    private static long moneyFromCentsOrDh(JSONObject o,String centsKey,String dhKey){if(o.has(centsKey)&&!o.isNull(centsKey))return o.optLong(centsKey,0L);return Math.round(o.optDouble(dhKey,0D)*100D);}
}
