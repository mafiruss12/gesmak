package com.gesmak.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Ventes caisse locales du jour (ticket verrouillé après validation). */
class LocalSalesStore(context: Context) {
    private val prefs = context.getSharedPreferences("gesmak_local_sales", Context.MODE_PRIVATE)
    private val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    data class Ticket(
        val id: String,
        val at: String,
        val total: Double,
        val lines: String,
    )

    private fun key(estId: String) = "sales_${estId}_${dayFmt.format(Date())}"

    fun list(estId: String): List<Ticket> {
        val raw = prefs.getString(key(estId), "[]") ?: "[]"
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    Ticket(
                        id = o.optString("id"),
                        at = o.optString("at"),
                        total = o.optDouble("total"),
                        lines = o.optString("lines"),
                    ),
                )
            }
        }
    }

    fun add(estId: String, total: Double, lines: String) {
        val arr = JSONArray(prefs.getString(key(estId), "[]") ?: "[]")
        val o = JSONObject()
            .put("id", "t-${System.currentTimeMillis()}")
            .put("at", SimpleDateFormat("HH:mm", Locale.FRANCE).format(Date()))
            .put("total", total)
            .put("lines", lines)
            .put("locked", true)
        // newest first
        val next = JSONArray()
        next.put(o)
        for (i in 0 until arr.length()) next.put(arr.get(i))
        prefs.edit().putString(key(estId), next.toString()).apply()
    }

    fun dayTotal(estId: String): Double = list(estId).sumOf { it.total }
}
