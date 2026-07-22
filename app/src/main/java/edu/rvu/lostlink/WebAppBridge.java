package edu.rvu.lostlink;

import android.webkit.JavascriptInterface;

import org.json.JSONObject;

public final class WebAppBridge {
    private final MainActivity activity;
    private final ReportDatabase database;

    public WebAppBridge(MainActivity activity, ReportDatabase database) {
        this.activity = activity;
        this.database = database;
    }

    @JavascriptInterface
    public String getReports() {
        try { return database.getReports().toString(); }
        catch (Exception error) { return "[]"; }
    }

    @JavascriptInterface
    public String getDashboard() {
        try { return database.getDashboard().toString(); }
        catch (Exception error) { return "{\"lost\":0,\"found\":0,\"matches\":0,\"returned\":0}"; }
    }

    @JavascriptInterface
    public String getMatches() {
        try { return database.getMatches().toString(); }
        catch (Exception error) { return "[]"; }
    }

    @JavascriptInterface
    public String saveReport(String json) {
        try {
            long id = database.insert(new JSONObject(json));
            return new JSONObject().put("ok", true).put("id", id).toString();
        } catch (Exception error) {
            try { return new JSONObject().put("ok", false).put("message", error.getMessage()).toString(); }
            catch (Exception ignored) { return "{\"ok\":false}"; }
        }
    }

    @JavascriptInterface
    public boolean markReturned(long id) {
        return database.markReturned(id);
    }

    @JavascriptInterface
    public boolean deleteReport(long id) {
        return database.deleteReport(id);
    }

    @JavascriptInterface
    public void choosePhoto() {
        activity.runOnUiThread(activity::openPhotoPicker);
    }

    @JavascriptInterface
    public void signInWithGoogle() {
        activity.runOnUiThread(activity::openGoogleSignIn);
    }

}
