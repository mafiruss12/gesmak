package com.gesmak.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.BusinessTypes
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.EstablishmentLogo
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private data class FinChargeLine(
    val id: String,
    val date: String,
    val source: String, // "expense" | "loss" | "purchase"
    val category: String,
    val description: String,
    val amount: Double,
)

private data class FinCategorySlice(
    val category: String,
    val amount: Double,
    val pct: Double,
)

private data class FinAnalytics(
    val startDate: String,
    val endDate: String,
    val spanDays: Int,
    val totalRevenue: Double,
    val totalCogs: Double,
    val grossMargin: Double,
    val expensesTotal: Double,
    val lossesAndBroken: Double,
    val additionalPayroll: Double,
    val consolidatedCharges: Double,
    val purchasesTotal: Double,
    val netProfit: Double,
    val netMarginPct: Double,
    val cashFlowAfterRestock: Double,
    val prevNetProfit: Double,
    val activeEmployeesCount: Int,
    val categoriesBreakdown: List<FinCategorySlice>,
    val ledger: List<FinChargeLine>,
)

@Composable
fun FinancialReportsScreen(
    mod: Modifier = Modifier,
    establishment: SupabaseApi.Establishment?,
    products: List<SupabaseApi.Product>,
    sales: List<SupabaseApi.SaleSummaryRow>,
    expenses: List<SupabaseApi.ExpenseRow>,
    purchases: List<SupabaseApi.PurchaseRow>,
    dailyReports: List<SupabaseApi.DailyReportRow>,
    employees: List<SupabaseApi.EmployeeRow>,
    onRefresh: () -> Unit,
) {
    val c = LocalGesmakColors.current
    val bizSpec = BusinessTypes.spec(establishment?.type)

    var periodKey by remember { mutableStateOf("month") } // today | 7d | month | 30d | 90d
    var includePayroll by remember { mutableStateOf(true) }
    var ledgerFilter by remember { mutableStateOf("all") } // all | expense | loss | purchase

    val analytics = remember(
        periodKey,
        includePayroll,
        products,
        sales,
        expenses,
        purchases,
        dailyReports,
        employees,
    ) {
        computeFinancialAnalytics(
            periodKey = periodKey,
            includePayroll = includePayroll,
            products = products,
            sales = sales,
            expenses = expenses,
            purchases = purchases,
            dailyReports = dailyReports,
            employees = employees,
        )
    }

    val filteredLedger = remember(analytics.ledger, ledgerFilter) {
        if (ledgerFilter == "all") analytics.ledger
        else analytics.ledger.filter { it.source == ledgerFilter }
    }

    val netPositive = analytics.netProfit >= 0.0
    val deltaNet = analytics.netProfit - analytics.prevNetProfit

    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // En-tête établissement actif avec logo
        item {
            GesmakCard(borderColor = c.accent.copy(alpha = 0.45f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    EstablishmentLogo(
                        name = establishment?.name ?: "GESMAK",
                        logoUrl = establishment?.logoUrl,
                        size = 48.dp,
                        cornerRadius = 14.dp,
                        accentColor = c.accent,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                "ÉTABLISSEMENT ACTIF",
                                color = c.accentDeep,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            StatusPill(label = bizSpec.shortLabel, color = c.accent)
                        }
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "Rapports Financiers · ${establishment?.name ?: "Établissement"}",
                            color = c.text,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "Bénéfices nets & charges consolidées (${analytics.startDate} → ${analytics.endDate})",
                            color = c.muted,
                            fontSize = 11.sp,
                        )
                    }
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                    }
                }
            }
        }

        // Filtres de période + option masse salariale RH
        item {
            GesmakCard {
                Text("Période d'analyse", color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "today" to "Aujourd'hui",
                        "7d" to "7 jours",
                        "month" to "Ce mois",
                        "30d" to "30 jours",
                        "90d" to "90 jours",
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = periodKey == key,
                            onClick = { periodKey = key },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = c.accent,
                                selectedLabelColor = Color.White,
                            ),
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                HorizontalDivider(color = c.border)
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Groups, contentDescription = null, tint = c.sky, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Inclure masse salariale RH proratisée",
                            color = c.text,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                        )
                        Text(
                            "${analytics.activeEmployeesCount} employé(s) actif(s) sur ${analytics.spanDays} jour(s)",
                            color = c.muted,
                            fontSize = 11.sp,
                        )
                    }
                    Switch(checked = includePayroll, onCheckedChange = { includePayroll = it })
                }
            }
        }

        // 4 KPI principaux
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GesmakCard(
                        modifier = Modifier.weight(1f),
                        borderColor = (if (netPositive) c.emerald else c.rose).copy(alpha = 0.45f),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(
                                if (netPositive) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                                contentDescription = null,
                                tint = if (netPositive) c.emerald else c.rose,
                                modifier = Modifier.size(14.dp),
                            )
                            Text("Bénéfice Net", color = c.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            formatFcfa(analytics.netProfit),
                            color = if (netPositive) c.emerald else c.rose,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            "${if (deltaNet >= 0) "+" else ""}${formatFcfa(deltaNet)} vs préc.",
                            color = c.muted,
                            fontSize = 10.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    GesmakCard(
                        modifier = Modifier.weight(1f),
                        borderColor = c.rose.copy(alpha = 0.4f),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Default.TrendingDown, contentDescription = null, tint = c.rose, modifier = Modifier.size(14.dp))
                            Text("Charges Consolidées", color = c.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            formatFcfa(analytics.consolidatedCharges),
                            color = c.rose,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            if (analytics.additionalPayroll > 0.0) "Dépenses + Pertes + RH" else "Dépenses + Pertes",
                            color = c.muted,
                            fontSize = 10.sp,
                            maxLines = 1,
                        )
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GesmakCard(modifier = Modifier.weight(1f)) {
                        Text("Chiffre d'affaires", color = c.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        Text(formatFcfa(analytics.totalRevenue), color = c.sky, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("Marge brute : ${formatFcfa(analytics.grossMargin)}", color = c.muted, fontSize = 10.sp, maxLines = 1)
                    }

                    GesmakCard(modifier = Modifier.weight(1f)) {
                        Text("Marge Nette & Achats", color = c.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            String.format(Locale.US, "%.1f%%", analytics.netMarginPct),
                            color = c.accent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                        )
                        Text("Achats stock : ${formatFcfa(analytics.purchasesTotal)}", color = c.muted, fontSize = 10.sp, maxLines = 1)
                    }
                }
            }
        }

        // Compte de résultat synthétique
        item {
            GesmakCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Receipt, contentDescription = null, tint = c.accent, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Compte de résultat synthétique", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
                Spacer(Modifier.height(10.dp))
                PnlLine("Chiffre d'affaires total", formatFcfa(analytics.totalRevenue), c.text, bold = true)
                PnlLine("− Coût des ventes (CMV)", "− ${formatFcfa(analytics.totalCogs)}", c.accentDeep)
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = c.cardAlt,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("= Marge brute sur ventes", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Text(formatFcfa(analytics.grossMargin), color = c.sky, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
                PnlLine("− Dépenses d'exploitation", "− ${formatFcfa(analytics.expensesTotal)}", c.rose)
                if (analytics.lossesAndBroken > 0.0) {
                    PnlLine("− Pertes & casse déclarées", "− ${formatFcfa(analytics.lossesAndBroken)}", c.rose)
                }
                if (analytics.additionalPayroll > 0.0) {
                    PnlLine("− Complément masse salariale RH", "− ${formatFcfa(analytics.additionalPayroll)}", c.rose)
                }
                Spacer(Modifier.height(6.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = (if (netPositive) c.emerald else c.rose).copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, (if (netPositive) c.emerald else c.rose).copy(alpha = 0.45f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("= BÉNÉFICE NET CONSOLIDÉ", color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(
                            formatFcfa(analytics.netProfit),
                            color = if (netPositive) c.emerald else c.rose,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp,
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                PnlLine("Achats stock (hors P&L)", formatFcfa(analytics.purchasesTotal), c.muted)
                PnlLine(
                    "Trésorerie nette après achats",
                    formatFcfa(analytics.cashFlowAfterRestock),
                    if (analytics.cashFlowAfterRestock >= 0) c.emerald else c.accentDeep,
                    bold = true,
                )
            }
        }

        // Répartition des charges consolidées
        item {
            GesmakCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Assessment, contentDescription = null, tint = c.rose, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Répartition des charges consolidées", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
                Spacer(Modifier.height(10.dp))
                if (analytics.categoriesBreakdown.isEmpty()) {
                    Text("Aucune charge enregistrée sur cette période.", color = c.muted, fontSize = 12.sp)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        analytics.categoriesBreakdown.forEach { row ->
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(row.category, color = c.text, fontWeight = FontWeight.Medium, fontSize = 12.sp)
                                    Text(
                                        "${formatFcfa(row.amount)} (${String.format(Locale.US, "%.1f%%", row.pct)})",
                                        color = c.muted,
                                        fontSize = 12.sp,
                                    )
                                }
                                Spacer(Modifier.height(4.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(7.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(c.border),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth((row.pct / 100.0).toFloat().coerceIn(0.04f, 1f))
                                            .height(7.dp)
                                            .background(c.accent, RoundedCornerShape(4.dp)),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Grand livre / filtre des charges et achats
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Détail des charges & achats (${filteredLedger.size})",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "all" to "Tout",
                        "expense" to "Dépenses",
                        "loss" to "Pertes/Casse",
                        "purchase" to "Achats stock",
                    ).forEach { (key, label) ->
                        FilterChip(
                            selected = ledgerFilter == key,
                            onClick = { ledgerFilter = key },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = c.accent,
                                selectedLabelColor = Color.White,
                            ),
                        )
                    }
                }
            }
        }

        if (filteredLedger.isEmpty()) {
            item {
                GesmakCard {
                    Text("Aucune écriture sur ce filtre et cette période.", color = c.muted, fontSize = 12.sp)
                }
            }
        } else {
            items(filteredLedger.take(60), key = { it.id }) { line ->
                GesmakCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        val badgeColor = when (line.source) {
                            "purchase" -> c.sky
                            "loss" -> c.accentDeep
                            else -> c.rose
                        }
                        val icon = when (line.source) {
                            "purchase" -> Icons.Default.Inventory2
                            "loss" -> Icons.Default.WarningAmber
                            else -> Icons.Default.TrendingDown
                        }
                        Icon(icon, contentDescription = null, tint = badgeColor, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(line.category, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                StatusPill(
                                    label = when (line.source) {
                                        "purchase" -> "Stock"
                                        "loss" -> "Perte"
                                        else -> "Charge"
                                    },
                                    color = badgeColor,
                                )
                            }
                            Text(
                                "${line.date} · ${line.description}",
                                color = c.muted,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "− ${formatFcfa(line.amount)}",
                            color = badgeColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }

        item { Spacer(Modifier.height(10.dp)) }
    }
}

@Composable
private fun PnlLine(label: String, value: String, valueColor: Color, bold: Boolean = false) {
    val c = LocalGesmakColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            color = if (bold) c.text else c.muted,
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = 12.sp,
        )
        Text(
            value,
            color = valueColor,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium,
            fontSize = 12.sp,
        )
    }
}

private fun parseReportItemsCost(notes: String?, costMap: Map<String, Double>): Double {
    val trimmed = notes?.trim().orEmpty()
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return 0.0
    return try {
        val arr: JSONArray? = if (trimmed.startsWith("[")) {
            JSONArray(trimmed)
        } else {
            JSONObject(trimmed).optJSONArray("items")
        }
        if (arr == null) return 0.0
        var cogs = 0.0
        for (i in 0 until arr.length()) {
            val it = arr.optJSONObject(i) ?: continue
            val qty = maxOf(0.0, it.optDouble("qty", 0.0))
            if (qty <= 0.0) continue
            val explicitCost = if (it.has("cost") && !it.isNull("cost")) it.optDouble("cost", -1.0) else -1.0
            val pid = it.optString("product_id").ifBlank { null }
            val unitCost = if (explicitCost >= 0.0) explicitCost else (pid?.let { costMap[it] } ?: 0.0)
            cogs += qty * unitCost
        }
        cogs
    } catch (_: Exception) {
        0.0
    }
}

private fun computeFinancialAnalytics(
    periodKey: String,
    includePayroll: Boolean,
    products: List<SupabaseApi.Product>,
    sales: List<SupabaseApi.SaleSummaryRow>,
    expenses: List<SupabaseApi.ExpenseRow>,
    purchases: List<SupabaseApi.PurchaseRow>,
    dailyReports: List<SupabaseApi.DailyReportRow>,
    employees: List<SupabaseApi.EmployeeRow>,
): FinAnalytics {
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val nowCal = Calendar.getInstance()
    val endDate = fmt.format(nowCal.time)

    val startCal = (nowCal.clone() as Calendar)
    when (periodKey) {
        "today" -> Unit
        "7d" -> startCal.add(Calendar.DAY_OF_YEAR, -6)
        "month" -> startCal.set(Calendar.DAY_OF_MONTH, 1)
        "30d" -> startCal.add(Calendar.DAY_OF_YEAR, -29)
        else -> startCal.add(Calendar.DAY_OF_YEAR, -89)
    }
    val startDate = fmt.format(startCal.time)
    val spanDays = (((nowCal.timeInMillis - startCal.timeInMillis) / 86_400_000L).toInt() + 1).coerceAtLeast(1)

    val prevEndCal = (startCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
    val prevStartCal = (prevEndCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -(spanDays - 1)) }
    val prevStartDate = fmt.format(prevStartCal.time)
    val prevEndDate = fmt.format(prevEndCal.time)

    val costMap = products.associate { it.id to maxOf(0.0, it.cost) }
    val nameMap = products.associate { it.id to it.name }

    val periodSales = sales.filter { val d = it.createdAt.take(10); d >= startDate && d <= endDate }
    val periodExpenses = expenses.filter { val d = it.createdAt.take(10); d >= startDate && d <= endDate }
    val periodPurchases = purchases.filter { val d = it.createdAt.take(10); d >= startDate && d <= endDate && it.status != "cancelled" }
    val periodReports = dailyReports.filter { val d = it.date.take(10); d >= startDate && d <= endDate }

    val salesByDay = mutableMapOf<String, Pair<Double, Double>>()
    for (s in periodSales) {
        val d = s.createdAt.take(10)
        val cur = salesByDay[d] ?: (0.0 to 0.0)
        val unitCost = s.productId?.let { costMap[it] } ?: 0.0
        val cogs = s.qty * unitCost
        salesByDay[d] = (cur.first + s.total) to (cur.second + cogs)
    }
    val expByDay = periodExpenses.groupBy { it.createdAt.take(10) }.keys

    var posRev = 0.0
    var posCogs = 0.0
    for ((rev, cogs) in salesByDay.values) {
        posRev += rev
        posCogs += cogs
    }

    var manualRev = 0.0
    var manualCogs = 0.0
    var reportOnlyExpenses = 0.0
    var lossesAndBroken = 0.0
    val extraLines = mutableListOf<FinChargeLine>()

    for (r in periodReports) {
        val d = r.date.take(10)
        if (!salesByDay.containsKey(d) && r.totalSales > 0.0) {
            manualRev += r.totalSales
            manualCogs += parseReportItemsCost(r.notes, costMap)
        }
        if (!expByDay.contains(d) && r.totalExpenses > 0.0) {
            reportOnlyExpenses += r.totalExpenses
            extraLines.add(
                FinChargeLine(
                    id = "rep-exp-${r.id}",
                    date = d,
                    source = "expense",
                    category = "Dépense clôture",
                    description = "Dépenses déclarées au rapport du $d",
                    amount = r.totalExpenses,
                ),
            )
        }
        val lossAmt = maxOf(0.0, r.losses) + maxOf(0.0, r.broken)
        if (lossAmt > 0.0) {
            lossesAndBroken += lossAmt
            extraLines.add(
                FinChargeLine(
                    id = "loss-${r.id}",
                    date = d,
                    source = "loss",
                    category = "Pertes & Casse",
                    description = "Pertes (${formatFcfa(r.losses)}) + Casse (${formatFcfa(r.broken)})",
                    amount = lossAmt,
                ),
            )
        }
    }

    val totalRevenue = posRev + manualRev
    val totalCogs = posCogs + manualCogs
    val grossMargin = totalRevenue - totalCogs

    val expensesTotal = periodExpenses.sumOf { it.amount } + reportOnlyExpenses
    val recordedSalaryExpenses = periodExpenses
        .filter { it.category.lowercase().contains("salaire") }
        .sumOf { it.amount }
    val activeEmployees = employees.filter { it.status == "active" && it.salary > 0.0 }
    val monthlyPayroll = activeEmployees.sumOf { it.salary }
    val proratedPayroll = if (monthlyPayroll > 0.0) kotlin.math.round((monthlyPayroll / 30.0) * spanDays) else 0.0
    val additionalPayroll = if (includePayroll) maxOf(0.0, proratedPayroll - recordedSalaryExpenses) else 0.0

    val purchasesTotal = periodPurchases.sumOf { it.total }
    val consolidatedCharges = expensesTotal + lossesAndBroken + additionalPayroll
    val netProfit = grossMargin - consolidatedCharges
    val netMarginPct = if (totalRevenue > 0.0) (netProfit / totalRevenue) * 100.0 else 0.0
    val cashFlowAfterRestock = totalRevenue - consolidatedCharges - purchasesTotal

    // Période précédente
    val prevSales = sales.filter { val d = it.createdAt.take(10); d >= prevStartDate && d <= prevEndDate }
    val prevExpenses = expenses.filter { val d = it.createdAt.take(10); d >= prevStartDate && d <= prevEndDate }
    val prevReports = dailyReports.filter { val d = it.date.take(10); d >= prevStartDate && d <= prevEndDate }
    val prevSalesDays = prevSales.map { it.createdAt.take(10) }.toSet()
    val prevExpDays = prevExpenses.map { it.createdAt.take(10) }.toSet()
    val prevPosRev = prevSales.sumOf { it.total }
    val prevPosCogs = prevSales.sumOf { it.qty * (it.productId?.let { pid -> costMap[pid] } ?: 0.0) }
    var prevRepRev = 0.0
    var prevRepCogs = 0.0
    var prevRepExp = 0.0
    var prevLosses = 0.0
    for (r in prevReports) {
        val d = r.date.take(10)
        if (!prevSalesDays.contains(d)) {
            prevRepRev += r.totalSales
            prevRepCogs += parseReportItemsCost(r.notes, costMap)
        }
        if (!prevExpDays.contains(d)) prevRepExp += r.totalExpenses
        prevLosses += maxOf(0.0, r.losses) + maxOf(0.0, r.broken)
    }
    val prevCharges = prevExpenses.sumOf { it.amount } + prevRepExp + prevLosses + additionalPayroll
    val prevNetProfit = ((prevPosRev + prevRepRev) - (prevPosCogs + prevRepCogs)) - prevCharges

    val catMap = mutableMapOf<String, Double>()
    for (e in periodExpenses) {
        val cat = e.category.ifBlank { "Autre" }
        catMap[cat] = (catMap[cat] ?: 0.0) + e.amount
    }
    if (reportOnlyExpenses > 0.0) {
        catMap["Dépenses clôture"] = (catMap["Dépenses clôture"] ?: 0.0) + reportOnlyExpenses
    }
    if (lossesAndBroken > 0.0) {
        catMap["Pertes & Casse"] = (catMap["Pertes & Casse"] ?: 0.0) + lossesAndBroken
    }
    if (additionalPayroll > 0.0) {
        catMap["Masse salariale (prorata RH)"] = (catMap["Masse salariale (prorata RH)"] ?: 0.0) + additionalPayroll
    }
    val categoriesBreakdown = catMap.entries
        .map { (cat, amt) ->
            FinCategorySlice(
                category = cat,
                amount = amt,
                pct = if (consolidatedCharges > 0.0) (amt / consolidatedCharges) * 100.0 else 0.0,
            )
        }
        .sortedByDescending { it.amount }

    val ledger = buildList {
        periodExpenses.forEach { e ->
            add(
                FinChargeLine(
                    id = "exp-${e.id}",
                    date = e.createdAt.take(10),
                    source = "expense",
                    category = e.category.ifBlank { "Autre" },
                    description = e.description ?: e.category.ifBlank { "Dépense" },
                    amount = e.amount,
                ),
            )
        }
        addAll(extraLines)
        periodPurchases.forEach { p ->
            add(
                FinChargeLine(
                    id = "pur-${p.id}",
                    date = p.createdAt.take(10),
                    source = "purchase",
                    category = "Achat stock",
                    description = "${p.productId?.let { nameMap[it] } ?: "Réapprovisionnement"} × ${p.qty.toInt()}${p.notes?.let { " · $it" } ?: ""}",
                    amount = p.total,
                ),
            )
        }
    }.sortedByDescending { it.date }

    return FinAnalytics(
        startDate = startDate,
        endDate = endDate,
        spanDays = spanDays,
        totalRevenue = totalRevenue,
        totalCogs = totalCogs,
        grossMargin = grossMargin,
        expensesTotal = expensesTotal,
        lossesAndBroken = lossesAndBroken,
        additionalPayroll = additionalPayroll,
        consolidatedCharges = consolidatedCharges,
        purchasesTotal = purchasesTotal,
        netProfit = netProfit,
        netMarginPct = netMarginPct,
        cashFlowAfterRestock = cashFlowAfterRestock,
        prevNetProfit = prevNetProfit,
        activeEmployeesCount = activeEmployees.size,
        categoriesBreakdown = categoriesBreakdown,
        ledger = ledger,
    )
}
