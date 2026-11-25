package edu.rvu.lostlink;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest;
import com.google.android.gms.auth.api.identity.Identity;
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
    private static final int RC_PHONE_PERM  = 1003;
    private static final int RC_PHONE_HINT  = 1004;

    private WebView          webView;
    private ProgressBar      progressBar;
    private GoogleSignInClient googleClient;
    private String           pendingSimVerifyPhone = null;

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
        handleDeepLink(getIntent(), false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent, true);
    }

    private void handleDeepLink(Intent intent, boolean isNewIntent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        String uriStr = uri.toString();
        if (uriStr.contains("access_token=")) {
            String fragment = uri.getFragment();
            if (fragment == null && uriStr.contains("#")) {
                fragment = uriStr.substring(uriStr.indexOf('#') + 1);
            }
            if (fragment != null && !fragment.isEmpty() && webView != null) {
                if (isNewIntent) {
                    evaluateJs("window.handleOAuthHash && window.handleOAuthHash(" + JSONObject.quote("#" + fragment) + ")");
                } else {
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

    private static final class SimCheckInfo {
        int activeSimCount = 0;
        boolean simHardwareReady = false;
        final Set<String> simNumbers = new LinkedHashSet<>();
    }

    private String normalizeIndian10(String raw) {
        if (raw == null) return "";
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        } else if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        if (digits.length() == 10 && digits.matches("^[6-9]\\d{9}$")) {
            return digits;
        }
        return "";
    }

    @SuppressLint({"MissingPermission", "HardwareIds"})
    private SimCheckInfo inspectDeviceSims() {
        SimCheckInfo info = new SimCheckInfo();
        TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);

        boolean hasStatePerm = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean hasNumPerm = checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED;

        if (sm != null && (hasStatePerm || hasNumPerm)) {
            try {
                List<SubscriptionInfo> subs = sm.getActiveSubscriptionInfoList();
                if (subs != null) {
                    info.activeSimCount = subs.size();
                    for (SubscriptionInfo sub : subs) {
                        String num = "";
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && hasNumPerm) {
                            try {
                                num = normalizeIndian10(sm.getPhoneNumber(sub.getSubscriptionId()));
                            } catch (Exception ignored) {}
                        }
                        if (num.isEmpty()) {
                            try {
                                num = normalizeIndian10(sub.getNumber());
                            } catch (Exception ignored) {}
                        }
                        if (num.isEmpty() && tm != null) {
                            try {
                                TelephonyManager subTm = tm.createForSubscriptionId(sub.getSubscriptionId());
                                if (subTm != null) {
                                    num = normalizeIndian10(subTm.getLine1Number());
                                }
                            } catch (Exception ignored) {}
                        }
                        if (!num.isEmpty()) {
                            info.simNumbers.add(num);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (tm != null) {
            try {
                int simState = tm.getSimState();
                info.simHardwareReady = (simState != TelephonyManager.SIM_STATE_ABSENT
                        && simState != TelephonyManager.SIM_STATE_UNKNOWN);
                if (!info.simHardwareReady && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    int s0 = tm.getSimState(0);
                    int s1 = tm.getSimState(1);
                    if ((s0 != TelephonyManager.SIM_STATE_ABSENT && s0 != TelephonyManager.SIM_STATE_UNKNOWN)
                            || (s1 != TelephonyManager.SIM_STATE_ABSENT && s1 != TelephonyManager.SIM_STATE_UNKNOWN)) {
                        info.simHardwareReady = true;
                    }
                }
            } catch (Exception ignored) {}

            if (hasNumPerm || hasStatePerm) {
                try {
                    String line1 = normalizeIndian10(tm.getLine1Number());
                    if (!line1.isEmpty()) {
                        info.simNumbers.add(line1);
                    }
                } catch (Exception ignored) {}
            }
        }
        return info;
    }

    public String getDevicePhoneNumber() {
        SimCheckInfo info = inspectDeviceSims();
        if (!info.simNumbers.isEmpty()) {
            return info.simNumbers.iterator().next();
        }
        return "";
    }

    public boolean isDevicePhoneNumber(String phone) {
        String clean = normalizeIndian10(phone);
        if (clean.isEmpty()) return false;
        SimCheckInfo info = inspectDeviceSims();
        return info.simNumbers.contains(clean);
    }

    public void verifyDeviceSimPhone(String phone) {
        String clean = normalizeIndian10(phone);
        if (clean.isEmpty()) {
            notifySimVerifyResult(false, "INVALID_FORMAT", "Please enter a valid 10-digit Indian (+91) mobile number.");
            return;
        }
        pendingSimVerifyPhone = clean;

        boolean hasStatePerm = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean hasNumPerm = checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED;

        if (!hasStatePerm || !hasNumPerm) {
            requestPermissions(
                    new String[]{ Manifest.permission.READ_PHONE_NUMBERS, Manifest.permission.READ_PHONE_STATE },
                    RC_PHONE_PERM
            );
            return;
        }
        performSimVerification(clean);
    }

    private void performSimVerification(String clean) {
        SimCheckInfo info = inspectDeviceSims();
        boolean hasStatePerm = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;

        // 1. Ensure an active SIM is physically/eSIM present in this device
        if (!info.simHardwareReady && (!hasStatePerm || info.activeSimCount == 0)) {
            pendingSimVerifyPhone = null;
            notifySimVerifyResult(false, "NO_SIM", "No active SIM card detected in this device. Please insert the SIM card for +91 " + clean + " and try again.");
            return;
        }
        if (hasStatePerm && info.activeSimCount == 0 && !info.simHardwareReady) {
            pendingSimVerifyPhone = null;
            notifySimVerifyResult(false, "NO_SIM", "No active SIM card detected in this device. Please insert your SIM card first.");
            return;
        }

        // 2. Direct match against SIM slot phone number(s)
        if (info.simNumbers.contains(clean)) {
            pendingSimVerifyPhone = null;
            notifySimVerifyResult(true, "SIM_MATCH", clean);
            return;
        }

        // 3. If all active SIM slots exposed their numbers and none matched, reject immediately
        if (info.activeSimCount > 0 && info.simNumbers.size() >= info.activeSimCount && !info.simNumbers.isEmpty()) {
            pendingSimVerifyPhone = null;
            notifySimVerifyResult(false, "MISMATCH", "Enter the correct mobile number linked to the SIM in this device.");
            return;
        }

        // 4. Fallback for carriers (e.g. Jio/Airtel) that leave SIM EF_MSISDN blank:
        //    Verify using Google Play Services Phone Number Hint API (reads device-verified SIM numbers)
        try {
            GetPhoneNumberHintIntentRequest request = GetPhoneNumberHintIntentRequest.builder().build();
            Identity.getSignInClient(this)
                    .getPhoneNumberHintIntent(request)
                    .addOnSuccessListener(pendingIntent -> {
                        try {
                            startIntentSenderForResult(pendingIntent.getIntentSender(), RC_PHONE_HINT, null, 0, 0, 0);
                        } catch (Exception e) {
                            handleSimHintUnavailable(clean, info);
                        }
                    })
                    .addOnFailureListener(e -> handleSimHintUnavailable(clean, info));
        } catch (Exception e) {
            handleSimHintUnavailable(clean, info);
        }
    }

    private void handleSimHintUnavailable(String clean, SimCheckInfo info) {
        pendingSimVerifyPhone = null;
        if (!info.simNumbers.isEmpty()) {
            notifySimVerifyResult(false, "MISMATCH", "Enter the correct mobile number linked to the SIM in this device.");
            return;
        }
        boolean hasStatePerm = checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean hasNumPerm = checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED;
        if (!hasStatePerm && !hasNumPerm) {
            notifySimVerifyResult(false, "PERM_DENIED", "Please allow Phone permission so LostLink AI can verify that this mobile number belongs to the SIM in this device.");
        } else {
            notifySimVerifyResult(false, "SIM_UNREADABLE", "Could not match +91 " + clean + " to the SIM in this device. Enter the correct mobile number linked to this device's SIM.");
        }
    }

    private void notifySimVerifyResult(boolean ok, String code, String messageOrPhone) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("ok", ok);
            payload.put("code", code);
            if (ok) {
                payload.put("phone", messageOrPhone);
            } else {
                payload.put("message", messageOrPhone);
            }
            evaluateJs("window.onNativeSimVerifyResult && window.onNativeSimVerifyResult(" + payload + ")");
        } catch (Exception ignored) {}
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
                "&hd=rvu.edu.in" +
                "&state=native_apk";
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
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RC_PHONE_PERM) {
            String target = pendingSimVerifyPhone;
            if (target != null && !target.isEmpty()) {
                performSimVerification(target);
            }
        }
    }

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
            return;
        }

        if (requestCode == RC_PHONE_HINT) {
            String target = pendingSimVerifyPhone;
            pendingSimVerifyPhone = null;
            if (target == null) return;

            if (resultCode == RESULT_OK && data != null) {
                try {
                    String hintRaw = Identity.getSignInClient(this).getPhoneNumberFromIntent(data);
                    String hintClean = normalizeIndian10(hintRaw);
                    if (!hintClean.isEmpty() && hintClean.equals(target)) {
                        notifySimVerifyResult(true, "HINT_MATCH", target);
                    } else {
                        notifySimVerifyResult(false, "MISMATCH", "Enter the correct mobile number linked to the SIM in this device.");
                    }
                } catch (Exception e) {
                    notifySimVerifyResult(false, "HINT_ERROR", "Enter the correct mobile number linked to the SIM in this device.");
                }
            } else {
                notifySimVerifyResult(false, "CANCELLED", "SIM verification cancelled. Enter the correct mobile number linked to the SIM in this device.");
            }
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
                    int maxDim = 640;
                    int width = bitmap.getWidth();
                    int height = bitmap.getHeight();
                    if (width > maxDim || height > maxDim) {
                        float ratio = Math.min((float) maxDim / width, (float) maxDim / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                        bitmap = Bitmap.createScaledBitmap(bitmap, width, height, true);
                    }

                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 68, outputStream);
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
