package edu.rvu.lostlink;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ReportDatabase extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "lostlink.db";
    private static final int DATABASE_VERSION = 2;

    public ReportDatabase(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE reports (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "report_type TEXT NOT NULL," +
                "title TEXT NOT NULL," +
                "category TEXT NOT NULL," +
                "color TEXT NOT NULL," +
                "brand TEXT NOT NULL," +
                "description TEXT NOT NULL," +
                "image_clues TEXT NOT NULL DEFAULT ''," +
                "location TEXT NOT NULL," +
                "event_date TEXT NOT NULL," +
                "photo_uri TEXT NOT NULL," +
                "owner_name TEXT NOT NULL DEFAULT ''," +
                "owner_email TEXT NOT NULL DEFAULT ''," +
                "owner_phone TEXT NOT NULL DEFAULT ''," +
                "owner_branch TEXT NOT NULL DEFAULT ''," +
                "owner_semester TEXT NOT NULL DEFAULT ''," +
                "status TEXT NOT NULL DEFAULT 'OPEN'," +
                "created_at INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE reports ADD COLUMN owner_name TEXT NOT NULL DEFAULT ''");
            db.execSQL("ALTER TABLE reports ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''");
            db.execSQL("ALTER TABLE reports ADD COLUMN owner_phone TEXT NOT NULL DEFAULT ''");
            db.execSQL("ALTER TABLE reports ADD COLUMN owner_branch TEXT NOT NULL DEFAULT ''");
            db.execSQL("ALTER TABLE reports ADD COLUMN owner_semester TEXT NOT NULL DEFAULT ''");
            db.execSQL("ALTER TABLE reports ADD COLUMN image_clues TEXT NOT NULL DEFAULT ''");
        }
    }

    public long insert(JSONObject report) throws JSONException {
        ContentValues values = new ContentValues();
        values.put("report_type", report.getString("type"));
        values.put("title", report.getString("title").trim());
        values.put("category", report.getString("category"));
        values.put("color", report.optString("color", "Unknown").trim());
        values.put("brand", report.optString("brand", "Unknown").trim());
        values.put("description", report.optString("description", "").trim());
        values.put("image_clues", report.optString("imageClues", "").trim());
        values.put("location", report.getString("location"));
        values.put("event_date", report.getString("date"));
        values.put("photo_uri", report.optString("photoUri", ""));
        values.put("owner_name", report.optString("ownerName", ""));
        values.put("owner_email", report.optString("ownerEmail", ""));
        values.put("owner_phone", report.optString("ownerPhone", ""));
        values.put("owner_branch", report.optString("ownerBranch", ""));
        values.put("owner_semester", report.optString("ownerSemester", ""));
        values.put("status", "OPEN");
        values.put("created_at", System.currentTimeMillis());
        return getWritableDatabase().insertOrThrow("reports", null, values);
    }

    public JSONArray getReports() throws JSONException {
        JSONArray reports = new JSONArray();
        try (Cursor cursor = getReadableDatabase().query("reports", null, null, null,
                null, null, "created_at DESC")) {
            while (cursor.moveToNext()) {
                reports.put(toJson(cursor));
            }
        }
        return reports;
    }

    public JSONObject getDashboard() throws JSONException {
        JSONObject dashboard = new JSONObject();
        dashboard.put("lost", count("LOST"));
        dashboard.put("found", count("FOUND"));
        dashboard.put("returned", countStatus("RETURNED"));
        dashboard.put("matches", MatchEngine.findMatches(getReports()).length());
        return dashboard;
    }

    public JSONArray getMatches() throws JSONException {
        return MatchEngine.findMatches(getReports());
    }

    public boolean markReturned(long id) {
        ContentValues values = new ContentValues();
        values.put("status", "RETURNED");
        return getWritableDatabase().update("reports", values, "id = ?",
                new String[]{String.valueOf(id)}) == 1;
    }

    public boolean deleteReport(long id) {
        return getWritableDatabase().delete("reports", "id = ?",
                new String[]{String.valueOf(id)}) > 0;
    }

    private int count(String type) {
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM reports WHERE report_type = ? AND status = 'OPEN'",
                new String[]{type})) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    private int countStatus(String status) {
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM reports WHERE status = ?", new String[]{status})) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    private JSONObject toJson(Cursor cursor) throws JSONException {
        JSONObject item = new JSONObject();
        item.put("id", cursor.getLong(cursor.getColumnIndexOrThrow("id")));
        item.put("type", cursor.getString(cursor.getColumnIndexOrThrow("report_type")));
        item.put("title", cursor.getString(cursor.getColumnIndexOrThrow("title")));
        item.put("category", cursor.getString(cursor.getColumnIndexOrThrow("category")));
        item.put("color", cursor.getString(cursor.getColumnIndexOrThrow("color")));
        item.put("brand", cursor.getString(cursor.getColumnIndexOrThrow("brand")));
        item.put("description", cursor.getString(cursor.getColumnIndexOrThrow("description")));
        item.put("imageClues", cursor.getString(cursor.getColumnIndexOrThrow("image_clues")));
        item.put("location", cursor.getString(cursor.getColumnIndexOrThrow("location")));
        item.put("date", cursor.getString(cursor.getColumnIndexOrThrow("event_date")));
        item.put("photoUri", cursor.getString(cursor.getColumnIndexOrThrow("photo_uri")));
        item.put("ownerName", cursor.getString(cursor.getColumnIndexOrThrow("owner_name")));
        item.put("ownerEmail", cursor.getString(cursor.getColumnIndexOrThrow("owner_email")));
        item.put("ownerPhone", cursor.getString(cursor.getColumnIndexOrThrow("owner_phone")));
        item.put("ownerBranch", cursor.getString(cursor.getColumnIndexOrThrow("owner_branch")));
        item.put("ownerSemester", cursor.getString(cursor.getColumnIndexOrThrow("owner_semester")));
        item.put("status", cursor.getString(cursor.getColumnIndexOrThrow("status")));
        item.put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow("created_at")));
        return item;
    }
}
