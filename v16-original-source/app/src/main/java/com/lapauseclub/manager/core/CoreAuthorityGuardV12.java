package com.lapauseclub.manager.core;

import com.lapauseclub.manager.BuildConfig;
import com.lapauseclub.manager.security.EntitlementVerifier;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Native authority gate for SaaS mutations.
 *
 * The browser/UI may hide or disable unavailable actions, but it is never the
 * authority. Business commands are mapped to their paid module and permission
 * here, then checked against a cryptographically verified entitlement and the
 * actor membership from the last committed state.
 */
final class CoreAuthorityGuardV12 {
    private static final Set<String> ACTIVE_LICENSE_STATUSES = new HashSet<>(Arrays.asList(
            "ACTIVE", "TRIAL", "PAST_DUE_GRACE"
    ));

    private static final Map<String, String[]> ROLE_PERMISSIONS = new HashMap<>();
    static {
        ROLE_PERMISSIONS.put("PLATFORM_ADMIN", new String[]{"*"});
        ROLE_PERMISSIONS.put("OWNER", new String[]{"*"});
        ROLE_PERMISSIONS.put("TENANT_ADMIN", new String[]{"*"});
        ROLE_PERMISSIONS.put("VENUE_MANAGER", new String[]{
                "session.*", "resource.*", "pricing.read", "pricing.write",
                "payment.read", "payment.capture", "cash.*", "customer.*",
                "inventory.*", "booking.*", "queue.*", "tournament.*",
                "device.read", "device.control", "report.read", "staff.read"
        });
        ROLE_PERMISSIONS.put("CASHIER", new String[]{
                "session.read", "payment.read", "payment.capture", "payment.refund",
                "cash.open", "cash.close", "cash.read", "cash.adjust", "order.*",
                "product.read", "customer.read", "customer.write", "booking.read", "report.read"
        });
        ROLE_PERMISSIONS.put("FLOOR_STAFF", new String[]{
                "session.read", "session.start", "session.finish", "session.extend",
                "session.pause", "session.resume", "resource.read", "customer.read",
                "customer.write", "queue.*", "booking.read", "booking.write",
                "order.create", "product.read", "device.read"
        });
        ROLE_PERMISSIONS.put("ACCOUNTANT", new String[]{
                "payment.read", "cash.read", "finance.*", "report.read", "report.export"
        });
        ROLE_PERMISSIONS.put("MARKETING", new String[]{
                "customer.read", "customer.segment", "campaign.*", "offer.*", "report.marketing"
        });
        ROLE_PERMISSIONS.put("TECHNICIAN", new String[]{
                "resource.read", "device.*", "report.reliability"
        });
        ROLE_PERMISSIONS.put("VIEWER", new String[]{"*.read", "report.read"});
        ROLE_PERMISSIONS.put("PLAYER_MEMBER", new String[]{
                "player.self.*", "booking.self.*", "tournament.self.*"
        });
        ROLE_PERMISSIONS.put("GUEST", new String[]{
                "booking.public.create", "tournament.public.read"
        });
    }

    private CoreAuthorityGuardV12() {}

