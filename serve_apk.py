"""
LostLink AI — Multi-Device Testing Server (Android + iPhone)
Serves both:
  1. The Android APK (for Android phones)
  2. The Live Web App (for iPhones / Safari / iPads / browsers)
All with QR codes for instant scanning on your local Wi-Fi.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import http.server
import socketserver
import os
import sys
import socket
import webbrowser
import mimetypes
import urllib.parse

PORT = 8765
APK_NAME = "app-debug.apk"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APK_PATH = os.path.join(ROOT_DIR, "app", "build", "outputs", "apk", "debug", APK_NAME)
ASSETS_DIR = os.path.join(ROOT_DIR, "app", "src", "main", "assets")

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

LOCAL_IP = get_local_ip()
DOWNLOAD_URL = f"http://{LOCAL_IP}:{PORT}/{APK_NAME}"
WEB_APP_URL = f"http://{LOCAL_IP}:{PORT}/app/"

QR_APK_URL = (
    f"https://api.qrserver.com/v1/create-qr-code/"
    f"?size=240x240&data={urllib.parse.quote(DOWNLOAD_URL)}&color=2563EB&bgcolor=060D1A&margin=2"
)
QR_WEB_URL = (
    f"https://api.qrserver.com/v1/create-qr-code/"
    f"?size=240x240&data={urllib.parse.quote(WEB_APP_URL)}&color=10B981&bgcolor=060D1A&margin=2"
)

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LostLink AI — Cross-Device Test Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',sans-serif;background:#060D1A;color:#F1F5F9;min-height:100vh;
      display:flex;flex-direction:column;align-items:center;padding:32px 16px}}
    .header{{text-align:center;max-width:640px;margin-bottom:32px}}
    .logo{{width:64px;height:64px;background:linear-gradient(135deg,#4F8EF7,#2563EB);
      border-radius:18px;display:flex;align-items:center;justify-content:center;
      font-size:24px;font-weight:900;color:#fff;margin:0 auto 16px;
      box-shadow:0 8px 32px rgba(79,142,247,0.45)}}
    h1{{font-size:28px;font-weight:800;margin-bottom:8px}}
    .sub{{font-size:14px;color:#94A3B8;line-height:1.6}}
    .wifi-badge{{display:inline-flex;align-items:center;gap:6px;background:rgba(79,142,247,0.12);
      border:1px solid rgba(79,142,247,0.3);color:#7AACFF;font-size:12px;font-weight:600;
      padding:6px 14px;border-radius:999px;margin-top:12px}}
    .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;
      max-width:880px;width:100%;margin-bottom:32px}}
    .card{{background:linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02));
      border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px 24px;
      display:flex;flex-direction:column;align-items:center;text-align:center;
      box-shadow:0 24px 80px rgba(0,0,0,0.5);transition:border-color 0.2s}}
    .card:hover{{border-color:rgba(255,255,255,0.18)}}
    .card.ios{{border-top:3px solid #10B981}}
    .card.android{{border-top:3px solid #3B82F6}}
    .device-tag{{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
      padding:4px 10px;border-radius:6px;margin-bottom:12px}}
    .ios .device-tag{{background:rgba(16,185,129,0.15);color:#34D399}}
    .android .device-tag{{background:rgba(59,130,246,0.15);color:#60A5FA}}
    .card-title{{font-size:20px;font-weight:700;margin-bottom:6px}}
    .card-sub{{font-size:13px;color:#64748B;margin-bottom:20px;line-height:1.4}}
    .qr-box{{background:#060D1A;border:2px solid rgba(255,255,255,0.08);border-radius:16px;
      padding:14px;margin-bottom:18px}}
    .qr-box img{{display:block;border-radius:8px}}
    .url-box{{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:8px 12px;font-size:12px;color:#94A3B8;
      word-break:break-all;margin-bottom:20px;font-family:monospace}}
    .action-btn{{display:block;width:100%;font-size:14px;font-weight:700;padding:12px 20px;
      border-radius:12px;text-decoration:none;transition:transform 0.1s, opacity 0.2s;text-align:center}}
    .action-btn:hover{{opacity:0.9;transform:translateY(-1px)}}
    .ios .action-btn{{background:linear-gradient(135deg,#10B981,#059669);color:#fff;
      box-shadow:0 8px 24px rgba(16,185,129,0.35)}}
    .android .action-btn{{background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;
      box-shadow:0 8px 24px rgba(59,130,246,0.35)}}
    .steps{{text-align:left;width:100%;margin-top:20px;padding-top:16px;
      border-top:1px solid rgba(255,255,255,0.06)}}
    .step{{font-size:12px;color:#94A3B8;line-height:1.5;margin-bottom:8px;display:flex;gap:8px}}
    .step strong{{color:#F1F5F9}}
    .sync-card{{max-width:880px;width:100%;background:rgba(79,142,247,0.04);
      border:1px solid rgba(79,142,247,0.2);border-radius:20px;padding:24px;text-align:left}}
    .sync-card h3{{font-size:16px;font-weight:700;color:#7AACFF;margin-bottom:8px;
      display:flex;align-items:center;gap:8px}}
    .sync-card p{{font-size:13px;color:#94A3B8;line-height:1.6}}
    .sync-card ol{{margin-left:20px;margin-top:8px;font-size:13px;color:#CBD5E1;line-height:1.6}}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">LL</div>
    <h1>LostLink AI Test Portal</h1>
    <p class="sub">RV University Campus Lost &amp; Found · Test simultaneously on iPhone and Android</p>
    <div class="wifi-badge">
      <span>📶 Both phones must be connected to the same Wi-Fi: <strong>{LOCAL_IP}</strong></span>
    </div>
  </div>

  <div class="grid">
    <!-- iPhone Card -->
    <div class="card ios">
      <div class="device-tag">🍏 For iPhone / iPad</div>
      <div class="card-title">Launch Web App</div>
      <p class="card-sub">Runs directly in iOS Safari with instant cloud sync (no APK required)</p>

      <div class="qr-box">
        <img src="{QR_WEB_URL}" width="200" height="200" alt="QR Code to open Web App on iPhone">
      </div>

      <div class="url-box">{WEB_APP_URL}</div>

      <a href="/app/" target="_blank" class="action-btn">🚀 Open Web App in Safari</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Scan the QR code with your iPhone camera</span></div>
        <div class="step"><span>2.</span><span>Tap the link to open in Safari</span></div>
        <div class="step"><span>3.</span><span><strong>Pro tip:</strong> Tap Share ⎋ → <em>Add to Home Screen</em> to use it like a full-screen native app!</span></div>
      </div>
    </div>

    <!-- Android Card -->
    <div class="card android">
      <div class="device-tag">🤖 For Android Phone</div>
      <div class="card-title">Install Native APK</div>
      <p class="card-sub">Install the full native Android app package (~2.6 MB, Android 8.0+)</p>

      <div class="qr-box">
        <img src="{QR_APK_URL}" width="200" height="200" alt="QR Code to download APK on Android">
      </div>

      <div class="url-box">{DOWNLOAD_URL}</div>

      <a href="/{APK_NAME}" class="action-btn" download>⬇ Download APK</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Scan QR code with your Android camera or browser</span></div>
        <div class="step"><span>2.</span><span>Tap Download APK and open the downloaded file</span></div>
        <div class="step"><span>3.</span><span>Allow <em>Install unknown apps</em> if prompted, then tap <strong>Install</strong></span></div>
      </div>
    </div>
  </div>

  <div class="sync-card">
    <h3>🔄 Cross-Device Live Test:</h3>
    <p>Both devices are connected to the same Firebase Realtime Database. Here's how to verify real-time matching between your iPhone and Android phone:</p>
    <ol>
      <li><strong>On iPhone:</strong> Sign in with an RVU email (e.g. <code>alice@rvu.edu.in</code>). Go to <strong>Report Lost</strong> and report an item (e.g. <em>Black Backpack</em> at <em>RVU Library</em>).</li>
      <li><strong>On Android:</strong> Sign in with another RVU email (e.g. <code>bob@rvu.edu.in</code>). Go to <strong>Report Found</strong> and submit a matching item (e.g. <em>Black Backpack</em> at <em>RVU Library</em>).</li>
      <li><strong>Watch the magic:</strong> The AI matching engine will detect the match, and both phones will instantly receive match notifications with each other's contact details!</li>
    </ol>
  </div>
</body>
</html>"""

class LostLinkHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        clean_path = parsed.path

        # Root: Landing Portal
        if clean_path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML.encode("utf-8"))
            return

        # APK Download
        if clean_path == f"/{APK_NAME}":
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
            return

        # Web App route: /app or /app/
        if clean_path == "/app":
            self.send_response(301)
            self.send_header("Location", "/app/")
            self.end_headers()
            return

        if clean_path.startswith("/app/"):
            rel_file = clean_path[len("/app/"):].strip()
            if not rel_file or rel_file == "index.html":
                file_target = os.path.join(ASSETS_DIR, "index.html")
            else:
                # Sanitize to prevent path traversal
                clean_rel = os.path.normpath(rel_file).lstrip(r"\/")
                file_target = os.path.join(ASSETS_DIR, clean_rel)

            if os.path.exists(file_target) and os.path.isfile(file_target):
                ctype, _ = mimetypes.guess_type(file_target)
                if not ctype:
                    ctype = "application/octet-stream"
                if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
                    ctype += "; charset=utf-8"

                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(os.path.getsize(file_target)))
                self.end_headers()
                with open(file_target, "rb") as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "File not found in web assets")
                return

        self.send_error(404, "Not Found")

    def log_message(self, format, *args):
        print(f"[LostLink Server] {self.address_string()} - {format % args}")

if __name__ == "__main__":
    if not os.path.exists(APK_PATH):
        print(f"⚠️  Note: APK not found at {APK_PATH}.")
        print("   If you want the native Android APK, run: gradlew.bat :app:assembleDebug")
    else:
        print(f"✅ Debug APK found: {os.path.getsize(APK_PATH):,} bytes")

    if not os.path.exists(ASSETS_DIR):
        print(f"❌ Assets folder missing at: {ASSETS_DIR}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  🚀 LostLink AI — Cross-Device Test Server")
    print(f"{'='*60}")
    print(f"  📡 PC Portal:          http://localhost:{PORT}")
    print(f"  🍏 iPhone / Safari:    {WEB_APP_URL}")
    print(f"  🤖 Android APK:        {DOWNLOAD_URL}")
    print(f"{'='*60}")
    print(f"  Make sure both phones and PC are on the same Wi-Fi.")
    print(f"  Press Ctrl+C in this terminal to stop the server.\n")

    webbrowser.open(f"http://localhost:{PORT}")

    with socketserver.TCPServer(("", PORT), LostLinkHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✅ Server stopped.")
