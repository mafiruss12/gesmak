package com.gesmak.app.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.gesmak.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

data class RemoteVersion(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String = "",
)

class UpdateChecker(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private val defaultApkUrl =
        "https://github.com/mafiruss12/gesmak/releases/download/apk-latest/GESMAK-native.apk"

    private val versionUrl =
        "https://raw.githubusercontent.com/mafiruss12/gesmak/main/android-native/UPDATE_VERSION"

    private val releaseApiUrl =
        "https://api.github.com/repos/mafiruss12/gesmak/releases/tags/apk-latest"

    fun check(): RemoteVersion? {
        val fromFile = tryFetchUpdateVersionFile()
        if (fromFile != null) return fromFile
        return tryFetchGitHubRelease()
    }

    private fun tryFetchUpdateVersionFile(): RemoteVersion? {
        return try {
            val req = Request.Builder()
                .url("$versionUrl?t=${System.currentTimeMillis()}")
                .header("Cache-Control", "no-cache")
                .get()
                .build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val text = resp.body?.string().orEmpty()
                var code = 0
                var name = ""
                var apk = defaultApkUrl
                var notes = ""
                for (line in text.lines()) {
                    val p = line.split("=", limit = 2)
                    if (p.size != 2) continue
                    when (p[0].trim()) {
                        "versionCode" -> code = p[1].trim().toIntOrNull() ?: 0
                        "versionName" -> name = p[1].trim()
                        "apkUrl" -> apk = p[1].trim()
                        "notes" -> notes = p[1].trim()
                    }
                }
                if (code <= 0) return null
                RemoteVersion(code, name.ifBlank { "v$code" }, apk, notes)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun tryFetchGitHubRelease(): RemoteVersion? {
        return try {
            val req = Request.Builder()
                .url(releaseApiUrl)
                .header("Accept", "application/vnd.github+json")
                .get()
                .build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val json = JSONObject(resp.body?.string().orEmpty())
                val assets = json.optJSONArray("assets") ?: return null
                var apkUrl: String? = null
                for (i in 0 until assets.length()) {
                    val a = assets.getJSONObject(i)
                    if (a.optString("name").endsWith(".apk", ignoreCase = true)) {
                        apkUrl = a.optString("browser_download_url")
                        break
                    }
                }
                if (apkUrl.isNullOrBlank()) return null
                val name = json.optString("name", "Nouvelle version")
                val body = json.optString("body", "")
                val match = Regex("""code[:\s=]+(\d+)""", RegexOption.IGNORE_CASE).find(body)
                val code = match?.groupValues?.getOrNull(1)?.toIntOrNull()
                    ?: (BuildConfig.VERSION_CODE + 1)
                RemoteVersion(code, name, apkUrl, body)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun isUpdateAvailable(remote: RemoteVersion): Boolean =
        remote.versionCode > BuildConfig.VERSION_CODE

    fun canRequestPackageInstalls(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}"),
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    /** Télécharge l'APK signé dans le cache app avec progression 0..100. */
    fun downloadApk(apkUrl: String, onProgress: ((Int) -> Unit)? = null): File {
        val req = Request.Builder()
            .url(apkUrl)
            .header("Accept", "application/vnd.android.package-archive, application/octet-stream, */*")
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Téléchargement échoué (HTTP ${resp.code})")
            val body = resp.body ?: error("Fichier APK vide")
            val total = body.contentLength()
            val out = File(context.cacheDir, "GESMAK-update.apk")
            if (out.exists()) out.delete()
            body.byteStream().use { input ->
                out.outputStream().use { output ->
                    val buf = ByteArray(16 * 1024)
                    var read: Int
                    var done = 0L
                    var lastPct = -1
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        done += read
                        if (total > 0 && onProgress != null) {
                            val pct = ((done * 100) / total).toInt().coerceIn(0, 100)
                            if (pct != lastPct) {
                                lastPct = pct
                                onProgress(pct)
                            }
                        }
                    }
                    output.flush()
                }
            }
            if (out.length() < 100_000L) {
                error("Fichier APK incomplet (${out.length()} octets)")
            }
            return out
        }
    }

    /** Lance l'installeur Android (mise à jour sur place sans désinstaller). */
    fun installApk(file: File) {
        val uri: Uri = if (Build.VERSION.SDK_INT >= 24) {
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        } else {
            Uri.fromFile(file)
        }
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(intent)
    }
}