    static Decision authorize(JSONObject cmd, JSONObject previousState, long now) {
        if (BuildConfig.DEBUG) return Decision.allow("DEBUG_ALL", "DEBUG_BUILD", "*", "*");

        final String type = upper(cmd.optString("type", cmd.optString("commandType", "")));
        final String tenant = text(cmd, "tenantId");
        final String venue = text(cmd, "venueId");
        final String branch = text(cmd, "branchId");
        final String actor = text(cmd, "actorId");
        final String device = text(cmd, "originDeviceId");
        if (type.isEmpty() || tenant.isEmpty() || venue.isEmpty() || branch.isEmpty() || actor.isEmpty() || device.isEmpty()) {
            return Decision.deny("AUTH_CONTEXT_INVALID", "Authority context is incomplete", "", "");
        }

        Policy policy = policyFor(type);
        String declaredModule = text(cmd, "moduleId");
        String declaredPermission = text(cmd, "requiredPermission");
        if (!policy.known && declaredModule.isEmpty()) {
            return Decision.deny("AUTH_POLICY_UNKNOWN", "Unknown command requires moduleId", "", declaredPermission);
        }
        if (!policy.known && declaredPermission.isEmpty()) {
            return Decision.deny("AUTH_POLICY_UNKNOWN", "Unknown command requires requiredPermission", declaredModule, "");
        }
        String moduleId = policy.known ? policy.moduleId : declaredModule;
        String permission = policy.known ? policy.permission : declaredPermission;
        if (!declaredModule.isEmpty() && !declaredModule.equals(moduleId)) {
            return Decision.deny("AUTH_CONTRACT_MISMATCH", "moduleId does not match native command policy", moduleId, permission);
        }
        if (!declaredPermission.isEmpty() && !declaredPermission.equals(permission)) {
            return Decision.deny("AUTH_CONTRACT_MISMATCH", "requiredPermission does not match native command policy", moduleId, permission);
        }

        JSONObject entitlement = previousState == null ? null : previousState.optJSONObject("entitlement");
        if (entitlement == null) {
            return Decision.deny("ENTITLEMENT_MISSING", "Signed entitlement required", moduleId, permission);
        }
        final JSONObject verification;
        try {
            verification = new JSONObject(EntitlementVerifier.verify(entitlement.toString()));
        } catch (Exception ex) {
            return Decision.deny("ENTITLEMENT_VERIFY_ERROR", "Entitlement verification failed", moduleId, permission);
        }
        if (!verification.optBoolean("valid", false)) {
            return Decision.deny("ENTITLEMENT_INVALID", verification.optString("code", "SIGNATURE_INVALID"), moduleId, permission);
        }

        String status = upper(entitlement.optString("status", ""));
        if (!ACTIVE_LICENSE_STATUSES.contains(status)) {
            return Decision.deny("ENTITLEMENT_INACTIVE", "Entitlement status is " + status, moduleId, permission);
        }
        if (!tenant.equals(text(entitlement, "tenantId"))) {
            return Decision.deny("ENTITLEMENT_SCOPE_MISMATCH", "Tenant is not entitled", moduleId, permission);
        }
        if (!scopeArrayAllows(entitlement.optJSONArray("venueIds"), venue)) {
            return Decision.deny("ENTITLEMENT_SCOPE_MISMATCH", "Venue is not entitled", moduleId, permission);
        }
        if (!scopeArrayAllows(entitlement.optJSONArray("branchIds"), branch)) {
            return Decision.deny("ENTITLEMENT_SCOPE_MISMATCH", "Branch is not entitled", moduleId, permission);
        }
        if (!scopeArrayAllows(entitlement.optJSONArray("deviceBindings"), device)) {
            return Decision.deny("ENTITLEMENT_DEVICE_MISMATCH", "Origin device is not entitled", moduleId, permission);
        }
        long periodStart = entitlement.optLong("periodStart", 0L);
        if (periodStart > 0L && now < periodStart) {
            return Decision.deny("ENTITLEMENT_NOT_YET_VALID", "Entitlement period has not started", moduleId, permission);
        }
        long offlineValidUntil = entitlement.optLong("offlineValidUntil", 0L);
        if (offlineValidUntil > 0L && now > offlineValidUntil) {
            return Decision.deny("ENTITLEMENT_OFFLINE_EXPIRED", "Offline entitlement window expired", moduleId, permission);
        }
        if (!moduleAllowed(entitlement, moduleId)) {
            return Decision.deny("MODULE_NOT_ENTITLED", "Module is not active: " + moduleId, moduleId, permission);
        }
        if ("M06_MARKETING".equals(moduleId) && !moduleAllowed(entitlement, "M05_CRM")) {
            return Decision.deny("MODULE_DEPENDENCY_MISSING", "Marketing requires CRM", moduleId, permission);
        }

        JSONObject membership = membershipFor(previousState, actor, tenant);
        if (membership == null) {
            return Decision.deny("RBAC_MEMBERSHIP_MISSING", "Active tenant membership required", moduleId, permission);
        }
        if (!scopeArrayAllows(membership.optJSONArray("venueIds"), venue)) {
            return Decision.deny("RBAC_SCOPE_MISMATCH", "Actor cannot access this venue", moduleId, permission);
        }
        if (!scopeArrayAllows(membership.optJSONArray("branchIds"), branch)) {
            return Decision.deny("RBAC_SCOPE_MISMATCH", "Actor cannot access this branch", moduleId, permission);
        }
        String roleId = upper(membership.optString("roleId", membership.optString("role", "VIEWER")));
        if (!roleAllows(previousState, roleId, permission)) {
            return Decision.deny("RBAC_PERMISSION_DENIED", roleId + " cannot " + permission, moduleId, permission);
        }
        return Decision.allow("AUTHORIZED", "SIGNED_ENTITLEMENT_RBAC", moduleId, permission);
    }

