package com.gesmak.app.ui.screens

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import org.json.JSONObject
import java.util.Locale

@Composable
fun FinancePatronScreen(
    mod: Modifier = Modifier,
    initialTab: Int = 0,
    establishmentName: String,
    products: List<SupabaseApi.Product>,
    sales30d: List<SupabaseApi.SaleSummaryRow>,
    expenses: List<SupabaseApi.ExpenseRow>,
    purchases: List<SupabaseApi.PurchaseRow>,
    dailyReports: List<SupabaseApi.DailyReportRow>,
    todayDate: String,
    onRefresh: () -> Unit,
    onValidatePatronToday: (dateStr: String, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    val context = LocalContext.current
    var tab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 2)) }
    var periodMode by remember { mutableStateOf("months") } // weeks / months
    var validatedMsg by remember { mutableStateOf<String?>(null) }

    var ttsReady by remember { mutableStateOf(false) }
    val tts = remember {
        var instance: TextToSpeech? = null
        instance = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                instance?.language = Locale.FRENCH
                ttsReady = true
            }
        }
        instance
    }
    DisposableEffect(Unit) {
        onDispose { tts.stop(); tts.shutdown() }
    }

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Finances, Stats & Patron", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("Comptabilité, Top produits & Synthèse vocale", color = c.muted, fontSize = 12.sp)
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
            }
        }

        TabRow(selectedTabIndex = tab, containerColor = c.card, contentColor = c.accent) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Comptabilité", fontSize = 12.sp) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Stats 30j", fontSize = 12.sp) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text("Mode Patron", fontSize = 12.sp) })
        }

        when (tab) {
            // ===== COMPTABILITÉ =====
            0 -> {
                val fondsCommerce = products.sumOf { maxOf(0.0, it.stock) * maxOf(0.0, it.cost) }
                val totalReportsSales = dailyReports.sumOf { it.totalSales }
                val totalPurchases = purchases.sumOf { it.total }
                val totalExpenses = expenses.sumOf { it.amount }
                val estMargin = dailyReports.sumOf { r ->
                    var m = 0.0
                    try {
                        val raw = r.notes.orEmpty().trim()
                        if (raw.startsWith("{")) {
                            val items = JSONObject(raw).optJSONArray("items")
                            if (items != null) {
                                for (i in 0 until items.length()) {
                                    val it = items.getJSONObject(i)
                                    val q = it.optDouble("qty", 0.0)
                                    val pr = it.optDouble("price", 0.0)
                                    val co = it.optDouble("cost", 0.0)
                                    m += q * (pr - co)
                                }
                            }
                        }
                    } catch (_: Exception) { }
                    m
                }
                val byMonth = remember(dailyReports) {
                    dailyReports.groupBy { it.date.take(7) }
                }

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Fonds de commerce (Stock)", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(fondsCommerce), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Marge brute boissons", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(estMargin), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("CA Points reçus", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(totalReportsSales), color = c.sky, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Charges / Achats", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text("${formatFcfa(totalExpenses)} / ${formatFcfa(totalPurchases)}", color = c.rose, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = periodMode == "months",
                                onClick = { periodMode = "months" },
                                label = { Text("Par mois") },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                            FilterChip(
                                selected = periodMode == "days",
                                onClick = { periodMode = "days" },
                                label = { Text("Par journée") },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                    if (dailyReports.isEmpty()) {
                        item { GesmakCard { Text("Aucun rapport journalier sur la période.", color = c.muted, fontSize = 13.sp) } }
                    } else if (periodMode == "months") {
                        byMonth.entries.forEach { (ym, rows) ->
                            val ca = rows.sumOf { it.totalSales }
                            val cashSum = rows.sumOf { it.cash }
                            val moSum = rows.sumOf { it.mobileMoney }
                            val expSum = expenses.filter { it.createdAt.startsWith(ym) }.sumOf { it.amount }
                            item(key = "m_$ym") {
                                GesmakCard {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Mois $ym", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                                        Text(formatFcfa(ca), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        "${rows.size} jour(s) · Espèces: ${formatFcfa(cashSum)} · Mobile: ${formatFcfa(moSum)} · Dépenses: ${formatFcfa(expSum)}",
                                        color = c.muted,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        }
                    } else {
                        items(dailyReports, key = { it.id }) { r ->
                            GesmakCard {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(r.date, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                    Text(formatFcfa(r.totalSales), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                                Text("Espèces: ${formatFcfa(r.cash)} · Mobile: ${formatFcfa(r.mobileMoney)} · Dépenses: ${formatFcfa(r.totalExpenses)}", color = c.muted, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // ===== STATISTIQUES 30J =====
            1 -> {
                val total30 = sales30d.sumOf { it.total }
                val avgDaily = total30 / 30.0
                val txCount = sales30d.size
                val avgBasket = if (txCount > 0) total30 / txCount else 0.0
                val byDay = remember(sales30d) {
                    sales30d.groupBy { it.createdAt.take(10) }
                        .mapValues { (_, list) -> list.sumOf { it.total } }
                        .entries
                        .sortedByDescending { it.value }
                }
                val bestDay = byDay.firstOrNull()
                val topProducts = remember(sales30d, products) {
                    val names = products.associate { it.id to it.name }
                    sales30d.groupBy { it.productId ?: "unknown" }
                        .map { (pid, list) ->
                            Triple(names[pid] ?: "Article", list.sumOf { it.qty }, list.sumOf { it.total })
                        }
                        .sortedByDescending { it.third }
                        .take(5)
                }

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Ventes 30 jours", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(total30), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Moyenne / jour", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(avgDaily), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Transactions", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text("$txCount", color = c.sky, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Panier moyen", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(avgBasket), color = c.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                    if (bestDay != null) {
                        item {
                            GesmakCard(borderColor = c.emerald.copy(alpha = 0.4f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.TrendingUp, contentDescription = null, tint = c.emerald)
                                    Spacer(Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Meilleur jour (30j)", color = c.muted, fontSize = 11.sp)
                                        Text(bestDay.key, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                    Text(formatFcfa(bestDay.value), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                }
                            }
                        }
                    }
                    item { Text("Top 5 produits (CA)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
                    if (topProducts.isEmpty()) {
                        item { GesmakCard { Text("Aucune vente sur les 30 derniers jours.", color = c.muted, fontSize = 13.sp) } }
                    } else {
                        val maxRev = topProducts.maxOfOrNull { it.third }?.coerceAtLeast(1.0) ?: 1.0
                        items(topProducts) { (name, qty, rev) ->
                            GesmakCard {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Analytics, contentDescription = null, tint = c.accent, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                        Text("$qty vendu(s)", color = c.muted, fontSize = 11.sp)
                                        Spacer(Modifier.height(4.dp))
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth((rev / maxRev).toFloat().coerceIn(0.05f, 1f))
                                                .height(6.dp)
                                                .background(c.accent, RoundedCornerShape(4.dp)),
                                        )
                                    }
                                    Spacer(Modifier.width(8.dp))
                                    Text(formatFcfa(rev), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                        }
                    }
                }
            }

            // ===== MODE PATRON (3 GROS BOUTONS VOCAL & VALIDATION) =====
            else -> {
                val report = dailyReports.firstOrNull { it.date.startsWith(todayDate) } ?: dailyReports.firstOrNull()
                val theo = report?.totalSales ?: 0.0
                val cash = report?.cash ?: 0.0
                val mob = report?.mobileMoney ?: 0.0
                val diff = theo - (cash + mob)
                val isMatch = report != null && kotlin.math.abs(diff) < 1.0

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        GesmakCard(borderColor = (if (isMatch) c.emerald else c.rose).copy(alpha = 0.5f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    if (isMatch) Icons.Default.CheckCircle else Icons.Default.WarningAmber,
                                    contentDescription = null,
                                    tint = if (isMatch) c.emerald else c.rose,
                                    modifier = Modifier.size(32.dp),
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        if (report == null) "Aucun point envoyé aujourd'hui"
                                        else if (isMatch) "Caisse CONFORME (${report.date})"
                                        else "ÉCART DÉTECTÉ (${report.date})",
                                        color = if (isMatch) c.emerald else c.rose,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                    )
                                    if (report != null) {
                                        Text(
                                            "Théorique : ${formatFcfa(theo)} · Espèces : ${formatFcfa(cash)} · Mobile : ${formatFcfa(mob)}",
                                            color = c.muted,
                                            fontSize = 12.sp,
                                        )
                                        if (!isMatch) {
                                            Text("Écart : ${formatFcfa(diff)}", color = c.rose, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Gros bouton 1 : Écouter le point
                    item {
                        Button(
                            onClick = {
                                val speech = if (report == null) {
                                    "Bonjour Patron. Aucun rapport journalier n'a encore été envoyé pour $establishmentName."
                                } else {
                                    "Point de $establishmentName du ${report.date}. Chiffre d'affaires total : ${theo.toLong()} francs. Espèces : ${cash.toLong()} francs. Mobile Money : ${mob.toLong()} francs. " +
                                        if (isMatch) "Tout est conforme." else "Attention, il y a un écart de ${diff.toLong()} francs."
                                }
                                if (ttsReady) {
                                    tts.speak(speech, TextToSpeech.QUEUE_FLUSH, null, "patron_point")
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = c.sky, contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth().height(64.dp),
                        ) {
                            Icon(Icons.Default.VolumeUp, contentDescription = null, modifier = Modifier.size(26.dp))
                            Spacer(Modifier.width(10.dp))
                            Text("1. ÉCOUTER LE POINT DU JOUR", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }

                    // Gros bouton 2 : Valider (Vu par le Patron)
                    item {
                        Button(
                            onClick = {
                                onValidatePatronToday(report?.date ?: todayDate) { e ->
                                    validatedMsg = e ?: "Point du ${report?.date ?: todayDate} validé par le Patron."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth().height(64.dp),
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(26.dp))
                            Spacer(Modifier.width(10.dp))
                            Text("2. VALIDER (VU & APPROUVÉ)", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }

                    if (!validatedMsg.isNullOrBlank()) {
                        item {
                            Surface(color = c.emerald.copy(alpha = 0.14f), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Text(validatedMsg!!, color = c.emerald, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(12.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
