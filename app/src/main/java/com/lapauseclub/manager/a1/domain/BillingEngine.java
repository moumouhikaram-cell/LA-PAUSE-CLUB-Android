package com.lapauseclub.manager.a1.domain;

public final class BillingEngine {
    private BillingEngine() {}

    public static long calculateAmountMinor(
            long durationSeconds,
            long ratePerHourMinor,
            int billingIncrementMinutes,
            int minimumChargeMinutes
    ) {
        long safeSeconds = Math.max(0L, durationSeconds);
        long incrementSeconds = Math.max(1, billingIncrementMinutes) * 60L;
        long minimumSeconds = Math.max(1, minimumChargeMinutes) * 60L;
        long chargeableSeconds = Math.max(safeSeconds, minimumSeconds);
        long increments = (chargeableSeconds + incrementSeconds - 1L) / incrementSeconds;
        long billedSeconds = increments * incrementSeconds;
        return (billedSeconds * ratePerHourMinor + 3599L) / 3600L;
    }
}
