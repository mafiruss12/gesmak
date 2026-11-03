package com.gesmak.app.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotifyHelper {
    const val CHANNEL_ORDERS = "gesmak_orders"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (mgr.getNotificationChannel(CHANNEL_ORDERS) != null) return
        val ch = NotificationChannel(
            CHANNEL_ORDERS,
            "Commandes GESMAK",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Nouvelles commandes"
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

    fun showOrder(context: Context, title: String, body: String, id: Int = 1001) {
        ensureChannel(context)
        val notif = NotificationCompat.Builder(context, CHANNEL_ORDERS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setVibrate(longArrayOf(0, 400, 200, 400))
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id, notif)
        } catch (_: SecurityException) {
            /* permission not granted */
        }
    }
}
