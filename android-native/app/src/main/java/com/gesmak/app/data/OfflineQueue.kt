package com.gesmak.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** File locale pour rejouer ventes / arrivages hors ligne. */
class OfflineQueue(context: Context) {
    private val prefs = context.getSharedPreferences("gesmak_offline_q", Context.MODE_PRIVATE)
    private val KEY = "queue"

    fun enqueue(type: String, payload: JSONObject) {
        val arr = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
        arr.put(
            JSONObject()
                .put("type", type)
                .put("payload", payload)
                .put("ts", System.currentTimeMillis()),
        )
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    fun size(): Int = JSONArray(prefs.getString(KEY, "[]") ?: "[]").length()

    fun drain(handler: (type: String, payload: JSONObject) -> Boolean) {
        val arr = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
        val kept = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val ok = try {
                handler(o.getString("type"), o.getJSONObject("payload"))
            } catch (_: Exception) {
                false
            }
            if (!ok) kept.put(o)
        }
        prefs.edit().putString(KEY, kept.toString()).apply()
    }
}
