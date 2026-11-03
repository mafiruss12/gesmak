package com.gesmak.app.data

import com.gesmak.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Auth Supabase minimal (login password).
 * URL / anon key via BuildConfig (CI) ou repli web si vide.
 */
class SupabaseAuth(
    private val baseUrl: String = BuildConfig.SUPABASE_URL.ifBlank { "" },
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY.ifBlank { "" },
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    val isConfigured: Boolean
        get() = baseUrl.isNotBlank() && anonKey.isNotBlank()

    data class Result(
        val ok: Boolean,
        val session: SessionData? = null,
        val error: String? = null,
    )

    fun signIn(login: String, password: String): Result {
        if (!isConfigured) {
            return Result(false, error = "Supabase non configuré dans ce build (clés manquantes).")
        }
        val email = toAuthEmail(login)
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
            .toString()
            .toRequestBody("application/json".toMediaType())

        val req = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/auth/v1/token?grant_type=password")
            .addHeader("apikey", anonKey)
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        return try {
            client.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    val msg = try {
                        JSONObject(text).optString("error_description")
                            .ifBlank { JSONObject(text).optString("msg") }
                            .ifBlank { "Identifiant ou mot de passe incorrect" }
                    } catch (_: Exception) {
                        "Identifiant ou mot de passe incorrect"
                    }
                    return Result(false, error = msg)
                }
                val json = JSONObject(text)
                val user = json.optJSONObject("user")
                Result(
                    ok = true,
                    session = SessionData(
                        accessToken = json.getString("access_token"),
                        refreshToken = json.optString("refresh_token"),
                        email = user?.optString("email").orEmpty(),
                        userId = user?.optString("id").orEmpty(),
                    ),
                )
            }
        } catch (e: Exception) {
            Result(false, error = e.message ?: "Erreur réseau")
        }
    }

    companion object {
        fun toAuthEmail(login: String): String {
            val v = login.trim().lowercase()
            if (v.isEmpty()) return v
            if (v.contains("@")) return v
            val digits = v.filter { it.isDigit() }
            if (digits.length >= 8) {
                val phone = if (digits.startsWith("225")) digits else "225$digits"
                return "$phone@maquis.local"
            }
            val clean = v.replace(Regex("[^a-z0-9._-]"), "")
            return "$clean@maquis.local"
        }
    }
}
