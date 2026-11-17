package com.gesmak.app

import android.app.Application
import android.content.Context
import android.net.Uri
import android.util.Base64
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.DataSource
import coil.decode.ImageSource
import coil.disk.DiskCache
import coil.fetch.FetchResult
import coil.fetch.Fetcher
import coil.fetch.SourceResult
import coil.memory.MemoryCache
import coil.request.Options
import okhttp3.OkHttpClient
import okio.Buffer
import java.util.concurrent.TimeUnit

class GesmakApplication : Application(), ImageLoaderFactory {

    override fun newImageLoader(): ImageLoader {
        val okHttp = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .addInterceptor { chain ->
                val req = chain.request().newBuilder()
                    .header(
                        "User-Agent",
                        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                    )
                    .header("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8")
                    .build()
                chain.proceed(req)
            }
            .build()

        return ImageLoader.Builder(this)
            .okHttpClient(okHttp)
            .components {
                add(DataUriFetcher.Factory(applicationContext))
            }
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50L * 1024L * 1024L)
                    .build()
            }
            .crossfade(true)
            .build()
    }

    private class DataUriFetcher(
        private val uri: Uri,
        private val context: Context,
    ) : Fetcher {
        override suspend fun fetch(): FetchResult {
            val raw = uri.toString()
            val comma = raw.indexOf(',')
            require(comma > 5) { "Data URI invalide" }
            val header = raw.substring(5, comma)
            val mime = header.substringBefore(';').ifBlank { "image/jpeg" }
            val b64 = raw.substring(comma + 1).trim()
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val buffer = Buffer().write(bytes)
            return SourceResult(
                source = ImageSource(buffer, context),
                mimeType = mime,
                dataSource = DataSource.MEMORY,
            )
        }

        class Factory(private val context: Context) : Fetcher.Factory<Uri> {
            override fun create(data: Uri, options: Options, imageLoader: ImageLoader): Fetcher? {
                if (!data.scheme.equals("data", ignoreCase = true)) return null
                if (!data.toString().startsWith("data:image", ignoreCase = true)) return null
                return DataUriFetcher(data, context)
            }
        }
    }
}
