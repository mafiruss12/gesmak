package com.gesmak.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.ProductThumb
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr
import com.gesmak.app.ui.theme.roleLabelFr
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private val ORDER_PAYMENT_MODES = listOf(
    "cash" to "Espèces",
    "wave" to "Wave",
    "orange_money" to "Orange Money",
    "mtn_money" to "MTN Money",
    "card" to "Carte",
    "mixed" to "Mixte",
)

private val CANCEL_MOTIFS = listOf(
    "Client parti",
    "Rupture de stock",
    "Erreur de saisie",
    "Commande en doublon",
)

private fun parseOrderEpochMs(iso: String): Long? {
    val clean = iso.replace("+00:00", "Z").take(24)
    val fmts = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss",
    )
    for (p in fmts) {
        try {
            val f = SimpleDateFormat(p, Locale.US)
            f.timeZone = TimeZone.getTimeZone("UTC")
            val d = f.parse(clean)
            if (d != null) return d.time
        } catch (_: Exception) { }
    }
    return null
}

private fun formatElapsedSla(createdAt: String, nowMs: Long): Pair<String, Int> {
    val startMs = parseOrderEpochMs(createdAt) ?: return "—" to 0
    val diffMin = ((nowMs - startMs) / 60_000L).toInt().coerceAtLeast(0)
    val txt = when {
        diffMin < 1 -> "<1 min"
        diffMin < 60 -> "$diffMin min"
        else -> "${diffMin / 60}h${(diffMin % 60).toString().padStart(2, '0')}"
    }
    return txt to diffMin
}

private fun formatOrderClock(createdAt: String): String {
    val ms = parseOrderEpochMs(createdAt) ?: return createdAt.drop(11).take(5)
    return SimpleDateFormat("HH:mm", Locale.FRANCE).format(Date(ms))
}

private fun paymentLabelFr(pm: String?): String = when (pm?.lowercase()) {
    "cash" -> "Espèces"
    "wave" -> "Wave"
    "orange_money" -> "Orange"
    "mtn_money" -> "MTN"
    "mobile", "mobile_money" -> "Mobile"
    "card" -> "Carte"
    "mixed" -> "Mixte"
    else -> pm ?: "Payée"
}

