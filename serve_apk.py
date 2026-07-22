"""
LostLink AI — APK Server
Serves the debug APK on your local network so you can
scan the QR code on your phone and download it directly.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import http.server
import socketserver
import os
import sys
import socket
import webbrowser

PORT = 8765
APK_NAME = "app-debug.apk"
APK_PATH = os.path.join(os.path.dirname(__file__),
                        "app", "build", "outputs", "apk", "debug", APK_NAME)

# --- find local Wi-Fi IP ---
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()

LOCAL_IP = get_local_ip()
DOWNLOAD_URL = f"http://{LOCAL_IP}:{PORT}/{APK_NAME}"

# QR code is generated via a free API (no library needed)
QR_IMG_URL = (
    f"https://api.qrserver.com/v1/create-qr-code/"
    f"?size=280x280&data={DOWNLOAD_URL}&color=4F8EF7&bgcolor=060D1A&margin=2"
)

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LostLink AI — Install APK</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',sans-serif;background:#060D1A;color:#F1F5F9;min-height:100vh;
      display:flex;align-items:center;justify-content:center;padding:24px}}
    .card{{background:linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));
      border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 32px;
      max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.6)}}
    .logo{{width:64px;height:64px;background:linear-gradient(135deg,#4F8EF7,#2563EB);
      border-radius:18px;display:flex;align-items:center;justify-content:center;
      font-size:22px;font-weight:900;color:#fff;margin:0 auto 20px;
      box-shadow:0 8px 32px rgba(79,142,247,0.45)}}
    h1{{font-size:24px;font-weight:800;margin-bottom:6px}}
    .sub{{font-size:13px;color:#64748B;margin-bottom:28px;line-height:1.5}}
    .qr-box{{background:#060D1A;border:2px solid rgba(79,142,247,0.3);border-radius:16px;
      padding:16px;display:inline-block;margin-bottom:24px}}
    .qr-box img{{display:block;border-radius:8px}}
    .url-box{{background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);
      border-radius:10px;padding:10px 14px;font-size:12px;color:#7AACFF;
      word-break:break-all;margin-bottom:24px}}
    .steps{{text-align:left;margin-bottom:28px}}
    .step{{display:flex;align-items:flex-start;gap:12px;padding:10px 0;
      border-bottom:1px solid rgba(255,255,255,0.05)}}
    .step:last-child{{border-bottom:none}}
    .step-num{{width:26px;height:26px;background:linear-gradient(135deg,#4F8EF7,#2563EB);
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;flex-shrink:0;margin-top:1px}}
    .step-text{{font-size:13px;color:#94A3B8;line-height:1.5}}
    .step-text strong{{color:#F1F5F9}}
    .dl-btn{{display:block;background:linear-gradient(135deg,#4F8EF7,#2563EB);
      color:#fff;font-size:14px;font-weight:700;padding:14px 24px;border-radius:14px;
      text-decoration:none;box-shadow:0 8px 32px rgba(79,142,247,0.4);
      transition:opacity 0.2s}}
    .dl-btn:hover{{opacity:0.88}}
    .note{{font-size:11px;color:#475569;margin-top:16px;line-height:1.5}}
    .badge{{display:inline-block;background:rgba(46,213,115,0.15);border:1px solid rgba(46,213,115,0.3);
      color:#2ED573;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">LL</div>
    <div class="badge">✓ Build Successful</div>
    <h1>LostLink AI</h1>
    <p class="sub">RV University Campus Lost &amp; Found<br>Scan to install on your Android phone</p>

    <div class="qr-box">
      <img src="{QR_IMG_URL}" width="248" height="248" alt="QR Code to download APK">
    </div>

    <div class="url-box">📡 {DOWNLOAD_URL}</div>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Same Wi-Fi required</strong><br>Make sure your phone is on the same Wi-Fi network as this PC</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Scan the QR code</strong><br>Use your phone's camera or any QR scanner app</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Allow unknown apps</strong><br>Settings → Security → Install Unknown Apps → enable for your browser</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text"><strong>Tap Install</strong><br>Open the downloaded APK and tap Install</div>
      </div>
    </div>

    <a href="/{APK_NAME}" class="dl-btn" download>⬇ Download APK (direct)</a>
    <p class="note">Keep this window open while downloading on your phone.<br>
    APK size: ~2.6 MB · Android 8.0+ required</p>
  </div>
</body>
</html>"""

class APKHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML.encode("utf-8"))
        elif self.path == f"/{APK_NAME}":
            if not os.path.exists(APK_PATH):
                self.send_error(404, "APK not found — build first")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.android.package-archive")
            self.send_header("Content-Disposition", f'attachment; filename="{APK_NAME}"')
            self.send_header("Content-Length", str(os.path.getsize(APK_PATH)))
            self.end_headers()
            with open(APK_PATH, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        print(f"[LostLink Server] {self.address_string()} - {format % args}")

if __name__ == "__main__":
    if not os.path.exists(APK_PATH):
        print(f"❌ APK not found at: {APK_PATH}")
        print("   Run: gradlew.bat :app:assembleDebug  first")
        sys.exit(1)

    with socketserver.TCPServer(("", PORT), APKHandler) as httpd:
        print(f"\n{'='*55}")
        print(f"  🚀 LostLink AI — APK Install Server")
        print(f"{'='*55}")
        print(f"  📡 Open on your PC:   http://localhost:{PORT}")
        print(f"  📲 Scan on your phone: http://{LOCAL_IP}:{PORT}")
        print(f"{'='*55}")
        print(f"  Keep this window open while your phone downloads.")
        print(f"  Press Ctrl+C to stop.\n")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✅ Server stopped.")
