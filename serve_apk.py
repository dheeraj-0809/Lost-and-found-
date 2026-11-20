"""
LostLink AI — Cross-Device Test Server (Android + iPhone)
Provides:
  1. Universal Cloud QR Codes (100% works anywhere on iPhone & Android, no firewall/Wi-Fi blocks)
  2. Local Wi-Fi Server (Offline development fallback)
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
APK_NAME = "LostLink-AI.apk"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APK_PATH = os.path.join(ROOT_DIR, APK_NAME)
if not os.path.exists(APK_PATH):
    APK_PATH = os.path.join(ROOT_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")

ASSETS_DIR = os.path.join(ROOT_DIR, "app", "src", "main", "assets")
DOCS_DIR = os.path.join(ROOT_DIR, "docs")

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

# --- Universal Cloud URLs (Global HTTPS CDN — 100% works on iPhone Safari & Android Chrome) ---
CLOUD_WEB_URL = "https://raw.githack.com/dheeraj-0809/Lost-and-found-/main/docs/index.html"
GITHUB_PAGES_URL = "https://dheeraj-0809.github.io/Lost-and-found-/"
CLOUD_APK_URL = "https://github.com/dheeraj-0809/Lost-and-found-/raw/main/LostLink-AI.apk"

# --- Local Wi-Fi URLs ---
LOCAL_WEB_URL = f"http://{LOCAL_IP}:{PORT}/app/"
LOCAL_APK_URL = f"http://{LOCAL_IP}:{PORT}/{APK_NAME}"

# QR Codes via fast CDN
QR_CLOUD_WEB = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(CLOUD_WEB_URL)}&color=10B981&bgcolor=060D1A&margin=2"
QR_CLOUD_APK = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(CLOUD_APK_URL)}&color=2563EB&bgcolor=060D1A&margin=2"

QR_LOCAL_WEB = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(LOCAL_WEB_URL)}&color=10B981&bgcolor=060D1A&margin=2"
QR_LOCAL_APK = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(LOCAL_APK_URL)}&color=2563EB&bgcolor=060D1A&margin=2"

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LostLink AI — Mobile Test Hub</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',sans-serif;background:#060D1A;color:#F1F5F9;min-height:100vh;
      display:flex;flex-direction:column;align-items:center;padding:36px 16px}}
    .header{{text-align:center;max-width:680px;margin-bottom:28px}}
    .logo{{width:68px;height:68px;background:linear-gradient(135deg,#4F8EF7,#2563EB);
      border-radius:20px;display:flex;align-items:center;justify-content:center;
      font-size:26px;font-weight:900;color:#fff;margin:0 auto 16px;
      box-shadow:0 8px 32px rgba(79,142,247,0.45)}}
    h1{{font-size:30px;font-weight:800;letter-spacing:-0.5px;margin-bottom:8px}}
    .sub{{font-size:14px;color:#94A3B8;line-height:1.6}}

    .tabs-bar{{display:flex;background:rgba(255,255,255,0.06);padding:4px;border-radius:14px;
      margin:20px 0 28px;border:1px solid rgba(255,255,255,0.08)}}
    .tab-btn{{padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;color:#94A3B8;
      border:none;background:transparent;cursor:pointer;transition:all 0.2s}}
    .tab-btn.active{{background:#2563EB;color:#fff;box-shadow:0 4px 16px rgba(37,99,235,0.4)}}

    .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:24px;
      max-width:920px;width:100%;margin-bottom:32px}}
    .card{{background:linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02));
      border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px 24px;
      display:flex;flex-direction:column;align-items:center;text-align:center;
      box-shadow:0 24px 80px rgba(0,0,0,0.5);position:relative}}
    .card.ios{{border-top:4px solid #10B981}}
    .card.android{{border-top:4px solid #3B82F6}}
    .device-tag{{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
      padding:4px 12px;border-radius:8px;margin-bottom:14px}}
    .ios .device-tag{{background:rgba(16,185,129,0.15);color:#34D399}}
    .android .device-tag{{background:rgba(59,130,246,0.15);color:#60A5FA}}
    .card-title{{font-size:22px;font-weight:700;margin-bottom:6px}}
    .card-sub{{font-size:13px;color:#64748B;margin-bottom:20px;line-height:1.4}}
    .qr-box{{background:#060D1A;border:2px solid rgba(255,255,255,0.08);border-radius:18px;
      padding:14px;margin-bottom:18px;display:flex;justify-content:center}}
    .qr-box img{{display:block;border-radius:10px}}
    .url-box{{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:10px 14px;font-size:12px;color:#94A3B8;
      word-break:break-all;margin-bottom:18px;font-family:monospace;width:100%}}
    .action-btn{{display:block;width:100%;font-size:14px;font-weight:700;padding:14px 20px;
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

    .badge-cloud{{background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);
      color:#34D399;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px}}
    .badge-wifi{{background:rgba(245,183,49,0.12);border:1px solid rgba(245,183,49,0.3);
      color:#F5B731;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px}}

    .sync-card{{max-width:920px;width:100%;background:rgba(79,142,247,0.05);
      border:1px solid rgba(79,142,247,0.25);border-radius:22px;padding:26px;text-align:left}}
    .sync-card h3{{font-size:17px;font-weight:700;color:#7AACFF;margin-bottom:10px;
      display:flex;align-items:center;gap:8px}}
    .sync-card p{{font-size:13px;color:#94A3B8;line-height:1.6}}
    .sync-card ol{{margin-left:22px;margin-top:10px;font-size:13px;color:#CBD5E1;line-height:1.7}}

    .firewall-alert{{max-width:920px;width:100%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);
      border-radius:14px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#FCA5A5;line-height:1.6}}
    .firewall-alert code{{background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;color:#fff}}
    .hidden{{display:none !important}}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">LL</div>
    <h1>LostLink AI Mobile Testing Hub</h1>
    <p class="sub">RV University Lost &amp; Found · Test simultaneously on iPhone and Android</p>

    <div class="tabs-bar">
      <button class="tab-btn active" id="tabCloudBtn" onclick="switchTab('cloud')">🌐 Cloud Access (Recommended)</button>
      <button class="tab-btn" id="tabLocalBtn" onclick="switchTab('local')">📶 Local Wi-Fi Network</button>
    </div>
  </div>

  <!-- VIEW 1: CLOUD ACCESS (Guaranteed to work on iPhone Safari & Android with NO firewall blocks) -->
  <div id="cloudView" class="grid">
    <!-- iPhone Cloud Card -->
    <div class="card ios">
      <span class="badge-cloud">⚡ Works on Any Network (HTTPS)</span>
      <div class="device-tag">🍏 For iPhone / Safari</div>
      <div class="card-title">Open Web App</div>
      <p class="card-sub">Point your iPhone camera at this QR code. Opens directly in Safari with full Google SSO &amp; Camera support.</p>

      <div class="qr-box">
        <img src="{QR_CLOUD_WEB}" width="220" height="220" alt="QR Code for iPhone Web App">
      </div>

      <div class="url-box">{CLOUD_WEB_URL}</div>

      <a href="{CLOUD_WEB_URL}" target="_blank" class="action-btn">🚀 Open in Browser Now</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Open <strong>Camera app</strong> on iPhone and scan this QR code</span></div>
        <div class="step"><span>2.</span><span>Tap the yellow Safari link banner to open LostLink AI</span></div>
        <div class="step"><span>3.</span><span><strong>Pro Tip:</strong> Tap Share ⎋ → <em>Add to Home Screen</em> to use it like a full-screen app!</span></div>
      </div>
    </div>

    <!-- Android Cloud Card -->
    <div class="card android">
      <span class="badge-cloud">⚡ Fast GitHub CDN Download</span>
      <div class="device-tag">🤖 For Android Phone</div>
      <div class="card-title">Download Android APK</div>
      <p class="card-sub">Point your Android camera or QR scanner at this code. Chrome downloads the APK directly from GitHub.</p>

      <div class="qr-box">
        <img src="{QR_CLOUD_APK}" width="220" height="220" alt="QR Code for Android APK">
      </div>

      <div class="url-box">{CLOUD_APK_URL}</div>

      <a href="{CLOUD_APK_URL}" target="_blank" class="action-btn">⬇ Download APK (~2.7 MB)</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Scan the QR code with your phone camera or browser</span></div>
        <div class="step"><span>2.</span><span>Tap Download APK and open the downloaded package</span></div>
        <div class="step"><span>3.</span><span>Tap <strong>Install</strong> (enable <em>Install unknown apps</em> if prompted)</span></div>
      </div>
    </div>
  </div>

  <!-- VIEW 2: LOCAL WI-FI ACCESS -->
  <div id="localView" class="grid hidden">
    <!-- iPhone Local Card -->
    <div class="card ios">
      <span class="badge-wifi">📶 Local Wi-Fi ({LOCAL_IP})</span>
      <div class="device-tag">🍏 iPhone (Local Wi-Fi)</div>
      <div class="card-title">Safari via Local IP</div>
      <p class="card-sub">Must be on the exact same Wi-Fi router. Requires Windows Firewall to allow port {PORT}.</p>

      <div class="qr-box">
        <img src="{QR_LOCAL_WEB}" width="220" height="220" alt="Local Wi-Fi QR Code for iPhone">
      </div>

      <div class="url-box">{LOCAL_WEB_URL}</div>

      <a href="/app/" target="_blank" class="action-btn">🚀 Open Local App</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Connect iPhone to Wi-Fi <strong>{LOCAL_IP}</strong></span></div>
        <div class="step"><span>2.</span><span>Scan QR code with iPhone Camera</span></div>
      </div>
    </div>

    <!-- Android Local Card -->
    <div class="card android">
      <span class="badge-wifi">📶 Local Wi-Fi ({LOCAL_IP})</span>
      <div class="device-tag">🤖 Android (Local Wi-Fi)</div>
      <div class="card-title">APK via Local IP</div>
      <p class="card-sub">Download APK directly from your computer over the local network.</p>

      <div class="qr-box">
        <img src="{QR_LOCAL_APK}" width="220" height="220" alt="Local Wi-Fi QR Code for Android">
      </div>

      <div class="url-box">{LOCAL_APK_URL}</div>

      <a href="/{APK_NAME}" class="action-btn" download>⬇ Download from PC</a>

      <div class="steps">
        <div class="step"><span>1.</span><span>Connect Android to Wi-Fi <strong>{LOCAL_IP}</strong></span></div>
        <div class="step"><span>2.</span><span>Scan QR code and tap Install</span></div>
      </div>
    </div>
  </div>

  <div class="sync-card">
    <h3>🎯 How to Test End-to-End on Both Mobiles:</h3>
    <p>Both devices connect in real-time to the campus Firebase database. Test the complete cycle in 60 seconds:</p>
    <ol>
      <li><strong>On iPhone:</strong> Scan the green QR code, sign in with your RVU email (e.g. <code>alice@rvu.edu.in</code>). Tap <strong>Report Lost</strong>, enter item: <em>"Navy Blue Dell Backpack"</em> at <em>"RVU Library"</em>, attach photo, and tap Publish.</li>
      <li><strong>On Android Phone:</strong> Scan the blue QR code, install APK, sign in with your RVU email (e.g. <code>bob@rvu.edu.in</code>). Tap <strong>Report Found</strong>, enter: <em>"Navy Blue Backpack"</em> at <em>"RVU Library"</em>, and tap Publish.</li>
      <li><strong>Verify Live Match:</strong> Within seconds, both phones will buzz with a <strong>Match Notification</strong>, show the match confidence score, display the distance between campus locations, and provide a 1-tap <strong>WhatsApp button</strong> to coordinate handoff!</li>
    </ol>
  </div>

  <script>
    function switchTab(mode) {{
      document.getElementById('cloudView').classList.toggle('hidden', mode !== 'cloud');
      document.getElementById('localView').classList.toggle('hidden', mode !== 'local');
      document.getElementById('tabCloudBtn').classList.toggle('active', mode === 'cloud');
      document.getElementById('tabLocalBtn').classList.toggle('active', mode === 'local');
    }}
  </script>
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
        if clean_path in (f"/{APK_NAME}", "/app-debug.apk"):
            if not os.path.exists(APK_PATH):
                self.send_error(404, "APK not found — run build first")
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
    print(f"\n{'='*70}")
    print(f"  🚀 LostLink AI — Multi-Device Testing Server")
    print(f"{'='*70}")
    print(f"  🌐 PC Browser Portal:       http://localhost:{PORT}")
    print(f"  ------------------------------------------------------------------")
    print(f"  🍏 iPhone Direct Link:      {CLOUD_WEB_URL}")
    print(f"  🤖 Android APK Direct Link: {CLOUD_APK_URL}")
    print(f"  ------------------------------------------------------------------")
    print(f"  📶 Local Wi-Fi iPhone:      {LOCAL_WEB_URL}")
    print(f"  📶 Local Wi-Fi Android:     {LOCAL_APK_URL}")
    print(f"{'='*70}")
    print(f"  Scan the QR code on your PC screen with your iPhone Camera or")
    print(f"  Android phone. Keep this terminal window open while testing.")
    print(f"  Press Ctrl+C to stop.\n")

    webbrowser.open(f"http://localhost:{PORT}")

    with socketserver.TCPServer(("", PORT), LostLinkHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✅ Server stopped.")
