package com.gesmak.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ActivityLog(context: Context) {
    private val prefs = context.getSharedPreferences("gesmak_activity", Context.MODE_PRIVATE)
    private val KEY = "log"

    fun add(message: String) {
        val arr = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
        val next = JSONArray()
        next.put(
            JSONObject()
                .put("at", SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(Date()))
                .put("msg", message),
        )
        for (i in 0 until minOf(arr.length(), 99)) next.put(arr.get(i))
        prefs.edit().putString(KEY, next.toString()).apply()
    }

    fun list(): List<Pair<String, String>> {
        val arr = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(o.optString("at") to o.optString("msg"))
            }
        }
    }
}
