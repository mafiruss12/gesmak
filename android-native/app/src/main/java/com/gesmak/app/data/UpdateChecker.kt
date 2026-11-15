package com.gesmak.app.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.gesmak.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

data class RemoteVersion(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
)

class UpdateChecker(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    /** Fichier public sur GitHub main — mis à jour à chaque release. */
    private val versionUrl =
        "https://raw.githubusercontent.com/mafiruss12/gesmak/main/android-native/UPDATE_VERSION"

    fun check(): RemoteVersion? {
        val req = Request.Builder().url(versionUrl).get().build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val text = resp.body?.string().orEmpty()
            var code = 0
            var name = ""
            var apk = "https://github.com/mafiruss12/gesmak/releases/download/apk-latest/GESMAK-native.apk"
            for (line in text.lines()) {
                val p = line.split("=", limit = 2)
                if (p.size != 2) continue
                when (p[0].trim()) {
                    "versionCode" -> code = p[1].trim().toIntOrNull() ?: 0
                    "versionName" -> name = p[1].trim()
                    "apkUrl" -> apk = p[1].trim()
                }
            }
            if (code <= 0) return null
            return RemoteVersion(code, name, apk)
        }
    }

    fun isUpdateAvailable(remote: RemoteVersion): Boolean =
        remote.versionCode > BuildConfig.VERSION_CODE

    /** Télécharge l'APK dans le cache app. */
    fun downloadApk(apkUrl: String, onProgress: ((Int) -> Unit)? = null): File {
        val req = Request.Builder().url(apkUrl).get().build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Téléchargement échoué (${resp.code})")
            val body = resp.body ?: error("Fichier vide")
            val total = body.contentLength()
            val out = File(context.cacheDir, "GESMAK-update.apk")
            body.byteStream().use { input ->
                out.outputStream().use { output ->
                    val buf = ByteArray(8 * 1024)
                    var read: Int
                    var done = 0L
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        done += read
                        if (total > 0 && onProgress != null) {
                            onProgress(((done * 100) / total).toInt())
                        }
                    }
                }
            }
            return out
        }
    }

    /** Lance l'installeur système (remplace l'app si même signature + versionCode ↑). */
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
