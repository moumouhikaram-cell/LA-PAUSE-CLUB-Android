package com.lapauseclub.manager;

import android.webkit.JavascriptInterface;

import com.lapauseclub.manager.core.CoreStore;
import com.lapauseclub.manager.core.CoreSyncTransportV12;

import org.json.JSONArray;
import org.json.JSONObject;

/** Narrow WebView bridge for canonical sync transport bookkeeping. */
public final class SyncBridgeV12 {
    private final CoreStore coreStore;

    public SyncBridgeV12(CoreStore coreStore) {
        this.coreStore = coreStore;
    }

    @JavascriptInterface
    public String getPendingBatchJson(String tenantId, String venueId, String branchId, int limit) {
        if (coreStore == null) return error("NO_DURABLE_STORAGE", "Core unavailable");
        try {
            return CoreSyncTransportV12.pendingBatch(coreStore.getReadableDatabase(), tenantId, venueId, branchId, limit, System.currentTimeMillis()).toString();
        } catch (Exception ex) {
            return error("SYNC_BATCH_ERROR", message(ex));
        }
    }

    @JavascriptInterface
    public String acknowledgeEventsJson(String tenantId, String venueId, String branchId, String eventIdsJson) {
        if (coreStore == null) return error("NO_DURABLE_STORAGE", "Core unavailable");
        try {
            JSONArray ids = new JSONArray(eventIdsJson == null ? "[]" : eventIdsJson);
            int acknowledged = CoreSyncTransportV12.acknowledge(coreStore.getWritableDatabase(), tenantId, venueId, branchId, ids, System.currentTimeMillis());
            JSONObject out = new JSONObject();
            out.put("ok", true);
            out.put("protocolVersion", CoreSyncTransportV12.PROTOCOL_VERSION);
            out.put("acknowledged", acknowledged);
            return out.toString();
        } catch (Exception ex) {
            return error("SYNC_ACK_ERROR", message(ex));
        }
    }

    @JavascriptInterface
    public String markEventsFailedJson(String tenantId, String venueId, String branchId, String eventIdsJson, String failure) {
        if (coreStore == null) return error("NO_DURABLE_STORAGE", "Core unavailable");
        try {
            JSONArray ids = new JSONArray(eventIdsJson == null ? "[]" : eventIdsJson);
            int marked = CoreSyncTransportV12.markFailed(coreStore.getWritableDatabase(), tenantId, venueId, branchId, ids, failure, System.currentTimeMillis());
            JSONObject out = new JSONObject();
            out.put("ok", true);
            out.put("protocolVersion", CoreSyncTransportV12.PROTOCOL_VERSION);
            out.put("markedFailed", marked);
            return out.toString();
        } catch (Exception ex) {
            return error("SYNC_FAILURE_MARK_ERROR", message(ex));
        }
    }

    private static String error(String code, String message) {
        JSONObject out = new JSONObject();
        try {
            out.put("ok", false);
            out.put("code", code);
            out.put("message", message == null ? code : message);
        } catch (Exception ignored) {}
        return out.toString();
    }

    private static String message(Exception ex) {
        return ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
    }
}
