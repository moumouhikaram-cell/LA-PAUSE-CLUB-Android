package com.lapauseclub.tvagent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class AgentHttpServer {
    interface CommandExecutor {
        boolean showOverlay(String type, JSONObject payload);
        void restartAgent();
    }

    private static final int[] PORTS = new int[]{8080, 8765, 3000};
    private static final int MAX_BODY = 64 * 1024;
    private final AgentConfig config;
    private final CommandExecutor executor;
    private final ExecutorService clientPool = Executors.newFixedThreadPool(6);
    private volatile boolean running;
    private volatile ServerSocket serverSocket;
    private volatile Thread acceptThread;
    private volatile int boundPort;

    AgentHttpServer(AgentConfig config, CommandExecutor executor) {
        this.config = config;
        this.executor = executor;
    }

    synchronized int start() throws Exception {
        if (running && serverSocket != null && !serverSocket.isClosed()) return boundPort;
        Exception last = null;
        for (int port : PORTS) {
            try {
                ServerSocket socket = new ServerSocket();
                socket.setReuseAddress(true);
                socket.bind(new InetSocketAddress(port));
                serverSocket = socket;
                boundPort = port;
                running = true;
                config.setRuntime(port, "ONLINE", "");
                acceptThread = new Thread(this::acceptLoop, "la-pause-agent-http");
                acceptThread.setDaemon(true);
                acceptThread.start();
                return port;
            } catch (Exception ex) {
                last = ex;
            }
        }
        config.setRuntime(0, "ERROR", last == null ? "Aucun port disponible" : String.valueOf(last.getMessage()));
        throw last == null ? new IllegalStateException("Aucun port disponible") : last;
    }

    synchronized void stop() {
        running = false;
        ServerSocket socket = serverSocket;
        serverSocket = null;
        boundPort = 0;
        if (socket != null) try { socket.close(); } catch (Exception ignored) {}
        Thread thread = acceptThread;
        acceptThread = null;
        if (thread != null) thread.interrupt();
        config.setRuntime(0, "STOPPED", "");
    }

    synchronized void shutdown() {
        stop();
        clientPool.shutdownNow();
    }

    int port() { return boundPort; }

    private void acceptLoop() {
        while (running) {
            try {
                Socket socket = serverSocket.accept();
                clientPool.execute(() -> handle(socket));
            } catch (Exception ex) {
                if (running) config.setRuntime(boundPort, "DEGRADED", String.valueOf(ex.getMessage()));
            }
        }
    }

    private void handle(Socket socket) {
        try (Socket client = socket) {
            client.setSoTimeout(3500);
            InetAddress remote = client.getInetAddress();
            if (!isLocalAddress(remote)) {
                writeJson(client.getOutputStream(), 403, error("LAN_ONLY", "Client hors réseau local refusé"));
                return;
            }
            BufferedInputStream input = new BufferedInputStream(client.getInputStream());
            HttpRequest request = readRequest(input);
            if (request == null) return;
            String path = request.path;
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);

            if ("GET".equals(request.method) && "/health".equals(path)) {
                writeJson(client.getOutputStream(), 200, health());
                return;
            }
            if ("POST".equals(request.method) && "/v1/pair".equals(path)) {
                handlePair(client.getOutputStream(), request);
                return;
            }
            if ("POST".equals(request.method) && "/v1/commands".equals(path)) {
                handleCommand(client.getOutputStream(), request);
                return;
            }
            writeJson(client.getOutputStream(), 404, error("NOT_FOUND", "Endpoint inconnu"));
        } catch (Exception ignored) {
        }
    }

    private void handlePair(OutputStream output, HttpRequest request) throws Exception {
        JSONObject body = parseBody(request.body);
        String code = body.optString("pairingCode", "").trim();
        if (!config.verifyPairingCode(code)) {
            writeJson(output, 401, error("PAIRING_CODE_INVALID", "Code de pairing invalide ou expiré"));
            return;
        }
        String token = config.issueBearerToken();
        JSONObject result = new JSONObject();
        result.put("ok", true);
        result.put("protocol", AgentConfig.PROTOCOL);
        result.put("agentId", config.agentId());
        result.put("token", token);
        result.put("tokenType", "Bearer");
        result.put("pairedAt", System.currentTimeMillis());
        result.put("nextPairingCodeExpiresAt", config.pairingExpiresAt());
        writeJson(output, 200, result);
    }

    private void handleCommand(OutputStream output, HttpRequest request) throws Exception {
        String token = bearer(request.headers.get("authorization"));
        if (!config.authorizeBearer(token)) {
            writeJson(output, 401, error("UNAUTHORIZED", "Pairing requis"));
            return;
        }
        JSONObject body = parseBody(request.body);
        String commandId = body.optString("commandId", "").trim();
        String idempotencyKey = body.optString("idempotencyKey", "").trim();
        String type = body.optString("type", "").trim().toUpperCase(Locale.ROOT);
        long sequence = body.optLong("sequence", 0L);
        JSONObject payload = body.optJSONObject("payload");
        if (payload == null) payload = new JSONObject();
        if (commandId.isEmpty() || idempotencyKey.isEmpty() || type.isEmpty()) {
            writeJson(output, 400, error("BAD_COMMAND", "commandId, idempotencyKey et type sont obligatoires"));
            return;
        }
        if (config.idempotencySeen(idempotencyKey)) {
            JSONObject duplicate = ack(commandId, type, sequence, "DUPLICATE_ACK");
            duplicate.put("duplicate", true);
            writeJson(output, 200, duplicate);
            return;
        }
        if (!supports(type)) {
            writeJson(output, 409, error("CAPABILITY_NOT_AVAILABLE", "Commande non annoncée par cet agent"));
            return;
        }

        boolean executed = true;
        if (isOverlayCommand(type)) executed = executor.showOverlay(type, payload);
        else if ("RESTART_AGENT".equals(type)) executor.restartAgent();

        if (!executed) {
            writeJson(output, 409, error("OVERLAY_NOT_READY", "Overlay non autorisé ou non validé sur ce device"));
            return;
        }
        config.rememberIdempotency(idempotencyKey);
        config.markCommand(sequence);
        writeJson(output, 200, ack(commandId, type, sequence, "ACKED"));
    }

    private JSONObject health() throws Exception {
        boolean overlay = config.overlayReady();
        JSONObject caps = new JSONObject();
        caps.put("heartbeat", true);
        caps.put("display", overlay);
        caps.put("overlay", overlay);
        caps.put("remoteControl", overlay);
        caps.put("power", false);
        caps.put("input", false);
        caps.put("sessionLease", true);

        JSONArray commands = new JSONArray();
        commands.put("REFRESH_STATUS");
        commands.put("RESTART_AGENT");
        if (overlay) {
            commands.put("SHOW_MESSAGE");
            commands.put("SESSION_START");
            commands.put("SESSION_WARNING");
            commands.put("SESSION_END");
        }

        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("protocol", AgentConfig.PROTOCOL);
        out.put("service", AgentConfig.SERVICE);
        out.put("agentId", config.agentId());
        out.put("name", config.name());
        out.put("deviceType", "ANDROID_TV_AGENT");
        out.put("version", AgentConfig.VERSION);
        out.put("capabilities", caps);
        out.put("supportedCommands", commands);
        out.put("authRequired", true);
        out.put("pairingRequired", true);
        out.put("paired", config.hasAuthorizedController());
        out.put("overlayPermission", config.overlayPermissionGranted());
        out.put("overlayVerified", config.overlayVerified());
        out.put("port", boundPort);
        out.put("lastSequence", config.lastSequence());
        out.put("lastCommandAt", config.lastCommandAt());
        out.put("serverTime", System.currentTimeMillis());
        return out;
    }

    private boolean supports(String type) {
        if ("REFRESH_STATUS".equals(type) || "RESTART_AGENT".equals(type)) return true;
        return isOverlayCommand(type) && config.overlayReady();
    }

    private static boolean isOverlayCommand(String type) {
        return "SHOW_MESSAGE".equals(type)
                || "SESSION_START".equals(type)
                || "SESSION_WARNING".equals(type)
                || "SESSION_END".equals(type);
    }

    private JSONObject ack(String commandId, String type, long sequence, String status) throws Exception {
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("status", status);
        out.put("protocol", AgentConfig.PROTOCOL);
        out.put("agentId", config.agentId());
        out.put("commandId", commandId);
        out.put("type", type);
        out.put("sequence", sequence);
        out.put("executedAt", System.currentTimeMillis());
        return out;
    }

    private static JSONObject error(String code, String message) {
        JSONObject out = new JSONObject();
        try {
            out.put("ok", false);
            out.put("code", code);
            out.put("error", message);
        } catch (Exception ignored) {}
        return out;
    }

    private static JSONObject parseBody(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length == 0) return new JSONObject();
        return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }

    private static String bearer(String authorization) {
        if (authorization == null) return "";
        String value = authorization.trim();
        if (value.regionMatches(true, 0, "Bearer ", 0, 7)) return value.substring(7).trim();
        return "";
    }

    private static boolean isLocalAddress(InetAddress address) {
        return address != null && (address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress());
    }

    private static final class HttpRequest {
        final String method;
        final String path;
        final Map<String, String> headers;
        final byte[] body;
        HttpRequest(String method, String path, Map<String, String> headers, byte[] body) {
            this.method = method;
            this.path = path;
            this.headers = headers;
            this.body = body;
        }
    }

    private static HttpRequest readRequest(InputStream input) throws Exception {
        String first = readLine(input, 8192);
        if (first == null || first.trim().isEmpty()) return null;
        String[] bits = first.trim().split("\\s+");
        if (bits.length < 2) throw new IllegalArgumentException("Bad request line");
        Map<String, String> headers = new HashMap<>();
        while (true) {
            String line = readLine(input, 16384);
            if (line == null || line.isEmpty()) break;
            int colon = line.indexOf(':');
            if (colon <= 0) continue;
            headers.put(line.substring(0, colon).trim().toLowerCase(Locale.ROOT), line.substring(colon + 1).trim());
        }
        int contentLength = 0;
        try { contentLength = Integer.parseInt(headers.getOrDefault("content-length", "0")); }
        catch (Exception ignored) {}
        if (contentLength < 0 || contentLength > MAX_BODY) throw new IllegalArgumentException("Body too large");
        byte[] body = new byte[contentLength];
        int offset = 0;
        while (offset < contentLength) {
            int n = input.read(body, offset, contentLength - offset);
            if (n < 0) throw new IllegalArgumentException("Incomplete body");
            offset += n;
        }
        return new HttpRequest(bits[0].toUpperCase(Locale.ROOT), bits[1], headers, body);
    }

    private static String readLine(InputStream input, int max) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int previous = -1;
        while (out.size() < max) {
            int value = input.read();
            if (value < 0) break;
            if (previous == '\r' && value == '\n') {
                byte[] bytes = out.toByteArray();
                int length = bytes.length > 0 && bytes[bytes.length - 1] == '\r' ? bytes.length - 1 : bytes.length;
                return new String(bytes, 0, length, StandardCharsets.US_ASCII);
            }
            out.write(value);
            previous = value;
        }
        if (out.size() == 0) return null;
        return new String(out.toByteArray(), StandardCharsets.US_ASCII).trim();
    }

    private static void writeJson(OutputStream raw, int status, JSONObject body) throws Exception {
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        String statusText;
        switch (status) {
            case 200: statusText = "OK"; break;
            case 400: statusText = "Bad Request"; break;
            case 401: statusText = "Unauthorized"; break;
            case 403: statusText = "Forbidden"; break;
            case 404: statusText = "Not Found"; break;
            case 409: statusText = "Conflict"; break;
            default: statusText = "Error";
        }
        BufferedOutputStream output = new BufferedOutputStream(raw);
        String headers = "HTTP/1.1 " + status + " " + statusText + "\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Content-Length: " + payload.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n"
                + "X-LA-PAUSE-Agent: " + AgentConfig.PROTOCOL + "\r\n\r\n";
        output.write(headers.getBytes(StandardCharsets.US_ASCII));
        output.write(payload);
        output.flush();
    }
}
