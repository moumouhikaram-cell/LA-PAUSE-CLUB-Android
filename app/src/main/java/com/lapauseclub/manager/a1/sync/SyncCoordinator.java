package com.lapauseclub.manager.a1.sync;

public final class SyncCoordinator {
    public enum State {
        DISABLED,
        DISCOVERING,
        CONNECTED_LOCAL,
        CONNECTED_CLOUD,
        LINK_LOST,
        RECONCILING
    }

    private State state = State.DISABLED;

    public synchronized State getState() { return state; }

    public synchronized void setState(State next) {
        if (next == null) throw new IllegalArgumentException("next state is required");
        state = next;
    }

    public synchronized boolean isRequiredForLocalOperation() { return false; }
}
