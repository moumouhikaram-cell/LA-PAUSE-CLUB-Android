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

    @Test
    public void billiardExactMinuteRoundsOnlyToNextMinute() {
        assertEquals(300L, BillingEngine.calculateAmountMinor(301L, 3000L, 1, 1));
    }

    @Test
    public void fifteenMinuteBlockRoundsFiveMinutesToFifteen() {
        assertEquals(750L, BillingEngine.calculateAmountMinor(300L, 3000L, 15, 15));
    }
}
