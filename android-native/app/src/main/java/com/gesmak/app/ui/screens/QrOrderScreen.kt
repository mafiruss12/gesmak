package com.gesmak.app.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.gesmak.app.BuildConfig
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.theme.LocalGesmakColors

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun QrOrderScreen(
    mod: Modifier = Modifier,
    estSlug: String?,
    tables: List<SupabaseApi.RestaurantTableRow>,
    onAddTable: (number: String, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    val clipboard = LocalClipboardManager.current
    var selectedTable by remember(tables) {
        mutableStateOf(tables.firstOrNull()?.number ?: "T1")
    }
    var copiedMsg by remember { mutableStateOf<String?>(null) }
    var addOpen by remember { mutableStateOf(false) }

    val orderUrl = estSlug?.let {
        "${BuildConfig.WEB_FALLBACK.trimEnd('/')}/commander/$it?table=$selectedTable&kiosk=1"
    }

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text("QR Code & Carte Tables", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("Lien commande client par table", color = c.muted, fontSize = 12.sp)
            }
            IconButton(onClick = { addOpen = true }) {
                Icon(Icons.Default.Add, contentDescription = "Nouvelle table", tint = c.accent)
            }
        }

        if (tables.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                tables.forEach { t ->
                    FilterChip(
                        selected = selectedTable == t.number,
                        onClick = { selectedTable = t.number; copiedMsg = null },
                        label = { Text("Table ${t.number}") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = c.accent,
                            selectedLabelColor = Color.White,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        if (orderUrl.isNullOrBlank()) {
            GesmakCard {
                Text("Slug établissement manquant pour générer le menu QR.", color = c.muted, fontSize = 13.sp)
            }
        } else {
            GesmakCard {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Table $selectedTable", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(orderUrl, color = c.muted, fontSize = 11.sp, maxLines = 1)
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            clipboard.setText(AnnotatedString(orderUrl))
                            copiedMsg = "Lien Table $selectedTable copié !"
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Copier", fontSize = 12.sp)
                    }
                }
                if (!copiedMsg.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(copiedMsg!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(10.dp))
            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp)),
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

    if (addOpen) {
        var num by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) addOpen = false },
            containerColor = c.card,
            title = { Text("Ajouter une table", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = num,
                    onValueChange = { num = it },
                    label = { Text("Numéro ou nom (ex: T5, VIP1)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (num.isBlank()) return@Button
                        busy = true
                        onAddTable(num.trim()) {
                            busy = false
                            selectedTable = num.trim()
                            addOpen = false
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Ajouter") }
            },
            dismissButton = {
                TextButton(onClick = { addOpen = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }
}
