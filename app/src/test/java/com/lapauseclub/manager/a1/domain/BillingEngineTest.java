package com.lapauseclub.manager.a1.domain;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public final class BillingEngineTest {
    @Test
    public void minimumOneMinuteAtThirtyMadPerHourIsFiftyCentimes() {
        assertEquals(50L, BillingEngine.calculateAmountMinor(5L, 3000L, 1, 1));
    }

    @Test
    public void roundsUpToBillingIncrement() {
        // 5m01s at 30 MAD/h, 5-minute increments => 10 minutes => 5 MAD.
        assertEquals(500L, BillingEngine.calculateAmountMinor(301L, 3000L, 5, 1));
    }

    @Test
    public void exactHourKeepsExactHourlyRate() {
        assertEquals(2200L, BillingEngine.calculateAmountMinor(3600L, 2200L, 1, 1));
    }

    @Test
    public void minimumChargeCanExceedElapsedDuration() {
        assertEquals(750L, BillingEngine.calculateAmountMinor(60L, 3000L, 1, 15));
    }
}
