package com.lapauseclub.manager.a1.core;

import org.json.JSONException;
import org.json.JSONObject;

public final class ResourceCapabilities {
    public final boolean meteredTime;
    public final boolean hasDisplay;
    public final boolean hasController;
    public final boolean supportsOverlay;
    public final boolean supportsRemoteControl;
    public final int maxPlayers;

    public ResourceCapabilities(
            boolean meteredTime,
            boolean hasDisplay,
            boolean hasController,
            boolean supportsOverlay,
            boolean supportsRemoteControl,
            int maxPlayers
    ) {
        this.meteredTime = meteredTime;
        this.hasDisplay = hasDisplay;
        this.hasController = hasController;
        this.supportsOverlay = supportsOverlay;
        this.supportsRemoteControl = supportsRemoteControl;
        this.maxPlayers = Math.max(1, maxPlayers);
    }

    public JSONObject toJson() throws JSONException {
        JSONObject out = new JSONObject();
        out.put("meteredTime", meteredTime);
        out.put("hasDisplay", hasDisplay);
        out.put("hasController", hasController);
        out.put("supportsOverlay", supportsOverlay);
        out.put("supportsRemoteControl", supportsRemoteControl);
        out.put("maxPlayers", maxPlayers);
        return out;
    }

    public static ResourceCapabilities defaultsFor(ResourceType type) {
        switch (type) {
            case CONSOLE:
                return new ResourceCapabilities(true, true, true, true, true, 2);
            case BILLIARD_TABLE:
            case SNOOKER_TABLE:
                return new ResourceCapabilities(true, false, false, false, false, 4);
            case SIM_RACING:
                return new ResourceCapabilities(true, true, true, true, true, 1);
            case PC_GAMING:
                return new ResourceCapabilities(true, true, false, true, true, 1);
            case TABLE_TENNIS:
                return new ResourceCapabilities(true, false, false, false, false, 4);
            case PRIVATE_ROOM:
                return new ResourceCapabilities(true, false, false, false, false, 12);
            default:
                return new ResourceCapabilities(true, false, false, false, false, 2);
        }
    }
}
