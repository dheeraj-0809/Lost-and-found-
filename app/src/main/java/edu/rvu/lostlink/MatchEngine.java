package edu.rvu.lostlink;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

public final class MatchEngine {
    private MatchEngine() {}

    public static JSONArray findMatches(JSONArray reports) throws JSONException {
        JSONArray matches = new JSONArray();
        for (int i = 0; i < reports.length(); i++) {
            JSONObject lost = reports.getJSONObject(i);
            if (!"LOST".equals(lost.getString("type")) || !"OPEN".equals(lost.getString("status"))) continue;
            for (int j = 0; j < reports.length(); j++) {
                JSONObject found = reports.getJSONObject(j);
                if (!"FOUND".equals(found.getString("type")) || !"OPEN".equals(found.getString("status"))) continue;
                int score = score(lost, found);
                if (score >= 45) {
                    JSONObject match = new JSONObject();
                    match.put("lost", lost);
                    match.put("found", found);
                    match.put("confidence", score);
                    match.put("reason", reason(lost, found));
                    matches.put(match);
                }
            }
        }
        return matches;
    }

    private static int score(JSONObject lost, JSONObject found) throws JSONException {
        int score = 0;
        if (same(lost, found, "category")) score += 35;
        if (same(lost, found, "color")) score += 20;
        if (same(lost, found, "brand")) score += 15;
        if (same(lost, found, "location")) score += 15;
        if (sharedWords(lost.optString("title") + " " + lost.optString("description") + " " + lost.optString("imageClues"),
                found.optString("title") + " " + found.optString("description") + " " + found.optString("imageClues"))) score += 15;
        if (!lost.optString("photoUri").isEmpty() && !found.optString("photoUri").isEmpty()) score += 6;
        return Math.min(score, 100);
    }

    private static String reason(JSONObject lost, JSONObject found) {
        StringBuilder builder = new StringBuilder();
        appendReason(builder, same(lost, found, "category"), "same category");
        appendReason(builder, same(lost, found, "color"), "same color");
        appendReason(builder, same(lost, found, "brand"), "same brand");
        appendReason(builder, same(lost, found, "location"), "same location");
        if (!lost.optString("photoUri").isEmpty() && !found.optString("photoUri").isEmpty()) {
            appendReason(builder, true, "both reports include photos");
        }
        return builder.length() == 0 ? "details are partially similar" : builder.toString();
    }

    private static void appendReason(StringBuilder builder, boolean condition, String text) {
        if (!condition) return;
        if (builder.length() > 0) builder.append(", ");
        builder.append(text);
    }

    private static boolean same(JSONObject a, JSONObject b, String key) {
        String left = normalize(a.optString(key));
        String right = normalize(b.optString(key));
        return !left.isEmpty() && !"unknown".equals(left) && left.equals(right);
    }

    private static boolean sharedWords(String a, String b) {
        String right = " " + normalize(b) + " ";
        for (String word : normalize(a).split("\\s+")) {
            if (word.length() > 3 && right.contains(" " + word + " ")) return true;
        }
        return false;
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", "");
    }
}