@Composable
fun OrdersScreen(
    mod: Modifier = Modifier,
    orders: List<SupabaseApi.OrderRow>,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    tables: List<SupabaseApi.RestaurantTableRow>,
    poles: List<SupabaseApi.EstablishmentPole> = emptyList(),
    teamMembers: List<SupabaseApi.Member> = emptyList(),
    activePoleCode: String?,
    loading: Boolean,
    busyId: String?,
    onRefresh: () -> Unit,
    onLoadItems: (orderId: String, cb: (List<SupabaseApi.OrderItemRow>) -> Unit) -> Unit,
    onUpdateItemStatus: (orderId: String, itemId: String, status: String, cb: () -> Unit) -> Unit,
    onAdvance: (orderId: String, nextStatus: String) -> Unit,
    onAssignServer: (order: SupabaseApi.OrderRow, serverId: String?, serverName: String?, cb: (String?) -> Unit) -> Unit = { _, _, _, cb -> cb(null) },
    onAppendItems: (order: SupabaseApi.OrderRow, extraNote: String?, lines: List<Pair<SupabaseApi.Product, Int>>, cb: (String?) -> Unit) -> Unit = { _, _, _, cb -> cb(null) },
    onCancelWithReason: (order: SupabaseApi.OrderRow, reason: String, cb: (String?) -> Unit) -> Unit = { _, _, cb -> cb(null) },
    onCloseAndPay: (order: SupabaseApi.OrderRow, selectedItemIds: Set<String>?, paymentMethod: String, cb: (String?) -> Unit) -> Unit = { _, _, _, cb -> cb(null) },
    onCreateOrder: (
        tableId: String?,
        tableNumber: String?,
        customerName: String?,
        orderType: String,
        poleCode: String?,
        notes: String?,
        serverId: String?,
        serverName: String?,
        lines: List<Pair<SupabaseApi.Product, Int>>,
        cb: (String?) -> Unit,
    ) -> Unit,
) {
    val c = LocalGesmakColors.current
    val clipboard = LocalClipboardManager.current

    var filter by remember { mutableStateOf("open") }
    var searchQuery by remember { mutableStateOf("") }
    var createOpen by remember { mutableStateOf(false) }
    var appendTarget by remember { mutableStateOf<SupabaseApi.OrderRow?>(null) }
    var assignTarget by remember { mutableStateOf<SupabaseApi.OrderRow?>(null) }
    var cancelTarget by remember { mutableStateOf<SupabaseApi.OrderRow?>(null) }
    var payTarget by remember { mutableStateOf<SupabaseApi.OrderRow?>(null) }
    var receiptTarget by remember { mutableStateOf<SupabaseApi.OrderRow?>(null) }
    var feedbackMsg by remember { mutableStateOf<String?>(null) }
    val loadedItems = remember { mutableStateMapOf<String, List<SupabaseApi.OrderItemRow>>() }
    val expandedCards = remember { mutableStateMapOf<String, Boolean>() }

    // Ticker SLA chaque 30s
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000L)
            nowMs = System.currentTimeMillis()
        }
    }

    // Précharger les articles des commandes actives pour affichage pro immédiat
    LaunchedEffect(orders) {
        orders.filter { it.status in setOf("pending", "preparing", "ready") || (it.status == "served" && it.paidAt.isNullOrBlank()) }
            .take(25)
            .forEach { ord ->
                if (!loadedItems.containsKey(ord.id)) {
                    onLoadItems(ord.id) { items -> loadedItems[ord.id] = items }
                }
            }
    }

    val pendingCount = orders.count { it.status == "pending" }
    val preparingCount = orders.count { it.status == "preparing" }
    val readyCount = orders.count { it.status == "ready" }
    val toPayCount = orders.count { it.status == "served" && it.paidAt.isNullOrBlank() }
    val activeRevenue = orders.filter { it.status != "cancelled" && it.paidAt.isNullOrBlank() }.sumOf { it.total }

    val filtered = remember(orders, filter, searchQuery) {
        val q = searchQuery.trim().lowercase()
        orders.filter { o ->
            val matchFilter = when (filter) {
                "pending" -> o.status == "pending"
                "preparing" -> o.status == "preparing"
                "ready" -> o.status == "ready"
                "unpaid" -> o.status == "served" && o.paidAt.isNullOrBlank()
                "paid" -> o.status == "served" && !o.paidAt.isNullOrBlank()
                "cancelled" -> o.status == "cancelled"
                else -> o.status in setOf("pending", "preparing", "ready") || (o.status == "served" && o.paidAt.isNullOrBlank())
            }
            if (!matchFilter) return@filter false
            if (q.isBlank()) return@filter true
            val hay = listOfNotNull(
                o.tableNumber?.let { "table $it" },
                o.customerName,
                o.serverName,
                o.poleCode,
                o.id.take(8),
                o.notes,
            ).joinToString(" ").lowercase()
            hay.contains(q)
        }
    }

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        // En-tête Pro
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Commandes Pro", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text(
                    "Encours à encaisser : ${formatFcfa(activeRevenue)}",
                    color = c.accentDeep,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                )
            }
            Button(
                onClick = { appendTarget = null; createOpen = true },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Nouvelle", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            IconButton(onClick = onRefresh, enabled = !loading) {
                if (loading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = c.accent, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                }
            }
        }

        if (!feedbackMsg.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Surface(shape = RoundedCornerShape(10.dp), color = c.emerald.copy(alpha = 0.14f), modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(feedbackMsg!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text("OK", color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.clickable { feedbackMsg = null })
                }
            }
        }

        // Compteurs pipeline
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusPill(label = "$pendingCount À valider", color = c.accent)
            StatusPill(label = "$preparingCount En prépa", color = c.sky)
            StatusPill(label = "$readyCount Prêtes", color = c.emerald)
            if (toPayCount > 0) StatusPill(label = "$toPayCount À encaisser", color = c.rose)
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = c.muted, modifier = Modifier.size(18.dp)) },
            placeholder = { Text("Table, client, serveur, n° ticket…", fontSize = 12.sp) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(6.dp))
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val filters = listOf(
                "open" to "Actives",
                "pending" to "Nouvelles ($pendingCount)",
                "preparing" to "En prépa ($preparingCount)",
                "ready" to "Prêtes ($readyCount)",
                "unpaid" to "À encaisser ($toPayCount)",
                "paid" to "Soldées",
                "cancelled" to "Annulées",
            )
            filters.forEach { (key, label) ->
                FilterChip(
                    selected = filter == key,
                    onClick = { filter = key },
                    label = { Text(label, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = c.accent,
                        selectedLabelColor = Color.White,
                    ),
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (filtered.isEmpty()) {
                item {
                    GesmakCard {
                        Text("Aucune commande dans cet onglet.", color = c.muted, fontSize = 13.sp)
                    }
                }
            }
            items(filtered, key = { it.id }) { o ->
                val isOpen = expandedCards[o.id] ?: (o.status in setOf("pending", "preparing", "ready"))
                val isPaid = !o.paidAt.isNullOrBlank()
                val (statusLabel, statusColor) = when {
                    o.status == "pending" -> "Nouvelle" to c.accent
                    o.status == "preparing" -> "En prépa" to c.sky
                    o.status == "ready" -> "Prête" to c.emerald
                    o.status == "served" && isPaid -> "Soldée" to c.emerald
                    o.status == "served" -> "Servie · À encaisser" to c.accentDeep
                    o.status == "cancelled" -> "Annulée" to c.rose
                    else -> o.status to c.muted
                }
                val (slaTxt, slaMin) = formatElapsedSla(o.createdAt, nowMs)
                val slaColor = when {
                    o.status in setOf("served", "cancelled") -> c.muted
                    slaMin >= 20 -> c.rose
                    slaMin >= 10 -> c.accent
                    else -> c.emerald
                }
                val typeLabel = when {
                    !o.tableNumber.isNullOrBlank() -> "Table ${o.tableNumber}"
                    o.orderType == "takeaway" -> "À emporter"
                    o.orderType == "delivery" -> "Livraison"
                    else -> "Comptoir"
                }

                GesmakCard(
                    borderColor = when (o.status) {
                        "pending" -> c.accent.copy(alpha = 0.5f)
                        "ready" -> c.emerald.copy(alpha = 0.5f)
                        "cancelled" -> c.rose.copy(alpha = 0.35f)
                        else -> null
                    },
                ) {
                    // En-tête Ticket #CMD + SLA + Total
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val nextOpen = !isOpen
                                expandedCards[o.id] = nextOpen
                                if (nextOpen && !loadedItems.containsKey(o.id)) {
                                    onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                }
                            },
                        verticalAlignment = Alignment.Top,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(
                                    "#${o.id.take(6).uppercase()}",
                                    color = c.muted,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                )
                                Text("· ${formatOrderClock(o.createdAt)}", color = c.muted, fontSize = 11.sp)
                                if (o.status !in setOf("served", "cancelled")) {
                                    Surface(shape = RoundedCornerShape(999.dp), color = slaColor.copy(alpha = 0.14f)) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Icon(Icons.Default.Schedule, contentDescription = null, tint = slaColor, modifier = Modifier.size(11.dp))
                                            Spacer(Modifier.width(2.dp))
                                            Text(slaTxt, color = slaColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                                if (o.source == "qr_table") {
                                    StatusPill(label = "QR", color = c.sky)
                                }
                            }
                            Spacer(Modifier.height(3.dp))
                            Text(
                                "$typeLabel${o.customerName?.let { " · $it" } ?: ""}",
                                color = c.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                            ) {
                                StatusPill(label = statusLabel, color = statusColor)
                                if (!o.poleCode.isNullOrBlank()) {
                                    StatusPill(label = poleLabelFr(o.poleCode), color = poleColorHex(o.poleCode))
                                }
                                StatusPill(
                                    label = o.serverName?.let { "👤 $it" } ?: "👤 Sans serveur",
                                    color = if (o.serverName != null) c.sky else c.muted,
                                )
                                if (isPaid) {
                                    StatusPill(label = "Payée · ${paymentLabelFr(o.paymentMethod)}", color = c.emerald)
                                } else if (o.status != "cancelled") {
                                    StatusPill(label = "À encaisser", color = c.accent)
                                }
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(formatFcfa(o.total), color = c.accent, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                            Icon(
                                if (isOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = c.muted,
                            )
                        }
                    }

                    // Remarques / Notes cuisine & bar
                    if (!o.notes.isNullOrBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = c.accentSoft,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "Note : ${o.notes}",
                                color = c.accentDeep,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                            )
                        }
                    }

                    // Lignes d'articles
                    if (isOpen) {
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider(color = c.border)
                        Spacer(Modifier.height(6.dp))
                        val items = loadedItems[o.id]
                        if (items == null) {
                            Text("Chargement des articles…", color = c.muted, fontSize = 12.sp)
                        } else if (items.isEmpty()) {
                            Text("Aucun article détaillé.", color = c.muted, fontSize = 12.sp)
                        } else {
                            items.forEach { it ->
                                val linkedProd = remember(it.productId, it.productName, products) {
                                    products.find { p -> p.id == it.productId || p.name.equals(it.productName, ignoreCase = true) }
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    ProductThumb(
                                        name = it.productName,
                                        category = linkedProd?.category,
                                        imageUrl = linkedProd?.imageUrl,
                                        remoteDefaults = productImageDefaults,
                                        size = 32.dp,
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${it.quantity}× ${it.productName}", color = c.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                        Text(formatFcfa(it.unitPrice * it.quantity), color = c.muted, fontSize = 11.sp)
                                    }
                                    if (it.status != "ready" && it.status != "served" && o.status in setOf("pending", "preparing")) {
                                        OutlinedButton(onClick = {
                                            onUpdateItemStatus(o.id, it.id, "ready") {
                                                onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                            }
                                        }) {
                                            Icon(Icons.Default.Check, contentDescription = null, tint = c.emerald, modifier = Modifier.size(14.dp))
                                            Spacer(Modifier.width(3.dp))
                                            Text("Prêt", color = c.emerald, fontSize = 11.sp)
                                        }
                                    } else if (!it.status.isNullOrBlank()) {
                                        val itLabel = when (it.status) {
                                            "preparing" -> "Prépa"
                                            "ready" -> "Prêt"
                                            "served" -> "Servi"
                                            else -> "Attente"
                                        }
                                        val itColor = if (it.status in setOf("ready", "served")) c.emerald else c.sky
                                        StatusPill(label = itLabel, color = itColor)
                                    }
                                }
                            }
                        }
                    }

                    // Actions Pro complètes
                    if (o.status != "cancelled") {
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            when (o.status) {
                                "pending" -> {
                                    Button(
                                        onClick = { onAdvance(o.id, "preparing") },
                                        enabled = busyId != o.id,
                                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Text("Préparer", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                "preparing" -> {
                                    Button(
                                        onClick = { onAdvance(o.id, "ready") },
                                        enabled = busyId != o.id,
                                        colors = ButtonDefaults.buttonColors(containerColor = c.sky, contentColor = Color.White),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Text("Marquer prête", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                "ready" -> {
                                    Button(
                                        onClick = {
                                            if (!loadedItems.containsKey(o.id)) onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                            payTarget = o
                                        },
                                        enabled = busyId != o.id,
                                        colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Icon(Icons.Default.Wallet, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Encaisser", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                    OutlinedButton(
                                        onClick = { onAdvance(o.id, "served") },
                                        enabled = busyId != o.id,
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Text("Servir", color = c.text, fontSize = 12.sp)
                                    }
                                }
                                "served" -> {
                                    if (!isPaid) {
                                        Button(
                                            onClick = {
                                                if (!loadedItems.containsKey(o.id)) onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                                payTarget = o
                                            },
                                            enabled = busyId != o.id,
                                            colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(10.dp),
                                        ) {
                                            Icon(Icons.Default.Wallet, contentDescription = null, modifier = Modifier.size(15.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Encaisser & clôturer", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    } else {
                                        OutlinedButton(
                                            onClick = {
                                                if (!loadedItems.containsKey(o.id)) onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                                receiptTarget = o
                                            },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(10.dp),
                                        ) {
                                            Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Addition / Reçu", color = c.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }

                        // Rangée secondaire pro : Serveur · + Ajouter tour · Addition · Annuler
                        if (!isPaid) {
                            Spacer(Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                OutlinedButton(onClick = { assignTarget = o }, shape = RoundedCornerShape(8.dp)) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = c.sky, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(3.dp))
                                    Text("Serveur", color = c.sky, fontSize = 11.sp)
                                }
                                OutlinedButton(onClick = { appendTarget = o; createOpen = true }, shape = RoundedCornerShape(8.dp)) {
                                    Icon(Icons.Default.AddShoppingCart, contentDescription = null, tint = c.accent, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(3.dp))
                                    Text("+ Tour", color = c.accent, fontSize = 11.sp)
                                }
                                if (o.status != "ready" && o.status != "served") {
                                    OutlinedButton(
                                        onClick = {
                                            if (!loadedItems.containsKey(o.id)) onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                            payTarget = o
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                    ) {
                                        Icon(Icons.Default.Wallet, contentDescription = null, tint = c.emerald, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(3.dp))
                                        Text("Encaisser", color = c.emerald, fontSize = 11.sp)
                                    }
                                }
                                OutlinedButton(
                                    onClick = {
                                        if (!loadedItems.containsKey(o.id)) onLoadItems(o.id) { list -> loadedItems[o.id] = list }
                                        receiptTarget = o
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                ) {
                                    Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = c.muted, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(3.dp))
                                    Text("Ticket", color = c.muted, fontSize = 11.sp)
                                }
                                if (o.status != "served") {
                                    OutlinedButton(onClick = { cancelTarget = o }, shape = RoundedCornerShape(8.dp)) {
                                        Icon(Icons.Default.Cancel, contentDescription = null, tint = c.rose, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(3.dp))
                                        Text("Annuler", color = c.rose, fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MODAL CRÉATION / AJOUT D'UN TOUR
    if (createOpen) {
        val appending = appendTarget
        var selectedTableId by remember { mutableStateOf(appending?.tableId ?: "") }
        var tableNumber by remember { mutableStateOf(appending?.tableNumber ?: "") }
        var customerName by remember { mutableStateOf(appending?.customerName ?: "") }
        var orderType by remember { mutableStateOf(appending?.orderType ?: "dine_in") }
        var chosenPole by remember { mutableStateOf(appending?.poleCode ?: activePoleCode) }
        var chosenServerId by remember { mutableStateOf(appending?.serverId) }
        var chosenServerName by remember { mutableStateOf(appending?.serverName) }
        var notes by remember { mutableStateOf("") }
        var query by remember { mutableStateOf("") }
        val qtyMap = remember { mutableStateMapOf<String, Int>() }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }

        val total = products.sumOf { (qtyMap[it.id] ?: 0) * it.price }
        val filteredProds = remember(products, query) {
            products.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }.take(25)
        }

        AlertDialog(
            onDismissRequest = { if (!busy) { createOpen = false; appendTarget = null } },
            containerColor = c.card,
            title = {
                Text(
                    if (appending != null) "Ajouter un tour · ${appending.tableNumber?.let { "Table $it" } ?: "#${appending.id.take(6)}"}"
                    else "Nouvelle commande",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (appending == null) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("dine_in" to "Sur place", "takeaway" to "À emporter", "delivery" to "Livraison").forEach { (k, l) ->
                                FilterChip(
                                    selected = orderType == k,
                                    onClick = { orderType = k },
                                    label = { Text(l, fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                                )
                            }
                        }
                        if (orderType == "dine_in") {
                            if (tables.isNotEmpty()) {
                                Text("Table :", color = c.muted, fontSize = 11.sp)
                                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    FilterChip(
                                        selected = selectedTableId.isBlank() && tableNumber.isBlank(),
                                        onClick = { selectedTableId = ""; tableNumber = "" },
                                        label = { Text("Comptoir", fontSize = 11.sp) },
                                    )
                                    tables.forEach { t ->
                                        val isOccupied = t.status == "occupied"
                                        FilterChip(
                                            selected = selectedTableId == t.id || tableNumber == t.number,
                                            onClick = {
                                                selectedTableId = t.id
                                                tableNumber = t.number
                                                if (!t.serverId.isNullOrBlank()) {
                                                    chosenServerId = t.serverId
                                                    chosenServerName = t.serverName
                                                }
                                            },
                                            label = {
                                                Text(
                                                    "T${t.number}${if (isOccupied) " •" else ""}",
                                                    fontSize = 11.sp,
                                                )
                                            },
                                        )
                                    }
                                }
                            } else {
                                OutlinedTextField(value = tableNumber, onValueChange = { tableNumber = it }, label = { Text("N° Table (optionnel)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            }
                        }
                        OutlinedTextField(value = customerName, onValueChange = { customerName = it }, label = { Text("Nom du client") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                        if (poles.isNotEmpty()) {
                            Text("Pôle / Service :", color = c.muted, fontSize = 11.sp)
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FilterChip(selected = chosenPole == null, onClick = { chosenPole = null }, label = { Text("Général", fontSize = 11.sp) })
                                poles.forEach { p ->
                                    FilterChip(
                                        selected = chosenPole == p.code,
                                        onClick = { chosenPole = p.code },
                                        label = { Text(p.name, fontSize = 11.sp) },
                                    )
                                }
                            }
                        }

                        if (teamMembers.isNotEmpty()) {
                            Text("Serveur attribué :", color = c.muted, fontSize = 11.sp)
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FilterChip(
                                    selected = chosenServerId == null,
                                    onClick = { chosenServerId = null; chosenServerName = null },
                                    label = { Text("Moi-même", fontSize = 11.sp) },
                                )
                                teamMembers.forEach { m ->
                                    FilterChip(
                                        selected = chosenServerId == m.userId,
                                        onClick = { chosenServerId = m.userId; chosenServerName = m.fullName },
                                        label = { Text(m.fullName.ifBlank { "Membre" }, fontSize = 11.sp) },
                                    )
                                }
                            }
                        }
                    }

                    OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Rechercher produit…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    filteredProds.forEach { p ->
                        val q = qtyMap[p.id] ?: 0
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            ProductThumb(
                                name = p.name,
                                category = p.category,
                                imageUrl = p.imageUrl,
                                remoteDefaults = productImageDefaults,
                                size = 38.dp,
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(p.name, color = c.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text("${formatFcfa(p.price)} · stock ${p.stock.toInt()}", color = c.muted, fontSize = 11.sp)
                            }
                            TextButton(onClick = { if (q > 0) qtyMap[p.id] = q - 1 }) { Text("-", color = c.rose) }
                            Text("$q", color = c.text, fontWeight = FontWeight.Bold)
                            TextButton(onClick = { qtyMap[p.id] = q + 1 }) { Text("+", color = c.emerald) }
                        }
                    }
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text(if (appending != null) "Note ajout (ex: bien frais)" else "Remarques cuisine / bar") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Surface(color = c.accentSoft, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                        Text(
                            if (appending != null) "Supplément : ${formatFcfa(total)}" else "Total ticket : ${formatFcfa(total)}",
                            color = c.accentDeep,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val lines = products.mapNotNull { p ->
                            val q = qtyMap[p.id] ?: 0
                            if (q > 0) p to q else null
                        }
                        if (lines.isEmpty()) { err = "Ajoutez au moins 1 article."; return@Button }
                        busy = true
                        if (appending != null) {
                            onAppendItems(appending, notes.ifBlank { null }, lines) { e ->
                                busy = false
                                if (e == null) {
                                    loadedItems.remove(appending.id)
                                    onLoadItems(appending.id) { list -> loadedItems[appending.id] = list }
                                    feedbackMsg = "Articles ajoutés à la commande."
                                    createOpen = false
                                    appendTarget = null
                                } else {
                                    err = e
                                }
                            }
                        } else {
                            onCreateOrder(
                                selectedTableId.ifBlank { null },
                                tableNumber.ifBlank { null },
                                customerName.ifBlank { null },
                                orderType,
                                chosenPole,
                                notes.ifBlank { null },
                                chosenServerId,
                                chosenServerName,
                                lines,
                            ) { e ->
                                busy = false
                                if (e == null) {
                                    feedbackMsg = "Commande envoyée en préparation."
                                    createOpen = false
                                } else {
                                    err = e
                                }
                            }
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "..." else if (appending != null) "Ajouter au ticket" else "Envoyer commande") }
            },
            dismissButton = {
                TextButton(onClick = { createOpen = false; appendTarget = null }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // MODAL ATTRIBUTION SERVEUR
    val aOrder = assignTarget
    if (aOrder != null) {
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { if (!busy) assignTarget = null },
            containerColor = c.card,
            title = {
                Text(
                    "Attribuer un serveur · ${aOrder.tableNumber?.let { "Table $it" } ?: "#${aOrder.id.take(6)}"}",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (teamMembers.isEmpty()) {
                        Text("Aucun membre actif trouvé dans l'équipe.", color = c.muted, fontSize = 12.sp)
                    } else {
                        teamMembers.forEach { m ->
                            val isCurrent = aOrder.serverId == m.userId
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isCurrent) c.accentSoft else c.bg,
                                border = BorderStroke(1.dp, if (isCurrent) c.accent else c.border),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = !busy) {
                                        busy = true
                                        onAssignServer(aOrder, m.userId, m.fullName) { e ->
                                            busy = false
                                            if (e == null) {
                                                feedbackMsg = "Serveur attribué : ${m.fullName}"
                                                assignTarget = null
                                            } else {
                                                err = e
                                            }
                                        }
                                    },
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Column {
                                        Text(m.fullName.ifBlank { "Membre" }, color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text(roleLabelFr(m.role), color = c.muted, fontSize = 11.sp)
                                    }
                                    if (isCurrent) StatusPill(label = "Actuel", color = c.accent)
                                }
                            }
                        }
                    }
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = { assignTarget = null }, enabled = !busy) { Text("Fermer", color = c.muted) }
            },
        )
    }

    // MODAL ANNULATION AVEC MOTIF
    val cOrder = cancelTarget
    if (cOrder != null) {
        var motif by remember { mutableStateOf(CANCEL_MOTIFS.first()) }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { if (!busy) cancelTarget = null },
            containerColor = c.card,
            title = { Text("Annuler la commande", color = c.rose, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "${cOrder.tableNumber?.let { "Table $it" } ?: "#${cOrder.id.take(6)}"} · ${formatFcfa(cOrder.total)}",
                        color = c.text,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                    )
                    Text("Motif d'annulation (enregistré au journal) :", color = c.muted, fontSize = 11.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        CANCEL_MOTIFS.forEach { m ->
                            FilterChip(
                                selected = motif == m,
                                onClick = { motif = m },
                                label = { Text(m, fontSize = 11.sp) },
                            )
                        }
                    }
                    OutlinedTextField(
                        value = motif,
                        onValueChange = { motif = it },
                        label = { Text("Motif détaillé") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        busy = true
                        onCancelWithReason(cOrder, motif) { e ->
                            busy = false
                            if (e == null) {
                                feedbackMsg = "Commande annulée ($motif)."
                                cancelTarget = null
                            } else {
                                err = e
                            }
                        }
                    },
                    enabled = !busy && motif.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = c.rose, contentColor = Color.White),
                ) { Text(if (busy) "..." else "Confirmer l'annulation") }
            },
            dismissButton = {
                TextButton(onClick = { cancelTarget = null }, enabled = !busy) { Text("Retour", color = c.muted) }
            },
        )
    }

    // MODAL ENCAISSEMENT & CLÔTURE PRO (AVEC SCISSION D'ADDITION)
    val pOrder = payTarget
    if (pOrder != null) {
        val items = loadedItems[pOrder.id].orEmpty()
        val unpaidItems = items.filter { it.status != "served" }.ifEmpty { items }
        var payMethod by remember { mutableStateOf("cash") }
        var splitMode by remember { mutableStateOf(false) }
        val selectedIds = remember(pOrder.id) { mutableStateMapOf<String, Boolean>() }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }

        val amountDue = if (splitMode && unpaidItems.isNotEmpty()) {
            unpaidItems.filter { selectedIds[it.id] == true }.sumOf { it.unitPrice * it.quantity }
        } else {
            pOrder.total
        }

        AlertDialog(
            onDismissRequest = { if (!busy) payTarget = null },
            containerColor = c.card,
            title = {
                Text(
                    "Encaisser · ${pOrder.tableNumber?.let { "Table $it" } ?: pOrder.customerName ?: "#${pOrder.id.take(6)}"}",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "Enregistre la vente en caisse, déduit le stock automatiquement et libère la table.",
                        color = c.muted,
                        fontSize = 11.sp,
                    )
                    Surface(shape = RoundedCornerShape(10.dp), color = c.accentSoft, modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("À encaisser", color = c.accentDeep, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(formatFcfa(amountDue), color = c.accentDeep, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                        }
                    }

                    if (unpaidItems.size > 1) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = !splitMode,
                                onClick = { splitMode = false },
                                label = { Text("Addition complète", fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                            FilterChip(
                                selected = splitMode,
                                onClick = { splitMode = true },
                                label = { Text("Scission (par article)", fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }

                    if (splitMode) {
                        unpaidItems.forEach { it ->
                            val checked = selectedIds[it.id] == true
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedIds[it.id] = !checked },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(checked = checked, onCheckedChange = { v -> selectedIds[it.id] = v })
                                Text("${it.quantity}× ${it.productName}", color = c.text, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                Text(formatFcfa(it.unitPrice * it.quantity), color = c.accentDeep, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Text("Mode de règlement :", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        ORDER_PAYMENT_MODES.forEach { (k, label) ->
                            FilterChip(
                                selected = payMethod == k,
                                onClick = { payMethod = k },
                                label = { Text(label, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.emerald,
                                    selectedLabelColor = Color.White,
                                ),
                            )
                        }
                    }
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val splitSet = if (splitMode) selectedIds.filterValues { it }.keys else null
                        if (splitMode && splitSet.isNullOrEmpty()) {
                            err = "Cochez au moins 1 article à encaisser."
                            return@Button
                        }
                        busy = true
                        onCloseAndPay(pOrder, splitSet, payMethod) { e ->
                            busy = false
                            if (e == null) {
                                loadedItems.remove(pOrder.id)
                                feedbackMsg = if (splitMode) "Addition partielle encaissée." else "Commande encaissée & clôturée."
                                payTarget = null
                            } else {
                                err = e
                            }
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(if (busy) "..." else "Valider l'encaissement")
                }
            },
            dismissButton = {
                TextButton(onClick = { payTarget = null }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // MODAL TICKET / ADDITION CLIENT
    val rOrder = receiptTarget
    if (rOrder != null) {
        val items = loadedItems[rOrder.id].orEmpty()
        val receiptText = buildString {
            appendLine("=== ADDITION GESMAK ===")
            appendLine("Ticket #${rOrder.id.take(6).uppercase()}")
            appendLine(rOrder.tableNumber?.let { "Table : $it" } ?: (rOrder.orderType ?: "Comptoir"))
            if (!rOrder.customerName.isNullOrBlank()) appendLine("Client : ${rOrder.customerName}")
            if (!rOrder.serverName.isNullOrBlank()) appendLine("Serveur : ${rOrder.serverName}")
            appendLine("Heure : ${formatOrderClock(rOrder.createdAt)}")
            appendLine("-----------------------")
            items.forEach { it ->
                appendLine("${it.quantity}x ${it.productName} : ${formatFcfa(it.unitPrice * it.quantity)}")
            }
            appendLine("-----------------------")
            appendLine("TOTAL : ${formatFcfa(rOrder.total)}")
            appendLine(if (!rOrder.paidAt.isNullOrBlank()) "Statut : PAYÉE (${paymentLabelFr(rOrder.paymentMethod)})" else "Statut : À ENCAISSER")
        }
        AlertDialog(
            onDismissRequest = { receiptTarget = null },
            containerColor = c.card,
            title = { Text("Addition · #${rOrder.id.take(6).uppercase()}", color = c.text, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "${rOrder.tableNumber?.let { "Table $it" } ?: "Comptoir"}${rOrder.customerName?.let { " · $it" } ?: ""}",
                        color = c.text,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (!rOrder.serverName.isNullOrBlank()) {
                        Text("Serveur : ${rOrder.serverName}", color = c.muted, fontSize = 12.sp)
                    }
                    HorizontalDivider(color = c.border)
                    if (items.isEmpty()) {
                        Text("Chargement…", color = c.muted, fontSize = 12.sp)
                    } else {
                        items.forEach { it ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${it.quantity}× ${it.productName}", color = c.text, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                Text(formatFcfa(it.unitPrice * it.quantity), color = c.text, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                    HorizontalDivider(color = c.border)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("TOTAL", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(formatFcfa(rOrder.total), color = c.accent, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                    }
                    Text(
                        if (!rOrder.paidAt.isNullOrBlank()) "Payée par ${paymentLabelFr(rOrder.paymentMethod)}" else "Non encore encaissée",
                        color = if (!rOrder.paidAt.isNullOrBlank()) c.emerald else c.accentDeep,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        clipboard.setText(AnnotatedString(receiptText))
                        feedbackMsg = "Addition copiée dans le presse-papiers."
                        receiptTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Copier ticket", fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { receiptTarget = null }) { Text("Fermer", color = c.muted) }
            },
        )
    }
}
