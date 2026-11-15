package com.gesmak.app.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun QrOrderScreen(
    mod: Modifier = Modifier,
    orderUrl: String?,
) {
    val amber = Color(0xFFF59E0B)
    Column(modifier = mod.fillMaxSize().background(Color(0xFF0C0A09))) {
        Text(
            "Commande table",
            color = amber,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            modifier = Modifier.padding(16.dp),
        )
        if (orderUrl.isNullOrBlank()) {
            Text(
                "Aucun lien établissement (slug manquant).",
                color = Color(0xFFA8A29E),
                modifier = Modifier.padding(16.dp),
            )
        } else {
            AndroidView(
                modifier = Modifier.fillMaxWidth().weight(1f),
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        webViewClient = WebViewClient()
                        loadUrl(orderUrl)
                    }
                },
                update = { it.loadUrl(orderUrl) },
            )
        }
    }
}