    private static Policy policyFor(String type) {
        if ("SESSION.PAY".equals(type)) return new Policy(true, "M02_POS", "payment.capture");
        if (type.startsWith("SESSION.")) {
            String action = type.substring("SESSION.".length()).toLowerCase(Locale.ROOT);
            if ("complete".equals(action) || "expire".equals(action)) action = "finish";
            if ("request".equals(action)) action = "start";
            return new Policy(true, "M01_OPERATIONS", "session." + action);
        }
        if (type.startsWith("QUEUE.")) return new Policy(true, "M01_OPERATIONS", "queue." + suffix(type));
        if (type.startsWith("RESOURCE.")) return new Policy(true, "M01_OPERATIONS", "resource." + suffix(type));
        if (type.startsWith("PRICING.")) return new Policy(true, "M01_OPERATIONS", "pricing." + suffix(type));
        if (type.startsWith("PAYMENT.")) return new Policy(true, "M02_POS", "PAYMENT.RECORD".equals(type) ? "payment.capture" : "payment." + suffix(type));
        if (type.startsWith("REFUND.")) return new Policy(true, "M02_POS", "payment.refund");
        if (type.startsWith("SHIFT.")) return new Policy(true, "M02_POS", "cash." + suffix(type));
        if (type.startsWith("CASH.")) return new Policy(true, "M02_POS", "cash." + suffix(type));
        if (type.startsWith("ORDER.")) return new Policy(true, "M02_POS", "order." + suffix(type));
        if (type.startsWith("PRODUCT.")) return new Policy(true, "M03_INVENTORY", "product." + suffix(type));
        if (type.startsWith("STOCK.") || type.startsWith("INVENTORY.")) return new Policy(true, "M03_INVENTORY", "inventory." + suffix(type));
        if (type.startsWith("FINANCE.") || type.startsWith("EXPENSE.")) return new Policy(true, "M04_FINANCE", "finance." + suffix(type));
        if (type.startsWith("CUSTOMER.") || type.startsWith("CLIENT.")) return new Policy(true, "M05_CRM", "customer." + suffix(type));
        if (type.startsWith("MEMBERSHIP.") || type.startsWith("LOYALTY.") || type.startsWith("PASS.")) return new Policy(true, "M05_CRM", "customer." + suffix(type));
        if (type.startsWith("CAMPAIGN.")) return new Policy(true, "M06_MARKETING", "campaign." + suffix(type));
        if (type.startsWith("OFFER.") || type.startsWith("MARKETING.")) return new Policy(true, "M06_MARKETING", "offer." + suffix(type));
        if (type.startsWith("BOOKING.") || type.startsWith("RESERVATION.")) return new Policy(true, "M07_BOOKINGS", "booking." + suffix(type));
        if (type.startsWith("WAITLIST.")) return new Policy(true, "M07_BOOKINGS", "booking." + suffix(type));
        if (type.startsWith("TOURNAMENT.")) return new Policy(true, "M08_TOURNAMENTS", "tournament." + suffix(type));
        if (type.startsWith("CHALLENGE.")) return new Policy(true, "M08_TOURNAMENTS", "tournament." + suffix(type));
        if (type.startsWith("DEVICE.")) return new Policy(true, "M09_DEVICE_CONTROL", "device." + suffix(type));
        if (type.startsWith("ANALYTICS.") || type.startsWith("REPORT.")) return new Policy(true, "M10_ANALYTICS", "report." + suffix(type));
        if (type.startsWith("PLAYER.")) return new Policy(true, "M11_PLAYER_PORTAL", "player.self." + suffix(type));
        if (type.startsWith("TEAM.") || type.startsWith("STAFF.") || type.startsWith("ROLE.")) return new Policy(true, "M12_TEAM_ADVANCED", "staff." + suffix(type));
        if (type.startsWith("BRANCH.") || type.startsWith("MULTISITE.")) return new Policy(true, "M13_MULTI_SITE", "branch." + suffix(type));
        if (type.startsWith("API.") || type.startsWith("WEBHOOK.") || type.startsWith("INTEGRATION.")) return new Policy(true, "M14_API_INTEGRATIONS", "integration." + suffix(type));
        if (type.startsWith("AI.")) return new Policy(true, "M15_AI_OPERATOR", "ai." + suffix(type));
        return new Policy(false, "", "");
    }

