using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;

namespace CyberpunkDiario;

internal static class Program
{
    private const int HttpPort = 8765;
    private static readonly string DataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CyberpunkDiario");
    private static readonly string StatePath = Path.Combine(DataDirectory, "state.json");
    private static readonly string TokenPath = Path.Combine(DataDirectory, "pairing.token");
    private static string _token = "";
    private static LanDiscovery? _discovery;

    [STAThread]
    private static async Task Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Directory.CreateDirectory(DataDirectory);
        _token = LoadToken();
        _discovery = new LanDiscovery();
        _discovery.Start();

        var webRoot = Path.Combine(AppContext.BaseDirectory, "web");
        if (!Directory.Exists(webRoot))
        {
            MessageBox.Show("Os arquivos do aplicativo não foram encontrados.", "Cyberpunk Diário",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = AppContext.BaseDirectory,
            WebRootPath = webRoot
        });
        builder.WebHost.ConfigureKestrel(options => options.ListenAnyIP(HttpPort));
        var app = builder.Build();

        app.Use(async (context, next) =>
        {
            context.Response.Headers["Access-Control-Allow-Origin"] = "*";
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS";
            context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
            context.Response.Headers["Cache-Control"] = "no-store";
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return;
            }
            await next();
        });
        app.UseDefaultFiles();
        app.UseStaticFiles();

        app.MapGet("/api/config", (HttpContext context) =>
        {
            if (context.Connection.RemoteIpAddress is { } remote && !IPAddress.IsLoopback(remote))
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            return Results.Json(new { token = _token });
        });

        app.MapGet("/api/devices", () => Results.Json(_discovery?.GetDevices() ?? Array.Empty<object>()));

        app.MapGet("/api/state", (HttpContext context) =>
        {
            if (!Authorized(context)) return Results.Unauthorized();
            if (!File.Exists(StatePath)) return Results.Json(new { state = (object?)null, updatedAt = 0L });
            try
            {
                using var document = JsonDocument.Parse(File.ReadAllText(StatePath));
                var state = document.RootElement.Clone();
                var updatedAt = state.TryGetProperty("updatedAt", out var updated) && updated.TryGetInt64(out var stamp) ? stamp : 0L;
                return Results.Json(new { state, updatedAt });
            }
            catch { return Results.Problem("O arquivo de dados local está inválido.", statusCode: 500); }
        });

        app.MapPut("/api/state", async (HttpContext context) =>
        {
            if (!Authorized(context)) return Results.Unauthorized();
            if (context.Request.ContentLength is > 5_000_000) return Results.BadRequest(new { error = "payload too large" });
            try
            {
                using var document = await JsonDocument.ParseAsync(context.Request.Body);
                if (!document.RootElement.TryGetProperty("state", out var state) || state.ValueKind != JsonValueKind.Object)
                    return Results.BadRequest(new { error = "invalid state" });
                var json = state.GetRawText();
                var temp = StatePath + ".tmp";
                await File.WriteAllTextAsync(temp, json, new UTF8Encoding(false));
                File.Move(temp, StatePath, true);
                var updatedAt = state.TryGetProperty("updatedAt", out var updated) && updated.TryGetInt64(out var stamp) ? stamp : 0L;
                return Results.Json(new { ok = true, updatedAt });
            }
            catch (JsonException) { return Results.BadRequest(new { error = "invalid json" }); }
        });

        app.MapFallbackToFile("index.html");
        try
        {
            await app.StartAsync();
            Application.Run(new MainForm(_token, _discovery));
        }
        finally
        {
            _discovery.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    private static bool Authorized(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(header), Encoding.UTF8.GetBytes("Bearer " + _token));
    }

    private static string LoadToken()
    {
        if (File.Exists(TokenPath))
        {
            var saved = File.ReadAllText(TokenPath).Trim();
            if (saved.Length >= 32) return saved;
        }
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        File.WriteAllText(TokenPath, token);
        return token;
    }
}

internal sealed class LanDiscovery : IDisposable
{
    private readonly ConcurrentDictionary<string, object> _devices = new();
    private UdpClient? _listener;
    private CancellationTokenSource? _stop;
    private readonly string _deviceId = LoadDeviceId();

