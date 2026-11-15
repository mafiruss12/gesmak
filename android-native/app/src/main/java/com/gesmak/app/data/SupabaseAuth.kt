package com.gesmak.app.data

import com.gesmak.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Auth Supabase — alignée sur src/lib/login.ts (web).
 * Téléphone CI → 0XXXXXXXXX@maquis.local (PAS 225…@maquis.local).
 */
class SupabaseAuth(
    private val baseUrl: String = BuildConfig.SUPABASE_URL.ifBlank { "" },
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY.ifBlank { "" },
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(25, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
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
        if (login.isBlank() || password.isBlank()) {
            return Result(false, error = "Identifiant et mot de passe requis.")
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
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        return try {
            client.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    val msg = parseAuthError(text, resp.code)
                    return Result(false, error = msg)
                }
                val json = JSONObject(text)
                val access = json.optString("access_token")
                if (access.isBlank()) {
                    return Result(false, error = "Réponse auth invalide (pas de token).")
                }
                val user = json.optJSONObject("user")
                Result(
                    ok = true,
                    session = SessionData(
                        accessToken = access,
                        refreshToken = json.optString("refresh_token"),
                        email = user?.optString("email").orEmpty().ifBlank { email },
                        userId = user?.optString("id").orEmpty(),
                    ),
                )
            }
        } catch (e: Exception) {
            Result(false, error = "Réseau : ${e.message ?: "connexion impossible"}")
        }
    }

    companion object {
        /**
         * Identique à toAuthEmail() web (src/lib/login.ts).
         */
        fun toAuthEmail(login: String): String {
            val v = login.trim().lowercase()
            if (v.isEmpty()) return v
            if (v.contains("@")) return v
            val phone = normalizeCiPhone(v)
            if (phone != null) return "$phone@maquis.local"
            val clean = v.replace(Regex("[^a-z0-9._-]"), "")
            return "$clean@maquis.local"
        }

        /** 10 chiffres locaux 0XXXXXXXXX ou null — comme normalizeCiPhone web. */
        fun normalizeCiPhone(input: String): String? {
            var digits = input.filter { it.isDigit() }
            if (digits.isEmpty()) return null
            if (digits.startsWith("00")) digits = digits.drop(2)
            if (digits.startsWith("225") && digits.length >= 12) {
                digits = digits.drop(3)
            }
            if (digits.length == 10 && digits.startsWith("0")) return digits
            if (digits.length == 9) return "0$digits"
            if (digits.length == 10) return if (digits.startsWith("0")) digits else null
            return null
        }

        private fun parseAuthError(text: String, code: Int): String {
            return try {
                val o = JSONObject(text)
                val raw = o.optString("error_description")
                    .ifBlank { o.optString("msg") }
                    .ifBlank { o.optString("error") }
                    .ifBlank { o.optString("message") }
                when {
                    raw.contains("Invalid login", ignoreCase = true) ||
                        raw.contains("invalid_grant", ignoreCase = true) ->
                        "Identifiant ou mot de passe incorrect"
                    raw.contains("Email not confirmed", ignoreCase = true) ->
                        "Compte non confirmé — contactez l'admin"
                    raw.isNotBlank() -> raw
                    else -> "Connexion refusée ($code)"
                }
            } catch (_: Exception) {
                "Identifiant ou mot de passe incorrect ($code)"
            }
        }
    }
}