    private static JSONObject membershipFor(JSONObject state, String actorId, String tenantId) {
        if (state == null) return null;
        JSONArray memberships = state.optJSONArray("tenantMemberships");
        if (memberships == null) return null;
        String activeAccountId = "";
        JSONObject identity = state.optJSONObject("identity");
        if (identity != null) activeAccountId = text(identity, "activeAccountId");
        for (int i = 0; i < memberships.length(); i++) {
            JSONObject m = memberships.optJSONObject(i);
            if (m == null) continue;
            String accountId = text(m, "accountId");
            boolean actorMatches = actorId.equals(accountId)
                    || (("owner-local".equals(actorId) || "local-owner".equals(actorId)) && !activeAccountId.isEmpty() && activeAccountId.equals(accountId));
            if (!actorMatches) continue;
            if (!tenantId.equals(text(m, "tenantId"))) continue;
            String status = upper(m.optString("status", "ACTIVE"));
            if ("DISABLED".equals(status) || "REVOKED".equals(status) || "SUSPENDED".equals(status)) continue;
            return m;
        }
        return null;
    }

    private static boolean roleAllows(JSONObject state, String roleId, String permission) {
        String[] grants = ROLE_PERMISSIONS.get(roleId);
        JSONArray customRoles = state == null ? null : state.optJSONArray("securityRoles");
        if (customRoles != null) {
            for (int i = 0; i < customRoles.length(); i++) {
                JSONObject role = customRoles.optJSONObject(i);
                if (role == null) continue;
                if (!roleId.equals(upper(role.optString("id", role.optString("name", ""))))) continue;
                JSONArray permissions = role.optJSONArray("permissions");
                if (permissions != null && permissions.length() > 0) {
                    grants = new String[permissions.length()];
                    for (int j = 0; j < permissions.length(); j++) grants[j] = permissions.optString(j, "");
                }
                break;
            }
        }
        if (grants == null) return false;
        for (String grant : grants) if (wildcardMatch(grant, permission)) return true;
        return false;
    }

    private static boolean wildcardMatch(String grant, String permission) {
        if (grant == null) return false;
        grant = grant.trim();
        if ("*".equals(grant) || grant.equals(permission)) return true;
        if (grant.endsWith(".*")) return permission.startsWith(grant.substring(0, grant.length() - 1));
        if ("*.read".equals(grant)) return permission.endsWith(".read");
        return false;
    }

    private static boolean moduleAllowed(JSONObject entitlement, String moduleId) {
        if ("PLATFORM_CORE".equals(moduleId)) return true;
        JSONArray modules = entitlement.optJSONArray("modules");
        if (modules == null) return false;
        for (int i = 0; i < modules.length(); i++) if (moduleId.equals(modules.optString(i))) return true;
        return false;
    }

    private static boolean scopeArrayAllows(JSONArray allowed, String value) {
        if (allowed == null || allowed.length() == 0) return true;
        for (int i = 0; i < allowed.length(); i++) {
            String x = allowed.optString(i, "").trim();
            if ("*".equals(x) || value.equals(x)) return true;
        }
        return false;
    }

    private static String suffix(String type) {
        int dot = type.indexOf('.');
        return (dot < 0 ? type : type.substring(dot + 1)).toLowerCase(Locale.ROOT);
    }

    private static String text(JSONObject object, String key) {
        return object == null ? "" : object.optString(key, "").trim();
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static final class Policy {
        final boolean known;
        final String moduleId;
        final String permission;
        Policy(boolean known, String moduleId, String permission) {
            this.known = known;
            this.moduleId = moduleId;
            this.permission = permission;
        }
    }

    static final class Decision {
        final boolean allowed;
        final String code;
        final String message;
        final String moduleId;
        final String requiredPermission;
        final String authorityMode;

        private Decision(boolean allowed, String code, String message, String moduleId, String requiredPermission, String authorityMode) {
            this.allowed = allowed;
            this.code = code;
            this.message = message;
            this.moduleId = moduleId;
            this.requiredPermission = requiredPermission;
            this.authorityMode = authorityMode;
        }

        static Decision allow(String code, String mode, String moduleId, String permission) {
            return new Decision(true, code, "Authorized", moduleId, permission, mode);
        }

        static Decision deny(String code, String message, String moduleId, String permission) {
            return new Decision(false, code, message, moduleId, permission, "DENIED");
        }
    }
}
