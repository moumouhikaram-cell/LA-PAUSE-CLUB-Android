package com.lapauseclub.manager.a1.data;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class BackupManager {
    private final AppDatabase helper;
    private final File backupDir;

    public BackupManager(AppDatabase helper, File filesDir) {
        this.helper = helper;
        this.backupDir = new File(filesDir, "verified-backups");
    }

    public synchronized JSONObject createJsonBackup() throws Exception {
        if (!backupDir.exists() && !backupDir.mkdirs()) {
            throw new IllegalStateException("Cannot create backup directory");
        }

        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject root = new JSONObject();
        root.put("schemaVersion", 1);
        root.put("createdAtMs", System.currentTimeMillis());
        root.put("venues", dump(db, "venues"));
        root.put("resources", dump(db, "resources"));
        root.put("sessions", dump(db, "sessions"));
        root.put("payments", dump(db, "payments"));
        root.put("domainEvents", dump(db, "domain_events"));
        root.put("outboxEvents", dump(db, "outbox_events"));
        root.put("authorityLeases", dump(db, "authority_leases"));

        String payload = root.toString();
        String checksum = sha256(payload);

        JSONObject envelope = new JSONObject();
        envelope.put("format", "LA_PAUSE_A1_JSON_BACKUP");
        envelope.put("checksumAlgorithm", "SHA-256");
        envelope.put("checksum", checksum);
        envelope.put("payload", root);

        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
        File out = new File(backupDir, "la-pause-a1-" + stamp + ".json");
        try (FileOutputStream stream = new FileOutputStream(out)) {
            stream.write(envelope.toString(2).getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        }
        rotate(7);
        return new JSONObject().put("path", out.getAbsolutePath()).put("checksum", checksum)
                .put("verified", verify(out));
    }

    private JSONArray dump(SQLiteDatabase db, String table) throws JSONException {
        JSONArray rows = new JSONArray();
        try (Cursor c = db.rawQuery("SELECT * FROM " + table, null)) {
            String[] columns = c.getColumnNames();
            while (c.moveToNext()) {
                JSONObject row = new JSONObject();
                for (int i = 0; i < columns.length; i++) {
                    if (c.isNull(i)) row.put(columns[i], JSONObject.NULL);
                    else if (c.getType(i) == Cursor.FIELD_TYPE_INTEGER) row.put(columns[i], c.getLong(i));
                    else if (c.getType(i) == Cursor.FIELD_TYPE_FLOAT) row.put(columns[i], c.getDouble(i));
                    else row.put(columns[i], c.getString(i));
                }
                rows.put(row);
            }
        }
        return rows;
    }

    private boolean verify(File file) throws Exception {
        String raw = new String(java.nio.file.Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        JSONObject envelope = new JSONObject(raw);
        return envelope.getString("checksum")
                .equalsIgnoreCase(sha256(envelope.getJSONObject("payload").toString()));
    }

    private void rotate(int keep) {
        File[] files = backupDir.listFiles((dir, name) -> name.endsWith(".json"));
        if (files == null || files.length <= keep) return;
        java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        for (int i = keep; i < files.length; i++) files[i].delete();
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format(Locale.US, "%02x", b));
        return out.toString();
    }
}
