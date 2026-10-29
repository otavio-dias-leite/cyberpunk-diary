package com.cyberpunkdiario.desktop;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import javax.swing.*;
import java.awt.*;
import java.awt.datatransfer.StringSelection;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.List;

public final class DesktopServer {
    private static final int PORT = 8765;
    private static final int MAX_BODY = 5 * 1024 * 1024;
    private static final Path DATA_DIR = Path.of(System.getenv().getOrDefault("APPDATA", System.getProperty("user.home")), "CyberpunkDiario");
    private static final Path STATE_FILE = DATA_DIR.resolve("state.json");
    private static final Path TOKEN_FILE = DATA_DIR.resolve("pairing.token");
    private static String token;
    private static HttpServer server;

    public static void main(String[] args) throws Exception {
        Files.createDirectories(DATA_DIR);
        token = loadOrCreateToken();
        server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);
        server.createContext("/", DesktopServer::handle);
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        SwingUtilities.invokeLater(DesktopServer::showWindow);
    }

    private static String loadOrCreateToken() throws IOException {
        if (Files.exists(TOKEN_FILE)) {
            String saved = Files.readString(TOKEN_FILE, StandardCharsets.UTF_8).trim();
            if (saved.length() >= 32) return saved;
        }
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String generated = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Files.writeString(TOKEN_FILE, generated, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return generated;
    }

    private static void showWindow() {
        JFrame frame = new JFrame("Cyberpunk Diário — servidor local");
        frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        frame.setSize(680, 440);
        frame.setLocationRelativeTo(null);
        frame.getContentPane().setBackground(new Color(12, 12, 17));
        JPanel panel = new JPanel();
        panel.setBackground(new Color(12, 12, 17));
        panel.setBorder(BorderFactory.createEmptyBorder(24, 28, 24, 28));
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        JLabel title = new JLabel("CYBERPUNK DIÁRIO // DESKTOP");
        title.setForeground(new Color(255, 53, 85));
        title.setFont(new Font("SansSerif", Font.BOLD, 21));
        JLabel info = new JLabel("<html>Servidor ativo na porta <b>" + PORT + "</b>. Conecte o Android à mesma rede Wi-Fi.</html>");
        info.setForeground(Color.LIGHT_GRAY);
        info.setBorder(BorderFactory.createEmptyBorder(14, 0, 8, 0));
        JTextArea addresses = new JTextArea(String.join("\n", lanUrls()));
        addresses.setEditable(false);
        addresses.setBackground(new Color(25, 25, 32));
        addresses.setForeground(Color.WHITE);
        addresses.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 14));
        addresses.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        JTextField pairing = new JTextField(token);
        pairing.setEditable(false);
        pairing.setBackground(new Color(25, 25, 32));
        pairing.setForeground(new Color(0, 200, 255));
        pairing.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));
        JButton copy = new JButton("Copiar código de pareamento");
        copy.addActionListener(e -> Toolkit.getDefaultToolkit().getSystemClipboard().setContents(new StringSelection(token), null));
        JButton open = new JButton("Abrir diário neste computador");
        open.addActionListener(e -> openBrowser("http://127.0.0.1:" + PORT));
        JLabel warning = new JLabel("<html><br>Segurança: o código permite acesso aos dados do diário. Compartilhe apenas com seus próprios dispositivos.<br>Não exponha a porta 8765 à internet. O servidor salva os dados em " + STATE_FILE + ".</html>");
        warning.setForeground(new Color(180, 160, 170));
        panel.add(title); panel.add(info); panel.add(addresses);
        panel.add(new JLabel("Código de pareamento (cole em Ajustes → Sincronização LAN no Android):"));
        panel.add(pairing); panel.add(copy); panel.add(Box.createVerticalStrut(8)); panel.add(open); panel.add(warning);
        for (Component c : panel.getComponents()) if (c instanceof JLabel l) l.setForeground(new Color(210, 205, 215));
        title.setForeground(new Color(255, 53, 85)); info.setForeground(Color.LIGHT_GRAY); warning.setForeground(new Color(180, 160, 170));
        frame.setContentPane(panel);
        frame.setVisible(true);
        openBrowser("http://127.0.0.1:" + PORT);
    }

    private static List<String> lanUrls() {
        List<String> result = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> addresses = ni.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (address instanceof Inet4Address && address.isSiteLocalAddress())
                        result.add("http://" + address.getHostAddress() + ":" + PORT);
                }
            }
        } catch (Exception ignored) {}
        if (result.isEmpty()) result.add("http://IP-DO-COMPUTADOR:" + PORT);
        return result;
    }

    private static void openBrowser(String address) {
        try { if (Desktop.isDesktopSupported()) Desktop.getDesktop().browse(URI.create(address)); } catch (Exception ignored) {}
    }

    private static void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        Headers headers = exchange.getResponseHeaders();
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        if ("OPTIONS".equalsIgnoreCase(method)) { exchange.sendResponseHeaders(204, -1); exchange.close(); return; }
        if ("/api/config".equals(path) && "GET".equalsIgnoreCase(method)) {
            if (!exchange.getRemoteAddress().getAddress().isLoopbackAddress()) { send(exchange, 403, "application/json", "{\"error\":\"local only\"}"); return; }
            send(exchange, 200, "application/json; charset=utf-8", "{\"token\":\"" + token + "\"}");
            return;
        }
        if (path.startsWith("/api/")) {
            if (!authorized(exchange)) { send(exchange, 401, "application/json; charset=utf-8", "{\"error\":\"unauthorized\"}"); return; }
            if ("/api/state".equals(path) && "GET".equalsIgnoreCase(method)) {
                String state = Files.exists(STATE_FILE) ? Files.readString(STATE_FILE, StandardCharsets.UTF_8) : "null";
                long updated = extractUpdatedAt(state);
                send(exchange, 200, "application/json; charset=utf-8", "{\"state\":" + state + ",\"updatedAt\":" + updated + "}");
                return;
            }
            if ("/api/state".equals(path) && "PUT".equalsIgnoreCase(method)) {
                byte[] bytes = readLimited(exchange.getRequestBody(), MAX_BODY);
                String body = new String(bytes, StandardCharsets.UTF_8);
                String state = extractState(body);
                if (state == null || !state.startsWith("{") || !state.endsWith("}")) { send(exchange, 400, "application/json; charset=utf-8", "{\"error\":\"invalid state\"}"); return; }
                Path temp = DATA_DIR.resolve("state.tmp");
                Files.writeString(temp, state, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                try { Files.move(temp, STATE_FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
                catch (AtomicMoveNotSupportedException e) { Files.move(temp, STATE_FILE, StandardCopyOption.REPLACE_EXISTING); }
                send(exchange, 200, "application/json; charset=utf-8", "{\"ok\":true,\"updatedAt\":" + extractUpdatedAt(state) + "}");
                return;
            }
            send(exchange, 404, "application/json; charset=utf-8", "{\"error\":\"not found\"}");
            return;
        }
        if (!"GET".equalsIgnoreCase(method)) { send(exchange, 405, "text/plain; charset=utf-8", "Method not allowed"); return; }
        String resource = path.equals("/") ? "/web/index.html" : "/web" + path;
        if (resource.contains("..")) { send(exchange, 400, "text/plain; charset=utf-8", "Bad path"); return; }
        try (InputStream in = DesktopServer.class.getResourceAsStream(resource)) {
            if (in == null) { send(exchange, 404, "text/plain; charset=utf-8", "Not found"); return; }
            byte[] content = readLimited(in, 8 * 1024 * 1024);
            send(exchange, 200, mime(path), content);
        }
    }

    private static boolean authorized(HttpExchange exchange) {
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        return auth != null && auth.equals("Bearer " + token);
    }

    private static byte[] readLimited(InputStream input, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int n, total = 0;
        while ((n = input.read(buffer)) != -1) { total += n; if (total > max) throw new IOException("Request too large"); out.write(buffer, 0, n); }
        return out.toByteArray();
    }

    private static String extractState(String body) {
        int key = body.indexOf("\"state\"");
        if (key < 0) return null;
        int start = body.indexOf('{', body.indexOf(':', key) + 1);
        if (start < 0) return null;
        int depth = 0; boolean quoted = false, escaped = false;
        for (int i = start; i < body.length(); i++) {
            char c = body.charAt(i);
            if (quoted) { if (escaped) escaped = false; else if (c == '\\') escaped = true; else if (c == '"') quoted = false; continue; }
            if (c == '"') quoted = true;
            else if (c == '{') depth++;
            else if (c == '}' && --depth == 0) return body.substring(start, i + 1);
        }
        return null;
    }

    private static long extractUpdatedAt(String json) {
        try {
            int i = json.indexOf("\"updatedAt\"");
            if (i < 0) return 0;
            int colon = json.indexOf(':', i); int end = colon + 1;
            while (end < json.length() && Character.isWhitespace(json.charAt(end))) end++;
            int start = end;
            while (end < json.length() && Character.isDigit(json.charAt(end))) end++;
            return Long.parseLong(json.substring(start, end));
        } catch (Exception e) { return 0; }
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static void send(HttpExchange exchange, int status, String type, String body) throws IOException {
        send(exchange, status, type, body.getBytes(StandardCharsets.UTF_8));
    }
    private static void send(HttpExchange exchange, int status, String type, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
    }
}