    private static string LoadDeviceId()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CyberpunkDiario");
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "device.id");
        if (File.Exists(path)) return File.ReadAllText(path).Trim();
        var id = Guid.NewGuid().ToString("N");
        File.WriteAllText(path, id);
        return id;
    }

    public void Start()
    {
        _stop = new CancellationTokenSource();
        _listener = new UdpClient(new IPEndPoint(IPAddress.Any, 8766));
        _ = ListenAsync(_stop.Token);
    }

    private async Task ListenAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var packet = await _listener!.ReceiveAsync(cancellationToken);
                var message = Encoding.UTF8.GetString(packet.Buffer);
                if (!message.StartsWith("CYBERPUNK_DISCOVER_V1", StringComparison.Ordinal)) continue;
                var host = packet.RemoteEndPoint.Address.ToString();
                var name = "Android";
                var parts = message.Split('|', 3);
                if (parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])) name = parts[1];
                _devices[host] = new { name, host, platform = "ANDROID", lastSeen = DateTimeOffset.UtcNow.ToUnixTimeSeconds() };
                var response = Encoding.UTF8.GetBytes($"CYBERPUNK_DEVICE_V1|{Environment.MachineName}|8765|{_deviceId}");
                await _listener.SendAsync(response, packet.RemoteEndPoint, cancellationToken);
            }
            catch (OperationCanceledException) { break; }
            catch (ObjectDisposedException) { break; }
            catch (SocketException) { await Task.Delay(500, cancellationToken).ContinueWith(_ => { }); }
        }
    }

    public object[] GetDevices()
    {
        var cutoff = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - 45;
        foreach (var item in _devices.ToArray())
            if (item.Value is not null && GetLastSeen(item.Value) < cutoff) _devices.TryRemove(item.Key, out _);
        return _devices.Values.ToArray();
    }

    private static long GetLastSeen(object value)
    {
        try { return (long)value.GetType().GetProperty("lastSeen")!.GetValue(value)!; }
        catch { return 0; }
    }

    public void Dispose()
    {
        _stop?.Cancel();
        _listener?.Dispose();
        _stop?.Dispose();
    }
}

internal sealed class MainForm : Form
{
    private readonly string _token;
    private readonly LanDiscovery _discovery;
    private readonly Microsoft.Web.WebView2.WinForms.WebView2 _web = new() { Dock = DockStyle.Fill };
    private readonly Label _status = new();
    private readonly Label _pairing = new();
    private readonly Label _devices = new();

    public MainForm(string token, LanDiscovery discovery)
    {
        _token = token;
        _discovery = discovery;
        Text = "Cyberpunk Diário";
        MinimumSize = new Size(980, 680);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(9, 9, 13);
        ForeColor = Color.Gainsboro;

        var header = new Panel { Dock = DockStyle.Top, Height = 82, BackColor = Color.FromArgb(17, 17, 23), Padding = new Padding(18, 10, 18, 8) };
        var title = new Label { Text = "CYBERPUNK DIÁRIO", AutoSize = true, ForeColor = Color.FromArgb(255, 53, 85), Font = new Font("Segoe UI", 14, FontStyle.Bold), Location = new Point(18, 8) };
        _status.Text = "LAN ATIVA · procurando dispositivos";
        _status.AutoSize = true; _status.ForeColor = Color.LightGray; _status.Location = new Point(20, 37);
        _pairing.Text = "CÓDIGO DE PAREAMENTO: " + token;
        _pairing.AutoSize = true; _pairing.ForeColor = Color.DeepSkyBlue; _pairing.Font = new Font("Consolas", 9, FontStyle.Bold);
        _devices.AutoSize = true; _devices.ForeColor = Color.LightGray; _devices.Location = new Point(20, 58); _devices.Font = new Font("Segoe UI", 8);
        _pairing.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        var copy = new Button { Text = "COPIAR CÓDIGO", AutoSize = true, FlatStyle = FlatStyle.Flat, ForeColor = Color.White, BackColor = Color.FromArgb(35, 35, 45), Anchor = AnchorStyles.Top | AnchorStyles.Right };
        copy.FlatAppearance.BorderColor = Color.FromArgb(255, 53, 85);
        copy.Click += (_, _) => { Clipboard.SetText(_token); _status.Text = "Código copiado · " + _discovery.GetDevices().Length + " dispositivo(s) LAN detectado(s)"; };
        header.Controls.Add(title); header.Controls.Add(_status); header.Controls.Add(_pairing); header.Controls.Add(_devices); header.Controls.Add(copy);
        header.Resize += (_, _) => { copy.Location = new Point(header.Width - copy.Width - 18, 17); _pairing.Location = new Point(Math.Max(390, header.Width - copy.Width - _pairing.Width - 40), 22); };
        Controls.Add(_web); Controls.Add(header);

        Shown += async (_, _) =>
        {
            try
            {
                await _web.EnsureCoreWebView2Async();
                _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
                _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _web.Source = new Uri("http://127.0.0.1:8765/");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Não foi possível iniciar o WebView2. Atualize o Microsoft Edge WebView2 Runtime e abra novamente.\n\n" + ex.Message,
                    "Cyberpunk Diário", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        };
        var timer = new System.Windows.Forms.Timer { Interval = 3000 };
        timer.Tick += (_, _) => var peers = _discovery.GetDevices(); _status.Text = "LAN ATIVA · " + peers.Length + " celular(is) detectado(s) · porta 8765";
            _devices.Text = string.Join("   |   ", peers.Select(p => p.GetType().GetProperty("name")?.GetValue(p)?.ToString()).Where(n => !string.IsNullOrWhiteSpace(n)));
        timer.Start();
        FormClosed += (_, _) => timer.Stop();
    }
}