package com.gesmak.app.data

import com.gesmak.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * Auth Supabase — alignée sur src/lib/login.ts (web).
 * Téléphone CI → 0XXXXXXXXX@maquis.local.
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
            return Result(false, error = "Supabase non configuré dans ce build.")
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
            Result(false, error = friendlyNetworkError(e, "Connexion internet indisponible."))
        }
    }

    fun refreshSession(refreshToken: String): Result {
        if (!isConfigured || refreshToken.isBlank()) {
            return Result(false, error = "Session expirée")
        }
        val body = JSONObject()
            .put("refresh_token", refreshToken)
            .toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/auth/v1/token?grant_type=refresh_token")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        return try {
            client.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) return Result(false, error = "Session expirée")
                val json = JSONObject(text)
                val access = json.optString("access_token")
                if (access.isBlank()) return Result(false, error = "Session expirée")
                val user = json.optJSONObject("user")
                Result(
                    ok = true,
                    session = SessionData(
                        accessToken = access,
                        refreshToken = json.optString("refresh_token").ifBlank { refreshToken },
                        email = user?.optString("email").orEmpty(),
                        userId = user?.optString("id").orEmpty(),
                    ),
                )
            }
        } catch (e: Exception) {
            Result(false, error = friendlyNetworkError(e))
        }
    }

    data class SignUpResult(
        val ok: Boolean,
        val userId: String? = null,
        val error: String? = null,
    )

    /**
     * Crée un compte Supabase Auth sans écraser la session locale du propriétaire/manager.
     * Équivalent exact de createClient(persistSession: false).auth.signUp() sur gesmak.vercel.app.
     */
    fun signUpEphemeral(
        email: String,
        password: String,
        fullName: String,
        login: String,
        role: String,
    ): SignUpResult {
        if (!isConfigured) {
            return SignUpResult(false, error = "Supabase non configuré.")
        }
        val meta = JSONObject()
            .put("full_name", fullName.trim())
            .put("login", login.trim())
            .put("role", role)
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
            .put("data", meta)
            .toString()
            .toRequestBody("application/json".toMediaType())

        val req = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/auth/v1/signup")
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
                    val friendly = if (msg.contains("already", ignoreCase = true) ||
                        msg.contains("registered", ignoreCase = true) ||
                        msg.contains("exists", ignoreCase = true)
                    ) {
                        "Cet identifiant est déjà utilisé."
                    } else {
                        msg
                    }
                    return SignUpResult(false, error = friendly)
                }
                val json = JSONObject(text)
                val userObj = json.optJSONObject("user") ?: json
                val uid = userObj.optString("id")
                if (uid.isBlank()) {
                    return SignUpResult(false, error = "Compte créé mais ID introuvable.")
                }
                SignUpResult(ok = true, userId = uid)
            }
        } catch (e: Exception) {
            SignUpResult(false, error = friendlyNetworkError(e, "Création impossible sans connexion internet."))
        }
    }

    /**
     * Vérifie l'ancien mot de passe puis met à jour le mot de passe de l'utilisateur connecté.
     */
    fun updatePassword(
        accessToken: String,
        email: String,
        currentPassword: String,
        newPassword: String,
    ): String? {
        if (!isConfigured) return "Supabase non configuré."
        if (newPassword.length < 6) return "Le mot de passe doit contenir au moins 6 caractères."
        if (currentPassword == newPassword) return "Le nouveau mot de passe doit être différent de l'actuel."
        val check = signIn(email, currentPassword)
        if (!check.ok || check.session == null) {
            return "Mot de passe actuel incorrect."
        }
        val freshToken = check.session.accessToken.ifBlank { accessToken }
        val body = JSONObject().put("password", newPassword).toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/auth/v1/user")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $freshToken")
            .addHeader("Content-Type", "application/json")
            .put(body)
            .build()
        return try {
            client.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) null
                else parseAuthError(resp.body?.string().orEmpty(), resp.code)
            }
        } catch (e: Exception) {
            friendlyNetworkError(e, "Connexion requise pour modifier le mot de passe.")
        }
    }

    fun sendPasswordReset(login: String): String? {
        if (!isConfigured) return "Supabase non configuré."
        val email = toAuthEmail(login)
        if (!email.contains("@") || email.endsWith("@maquis.local")) {
            return "La réinitialisation nécessite une vraie adresse e-mail (pas un login simple)."
        }
        val body = JSONObject()
            .put("email", email)
            .toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/auth/v1/recover")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        return try {
            client.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) null
                else parseAuthError(resp.body?.string().orEmpty(), resp.code)
            }
        } catch (e: Exception) {
            friendlyNetworkError(e, "Connexion requise pour envoyer l'e-mail.")
        }
    }

    companion object {
        fun isNetworkError(e: Throwable?): Boolean {
            var cur: Throwable? = e
            var depth = 0
            while (cur != null && depth < 6) {
                if (
                    cur is UnknownHostException ||
                    cur is ConnectException ||
                    cur is SocketTimeoutException ||
                    cur is java.net.SocketException ||
                    cur is javax.net.ssl.SSLException
                ) {
                    return true
                }
                val m = cur.message?.lowercase().orEmpty()
                if (
                    m.contains("unable to resolve") ||
                    m.contains("no address associated") ||
                    m.contains("eai_nodata") ||
                    m.contains("supabase.co") ||
                    m.contains("failed to connect") ||
                    m.contains("failed to fetch") ||
                    m.contains("enotfound") ||
                    m.contains("econnrefused") ||
                    m.contains("network is unreachable") ||
                    m.contains("connection reset") ||
                    m.contains("software caused connection abort") ||
                    m.contains("timeout")
                ) {
                    return true
                }
                cur = cur.cause
                depth++
            }
            return false
        }

        fun friendlyNetworkError(
            e: Throwable?,
            fallback: String = "Connexion internet indisponible — mode hors-ligne actif.",
        ): String {
            if (isNetworkError(e)) return fallback
            val m = e?.message?.trim().orEmpty()
            if (
                m.contains("supabase", ignoreCase = true) ||
                m.contains("postgres", ignoreCase = true) ||
                m.contains("http", ignoreCase = true) ||
                m.contains("resolve host", ignoreCase = true)
            ) {
                return fallback
            }
            return m.ifBlank { fallback }
        }

        fun displayLogin(email: String?): String {
            val e = email?.trim().orEmpty()
            return if (e.endsWith("@maquis.local")) e.removeSuffix("@maquis.local") else e
        }

        fun generateLogin(fullName: String, role: String): String {
            val base = fullName.trim().lowercase()
                .replace(Regex("[^a-z0-9]"), "")
                .take(10)
                .ifBlank { role.lowercase().take(6) }
            val num = (10..99).random()
            return "${base}$num"
        }

        fun generatePassword(): String {
            val chars = "abcdefghjkmnpqrstuvwxyz23456789"
            return buildString {
                repeat(8) { append(chars.random()) }
            }
        }

        fun toAuthEmail(login: String): String {
            val v = login.trim().lowercase()
            if (v.isEmpty()) return v
            if (v.contains("@")) return v
            val phone = normalizeCiPhone(v)
            if (phone != null) return "$phone@maquis.local"
            val clean = v.replace(Regex("[^a-z0-9._-]"), "")
            return "$clean@maquis.local"
        }

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
                    else -> "Opération refusée ($code)"
                }
            } catch (_: Exception) {
                "Opération refusée ($code)"
            }
        }
    }
}
