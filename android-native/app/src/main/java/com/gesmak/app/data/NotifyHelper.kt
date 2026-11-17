package com.gesmak.app.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.gesmak.app.R

object NotifyHelper {
    const val CHANNEL_ORDERS = "gesmak_orders"
    const val CHANNEL_UPDATES = "gesmak_updates"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (mgr.getNotificationChannel(CHANNEL_ORDERS) == null) {
            val ch = NotificationChannel(
                CHANNEL_ORDERS,
                "Commandes GESMAK",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Nouvelles commandes et alertes terrain"
                enableVibration(true)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            }
            mgr.createNotificationChannel(ch)
        }
        if (mgr.getNotificationChannel(CHANNEL_UPDATES) == null) {
            val upd = NotificationChannel(
                CHANNEL_UPDATES,
                "Mises à jour GESMAK",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Notifications de nouvelle version disponible"
            }
            mgr.createNotificationChannel(upd)
        }
    }

    fun showOrder(context: Context, title: String, body: String, id: Int = 1001, sound: Boolean = true) {
        ensureChannel(context)
        val builder = NotificationCompat.Builder(context, CHANNEL_ORDERS)
            .setSmallIcon(R.drawable.ic_stat_gesmak)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
        if (sound) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            builder.setVibrate(longArrayOf(0, 400, 200, 400))
        }
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
        } catch (_: SecurityException) {
            /* permission not granted */
        }
    }
}
