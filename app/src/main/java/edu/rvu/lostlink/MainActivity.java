package edu.rvu.lostlink;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.util.Base64;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import org.json.JSONObject;

/**
 * LostLink AI — Main Activity v2.0
 *
 * <p>Thin Android shell that hosts a WebView loading the HTML/CSS/JS campus
 * lost-and-found interface. Native capabilities (photo picker, Google Sign-In,
 * Google Maps directions, SQLite) are exposed to the web layer through
 * {@link WebAppBridge}.</p>
 *
 * <p>Note: {@code startActivityForResult} / {@code onActivityResult} are used
 * intentionally to avoid pulling in the full androidx.activity dependency for
 * this minimal project. Suppression annotations are applied where needed.</p>
 */
@SuppressWarnings("deprecation")
public final class MainActivity extends Activity {

    private static final int RC_PHOTO       = 1001;
    private static final int RC_GOOGLE_SIGN = 1002;

    private WebView          webView;
    private ProgressBar      progressBar;
    private GoogleSignInClient googleClient;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Switch from splash theme to real app theme after super.onCreate.
        // The windowBackground transitions from splash_screen drawable to the
        // WebView content seamlessly.
        setTheme(R.style.Theme_LostLink);

        setContentView(R.layout.activity_main);

        webView     = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progress);

        googleClient = GoogleSignIn.getClient(this,
                new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestEmail()
                        .requestProfile()
                        .build());

        configureWebView();
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        String uriStr = uri.toString();
        if (uriStr.contains("access_token=")) {
            String fragment = uri.getFragment();
            if (fragment == null && uriStr.contains("#")) {
                fragment = uriStr.substring(uriStr.indexOf('#') + 1);
            }
            if (fragment != null && !fragment.isEmpty()) {
                if (webView != null) {
                    webView.loadUrl("file:///android_asset/index.html#" + fragment);
                }
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // -------------------------------------------------------------------------
    // WebView configuration
    // -------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        final WebSettings settings = webView.getSettings();

        // JavaScript is required for the app UI
        settings.setJavaScriptEnabled(true);

        // DOM storage needed for localStorage (user/report persistence fallback)
        settings.setDomStorageEnabled(true);

        // Allow reading local asset files (index.html, app.js, styles.css)
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Disallow cross-origin file access for security
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        // Allow mixed content so Leaflet CDN tiles (HTTPS) load from file:// page
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        // Enable viewport meta tag support (responsive design)
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Strip "; wv" and "Version/4.0" so Google OAuth recognizes WebView as a standard Chrome mobile browser
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null) {
            String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version\\/\\d+\\.\\d+\\s?", "");
            settings.setUserAgentString(cleanUa);
        }

        // WebChromeClient for JS console messages (useful during development)
        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return handleExternalUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Hide the loading spinner once the page has loaded
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        // Register the native ↔ JavaScript bridge
        webView.addJavascriptInterface(
                new WebAppBridge(this, new ReportDatabase(this)),
                "LostLinkNative"
        );

        // Load the app from assets
        webView.loadUrl("file:///android_asset/index.html");
    }

    /**
     * Intercepts URL requests to launch native external apps (WhatsApp, Maps, Dialer, etc.)
     * instead of loading them within the restricted WebView.
     */
    public boolean handleExternalUrl(String url) {
        if (url == null) return false;

        // 1. Phone calls
        if (url.startsWith("tel:")) {
            launchDialer(url.substring(4));
            return true;
        }

        // 2. WhatsApp
        if (url.startsWith("whatsapp:") || url.contains("wa.me") || url.contains("api.whatsapp.com")) {
            String phone = "";
            String text = "";
            try {
                Uri parsed = Uri.parse(url);
                if (url.contains("phone=")) {
                    phone = parsed.getQueryParameter("phone");
                } else if (url.contains("wa.me/")) {
                    String path = parsed.getPath();
                    if (path != null && path.length() > 1) {
                        phone = path.substring(1);
                    }
                }
                text = parsed.getQueryParameter("text");
            } catch (Exception ignored) {}

            launchWhatsApp(phone, text != null ? text : "");
            return true;
        }

        // 3. Google Maps / Directions
        if (url.startsWith("geo:") || url.contains("google.com/maps") || url.contains("maps.google")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.setPackage("com.google.android.apps.maps");
                try {
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    intent.setPackage(null);
                    startActivity(intent);
                    return true;
                }
            } catch (Exception e) {
                Toast.makeText(this, "Could not open Maps: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // 4. Email
        if (url.startsWith("mailto:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception ignored) {
                return true;
            }
        }

        // 5. Allow local asset files inside WebView
        if (url.startsWith("file:///android_asset/")) {
            return false;
        }

        // 6. OAuth redirect handling — catch token redirect from Chrome and load back into WebView
        if (url.startsWith("https://dheeraj-0809.github.io/Lost-and-found-") && url.contains("access_token=")) {
            int hashIndex = url.indexOf('#');
            String hash = hashIndex != -1 ? url.substring(hashIndex + 1) : "";
            webView.loadUrl("file:///android_asset/index.html#" + hash);
            return true;
        }

        // 7. All other external web links (including accounts.google.com) → launch in Chrome browser
        if (url.startsWith("http://") || url.startsWith("https://")) {
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(browserIntent);
                return true;
            } catch (Exception ignored) {
                return true;
            }
        }

        return false;
    }

    /**
     * Directly launches the native WhatsApp application with a pre-filled chat,
     * bypassing the web landing page completely. Supports both WhatsApp and WhatsApp Business.
     */
    public void launchWhatsApp(String phone, String text) {
        try {
            String cleanPhone = phone == null ? "" : phone.replaceAll("[^0-9]", "");
            if (cleanPhone.startsWith("0") && cleanPhone.length() == 11) {
                cleanPhone = cleanPhone.substring(1);
            }
            if (cleanPhone.length() == 10) cleanPhone = "91" + cleanPhone;
            String encodedText = text != null ? Uri.encode(text) : "";

            // Primary: Direct WhatsApp URI scheme (opens exact chat with draft text, NO web landing page)
            Uri waUri = Uri.parse("whatsapp://send?phone=" + cleanPhone + "&text=" + encodedText);
            Intent waIntent = new Intent(Intent.ACTION_VIEW, waUri);
            waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (isPackageInstalled("com.whatsapp")) {
                waIntent.setPackage("com.whatsapp");
                try {
                    startActivity(waIntent);
                    return;
                } catch (Exception ignored) {}
            } else if (isPackageInstalled("com.whatsapp.w4b")) {
                waIntent.setPackage("com.whatsapp.w4b");
                try {
                    startActivity(waIntent);
                    return;
                } catch (Exception ignored) {}
            }

            // Strategy 2: Official api.whatsapp.com App Link with package targeting
            Uri apiUri = Uri.parse("https://api.whatsapp.com/send?phone=" + cleanPhone + "&text=" + encodedText);
            Intent apiIntent = new Intent(Intent.ACTION_VIEW, apiUri);
            apiIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (isPackageInstalled("com.whatsapp")) {
                apiIntent.setPackage("com.whatsapp");
                try {
                    startActivity(apiIntent);
                    return;
                } catch (Exception ignored) {}
            } else if (isPackageInstalled("com.whatsapp.w4b")) {
                apiIntent.setPackage("com.whatsapp.w4b");
                try {
                    startActivity(apiIntent);
                    return;
                } catch (Exception ignored) {}
            }

            // Strategy 3: Generic WhatsApp URI scheme without package targeting (Dual Messenger / clone apps)
            try {
                Intent genericWaIntent = new Intent(Intent.ACTION_VIEW, waUri);
                genericWaIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(genericWaIntent);
                return;
            } catch (Exception ignored) {}

            // Strategy 4: Generic api.whatsapp.com intent
            try {
                Intent genericApiIntent = new Intent(Intent.ACTION_VIEW, apiUri);
                genericApiIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(genericApiIntent);
                return;
            } catch (Exception ignored) {}

            // Do NOT open browser wa.me which prompts downloading WhatsApp!
            Toast.makeText(this, "WhatsApp is not installed on this device.", Toast.LENGTH_SHORT).show();

        } catch (Exception e) {
            Toast.makeText(this, "Could not open WhatsApp: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public String getDevicePhoneNumber() {
        android.content.SharedPreferences prefs = getSharedPreferences("lostlink_prefs", MODE_PRIVATE);
        return prefs.getString("device_phone", "9032027202");
    }

    public boolean isDevicePhoneNumber(String phone) {
        if (phone == null) return false;
        String clean = phone.replaceAll("[^0-9]", "");
        if (clean.length() == 12 && clean.startsWith("91")) clean = clean.substring(2);
        return clean.equals(getDevicePhoneNumber());
    }

    /**
     * Directly launches the native Messages app with target phone and prefilled SMS text.
     */
    public void launchNativeSmsApp(String phone, String message) {
        try {
            String cleanPhone = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
            Intent intent = new Intent(Intent.ACTION_SENDTO);
            intent.setData(Uri.parse("smsto:" + cleanPhone));
            if (message != null && !message.isEmpty()) {
                intent.putExtra("sms_body", message);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open Messages app: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Dispatches verification SMS via the native Messages app without requiring
     * dangerous background SEND_SMS device permissions.
     */
    public void sendNativeSms(String phone, String message) {
        launchNativeSmsApp(phone, message);
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * Directly launches the native phone dialer with the target phone number.
     */
    public void launchDialer(String phone) {
        try {
            String cleanPhone = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
            if (!cleanPhone.startsWith("+") && cleanPhone.length() == 10) {
                cleanPhone = "+91" + cleanPhone;
            }
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + cleanPhone));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open phone dialer: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Directly launches the Google Maps app pointing to target coordinates.
     */
    public void launchMaps(double lat, double lng, String label) {
        try {
            // geo URI opens the Google Maps application directly without web interstitial
            Uri gmmIntentUri = Uri.parse("geo:" + lat + "," + lng + "?q=" + lat + "," + lng + "(" + Uri.encode(label) + ")");
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (isPackageInstalled("com.google.android.apps.maps")) {
                mapIntent.setPackage("com.google.android.apps.maps");
            }
            try {
                startActivity(mapIntent);
                return;
            } catch (Exception ignored) {
                // Try system resolver for geo URI
                try {
                    Intent genericGeo = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
                    genericGeo.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(genericGeo);
                    return;
                } catch (Exception ignored2) {}
            }

            // Fallback to web directions in external browser
            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng));
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(webIntent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open Maps: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    // -------------------------------------------------------------------------
    // Native feature entry points (called by WebAppBridge on UI thread)
    // -------------------------------------------------------------------------

    /**
     * Opens the system document picker so the user can select an item photo.
     * Result is delivered to {@link #onActivityResult}.
     */
    public void openPhotoPicker() {
        final Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, RC_PHOTO);
    }

    /**
     * Signs out any cached Google account then launches the Google account
     * picker. Signing out first forces the user to actively choose an account
     * on every sign-in attempt (campus security requirement).
     */
    public void openWebAuth(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open browser: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public void openGoogleSignIn() {
        String authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
                "client_id=303643726402-jsrpa3pb38ovlquk9dmvnn20b1cu3e97.apps.googleusercontent.com" +
                "&redirect_uri=" + Uri.encode("https://dheeraj-0809.github.io/Lost-and-found-/") +
                "&response_type=token" +
                "&scope=" + Uri.encode("email profile") +
                "&prompt=select_account" +
                "&hd=rvu.edu.in";
        try {
            openWebAuth(authUrl);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open Google Sign-in: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    // -------------------------------------------------------------------------
    // Activity result handling
    // -------------------------------------------------------------------------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == RC_PHOTO) {
            if (resultCode == RESULT_OK && data != null) {
                onPhotoSelected(data.getData());
            }
            return;
        }

        if (requestCode == RC_GOOGLE_SIGN) {
            handleGoogleSignInResult(GoogleSignIn.getSignedInAccountFromIntent(data));
        }
    }

    // -------------------------------------------------------------------------
    // Private result processors
    // -------------------------------------------------------------------------

    private void handleGoogleSignInResult(Task<GoogleSignInAccount> task) {
        try {
            final GoogleSignInAccount account = task.getResult(ApiException.class);
            final JSONObject payload = new JSONObject();
            payload.put("ok",       true);
            payload.put("name",     account.getDisplayName() == null ? "" : account.getDisplayName());
            payload.put("email",    account.getEmail()       == null ? "" : account.getEmail());
            payload.put("photoUrl", account.getPhotoUrl()    == null ? "" : account.getPhotoUrl().toString());
            evaluateJs("window.onNativeGoogleSignIn(" + payload + ")");
        } catch (Exception e) {
            String msg = "Google sign-in failed";
            if (e instanceof ApiException) {
                int statusCode = ((ApiException) e).getStatusCode();
                if (statusCode == 10) {
                    msg = "Google Error (10: DEVELOPER_ERROR) - Please add your SHA-1 key to Firebase console.";
                } else if (statusCode == 12500) {
                    msg = "Google Error (12500: Configuration Error) - Check your Firebase setup or SHA-1.";
                } else if (statusCode == 7) {
                    msg = "Network Error (7) - Please check your internet connection.";
                } else {
                    msg = "Google Sign-in Error (" + statusCode + ")";
                }
            } else {
                msg = e.getMessage() != null ? e.getMessage() : "Google sign-in failed or cancelled";
            }
            final JSONObject payload = new JSONObject();
            try {
                payload.put("ok",      false);
                payload.put("message", msg);
            } catch (Exception ignored) { /* no-op */ }
            evaluateJs("window.onNativeGoogleSignIn(" + payload + ")");
        }
    }

    private void onPhotoSelected(Uri uri) {
        if (uri == null) return;
        try {
            getContentResolver().takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Session-only access
        }

        new Thread(() -> {
            try {
                InputStream inputStream = getContentResolver().openInputStream(uri);
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                if (inputStream != null) inputStream.close();

                if (bitmap != null) {
                    int maxDim = 800;
                    int width = bitmap.getWidth();
                    int height = bitmap.getHeight();
                    if (width > maxDim || height > maxDim) {
                        float ratio = Math.min((float) maxDim / width, (float) maxDim / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                        bitmap = Bitmap.createScaledBitmap(bitmap, width, height, true);
                    }

                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream);
                    byte[] bytes = outputStream.toByteArray();
                    String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    String dataUrl = "data:image/jpeg;base64," + base64;

                    evaluateJs("window.onNativePhotoSelected(" + JSONObject.quote(dataUrl) + ")");
                } else {
                    evaluateJs("window.onNativePhotoSelected(" + JSONObject.quote(uri.toString()) + ")");
                }
            } catch (Exception e) {
                evaluateJs("window.onNativePhotoSelected(" + JSONObject.quote(uri.toString()) + ")");
            }
        }).start();
    }

    /**
     * Safely calls a JavaScript expression on the WebView's UI thread.
     */
    private void evaluateJs(final String script) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
