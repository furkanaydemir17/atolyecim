Add-Type @"
using System;
using System.Net;
using System.Net.Sockets;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Generic;

public class SimpleHttpServer {
    private TcpListener listener;
    private string rootDir;
    private bool running = true;
    private Dictionary<string, string> mimeTypes;

    public SimpleHttpServer(int port, string root) {
        rootDir = root;
        listener = new TcpListener(IPAddress.Any, port);
        mimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            { ".html", "text/html; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".svg", "image/svg+xml" },
            { ".ico", "image/x-icon" }
        };
    }

    public void Start() {
        listener.Start();
        Console.WriteLine("\n==========================================");
        Console.WriteLine("    ATOLYECIM - Sunucu Aktif");
        Console.WriteLine("==========================================");
        Console.WriteLine("   http://localhost:" + ((IPEndPoint)listener.LocalEndpoint).Port);
        Console.WriteLine("   Durdurmak  : Ctrl + C");
        Console.WriteLine("==========================================\n");

        while (running) {
            try {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            } catch { }
        }
    }

    private void HandleClient(object obj) {
        TcpClient client = (TcpClient)obj;
        try {
            NetworkStream stream = client.GetStream();
            stream.ReadTimeout = 5000;
            StreamReader reader = new StreamReader(stream, Encoding.UTF8);

            string requestLine = reader.ReadLine();
            if (string.IsNullOrEmpty(requestLine)) { client.Close(); return; }

            // Read headers
            while (true) {
                string line = reader.ReadLine();
                if (string.IsNullOrEmpty(line)) break;
            }

            string[] parts = requestLine.Split(' ');
            string urlPath = parts.Length >= 2 ? parts[1] : "/";
            int qIdx = urlPath.IndexOf('?');
            if (qIdx >= 0) urlPath = urlPath.Substring(0, qIdx);
            if (urlPath == "/") urlPath = "/index.html";

            string filePath = Path.Combine(rootDir, urlPath.TrimStart('/').Replace('/', '\\'));
            string ext = Path.GetExtension(filePath).ToLower();

            if (File.Exists(filePath)) {
                byte[] content = File.ReadAllBytes(filePath);
                string contentType;
                if (!mimeTypes.TryGetValue(ext, out contentType))
                    contentType = "application/octet-stream";

                string header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.Length + "\r\n" +
                    "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n";

                byte[] headerBytes = Encoding.UTF8.GetBytes(header);
                stream.Write(headerBytes, 0, headerBytes.Length);
                stream.Write(content, 0, content.Length);
                Console.WriteLine("[" + DateTime.Now.ToString("HH:mm:ss") + "] 200 " + urlPath);
            } else {
                byte[] body = Encoding.UTF8.GetBytes("404 - Dosya bulunamadi: " + urlPath);
                string header = "HTTP/1.1 404 Not Found\r\n" +
                    "Content-Type: text/plain; charset=utf-8\r\n" +
                    "Content-Length: " + body.Length + "\r\n" +
                    "Connection: close\r\n\r\n";
                byte[] headerBytes = Encoding.UTF8.GetBytes(header);
                stream.Write(headerBytes, 0, headerBytes.Length);
                stream.Write(body, 0, body.Length);
                Console.WriteLine("[" + DateTime.Now.ToString("HH:mm:ss") + "] 404 " + urlPath);
            }
            stream.Flush();
        } catch { } finally { client.Close(); }
    }

    public void Stop() { running = false; listener.Stop(); }
}
"@

$Port = 8080
$Root = $PSScriptRoot
$Server = [SimpleHttpServer]::new($Port, $Root)

# Handle Ctrl+C
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { $Server.Stop() }

$Server.Start()
