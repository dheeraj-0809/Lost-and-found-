package edu.rvu.lostlink;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

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

        // WebChromeClient for JS console messages (useful during development)
        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                final String scheme = request.getUrl().getScheme();
                // Allow file:// and https:// navigation; intercept external http links
                return !("file".equals(scheme) || "https".equals(scheme));
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
    public void openGoogleSignIn() {
        googleClient.signOut().addOnCompleteListener(task ->
                startActivityForResult(googleClient.getSignInIntent(), RC_GOOGLE_SIGN));
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
        // Request persistent read permission so the URI survives process restarts
        try {
            getContentResolver().takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Some providers grant session-only access — that's fine for our use case
        }
        evaluateJs("window.onNativePhotoSelected(" + JSONObject.quote(uri.toString()) + ")");
    }

    /**
     * Safely calls a JavaScript expression on the WebView's UI thread.
     */
    private void evaluateJs(final String script) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
