package com.gesmak.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

@Composable
fun ReportsScreen(
    mod: Modifier = Modifier,
    caDay: Double,
    caWeek: Double,
    caMonth: Double,
    recent: List<Triple<String, Double, String>>,
    loading: Boolean,
    onRefresh: () -> Unit,
) {
    val c = LocalGesmakColors.current
    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Rapports & Chiffre d'affaires", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                    Text("Synthèse comptable 24h / 7j / 30j", color = c.muted, fontSize = 12.sp)
                }
                IconButton(onClick = onRefresh, enabled = !loading) {
                    if (loading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = c.accent, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                    }
                }
            }
        }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GesmakCard(modifier = Modifier.weight(1f)) {
                    Text("Aujourd'hui", color = c.muted, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(formatFcfa(caDay), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
                GesmakCard(modifier = Modifier.weight(1f)) {
                    Text("7 jours", color = c.muted, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(formatFcfa(caWeek), color = c.sky, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
                GesmakCard(modifier = Modifier.weight(1f)) {
                    Text("30 jours", color = c.muted, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(formatFcfa(caMonth), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
        item {
            Text("Dernières ventes (${recent.size})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
        if (recent.isEmpty()) {
            item {
                GesmakCard {
                    Text("Aucune vente récente enregistrée.", color = c.muted, fontSize = 13.sp)
                }
            }
        }
        items(recent) { (createdAt, total, qty) ->
            GesmakCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(createdAt.take(16).replace("T", " "), color = c.text, fontWeight = FontWeight.Medium, fontSize = 13.sp)
                        Text("Qté : $qty", color = c.muted, fontSize = 11.sp)
                    }
                    Text(formatFcfa(total), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}
