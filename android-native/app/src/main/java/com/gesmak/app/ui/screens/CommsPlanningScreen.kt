package com.gesmak.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.ProductThumb
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

// ==================== 1. CHAT INTERNE (ÉQUIPE & DM) ====================

@Composable
fun ChatScreen(
    mod: Modifier = Modifier,
    myUserId: String,
    team: List<SupabaseApi.Member>,
    groupMessages: List<SupabaseApi.ChatMessageRow>,
    dmMessages: List<SupabaseApi.ChatMessageRow>,
    selectedPeer: SupabaseApi.Member?,
    onSelectPeer: (SupabaseApi.Member?) -> Unit,
    onRefresh: () -> Unit,
    onSendGroup: (String, cb: (String?) -> Unit) -> Unit,
    onSendDm: (peerUserId: String, String, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    var mode by remember { mutableStateOf(if (selectedPeer != null) "dm" else "group") }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    Column(
        modifier = mod.fillMaxSize().background(c.bg).padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Chat, contentDescription = null, tint = c.accent)
            Spacer(Modifier.width(8.dp))
            Text("Chat Interne", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent) }
        }
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = mode == "group",
                onClick = { mode = "group"; onSelectPeer(null) },
                label = { Text("Équipe (${groupMessages.size})") },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
            )
            FilterChip(
                selected = mode == "dm",
                onClick = { mode = "dm" },
                label = { Text("Messages Privés") },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.sky, selectedLabelColor = Color.White),
            )
        }
        if (mode == "dm") {
            Spacer(Modifier.height(6.dp))
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                team.filter { it.userId != myUserId && it.status == "active" }.forEach { m ->
                    FilterChip(
                        selected = selectedPeer?.userId == m.userId,
                        onClick = { onSelectPeer(m) },
                        label = { Text(m.fullName.ifBlank { SupabaseAuth.displayLogin(m.email) }, fontSize = 11.sp) },
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        val activeList = if (mode == "group") groupMessages else dmMessages
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (activeList.isEmpty()) {
                item { GesmakCard { Text("Aucun message. Lancez la conversation.", color = c.muted, fontSize = 13.sp) } }
            }
            items(activeList, key = { it.id }) { m ->
                val isMine = m.senderId == myUserId
                Surface(
                    color = if (isMine) c.accentSoft else c.card,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            "${m.senderName ?: "Membre"} · ${m.createdAt.take(16).replace("T", " ")}",
                            color = if (isMine) c.accentDeep else c.muted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(m.message, color = c.text, fontSize = 14.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text(if (mode == "dm" && selectedPeer == null) "Choisissez un destinataire..." else "Votre message...") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = {
                    if (text.isBlank()) return@Button
                    if (mode == "dm" && selectedPeer == null) return@Button
                    val msgToSend = text.trim()
                    busy = true
                    if (mode == "group") {
                        onSendGroup(msgToSend) { busy = false; text = "" }
                    } else {
                        onSendDm(selectedPeer!!.userId, msgToSend) { busy = false; text = "" }
                    }
                },
                enabled = !busy && text.isNotBlank() && (mode == "group" || selectedPeer != null),
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
            ) { Icon(Icons.Default.Send, contentDescription = "Envoyer") }
        }
    }
}

// ==================== 2. NOTIFICATIONS ====================

@Composable
fun NotificationsScreen(
    mod: Modifier = Modifier,
    notifications: List<SupabaseApi.NotificationRow>,
    onRefresh: () -> Unit,
    onMarkRead: (String) -> Unit,
    onMarkAllRead: () -> Unit,
    onDelete: (String) -> Unit,
) {
    val c = LocalGesmakColors.current
    Column(modifier = mod.fillMaxSize().background(c.bg).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Notifications, contentDescription = null, tint = c.accent)
            Spacer(Modifier.width(8.dp))
            Text("Notifications (${notifications.count { !it.read }})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            OutlinedButton(onClick = onMarkAllRead) {
                Icon(Icons.Default.DoneAll, contentDescription = null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text("Tout lire", fontSize = 11.sp)
            }
            IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent) }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (notifications.isEmpty()) {
                item { GesmakCard { Text("Aucune notification.", color = c.muted, fontSize = 13.sp) } }
            }
            items(notifications, key = { it.id }) { n ->
                GesmakCard(
                    borderColor = if (!n.read) c.accent.copy(alpha = 0.55f) else null,
                    modifier = Modifier.clickable { if (!n.read) onMarkRead(n.id) },
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (!n.read) StatusPill(label = "Nouveau", color = c.accent)
                                Text(n.title, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            if (!n.message.isNullOrBlank()) {
                                Spacer(Modifier.height(3.dp))
                                Text(n.message, color = c.muted, fontSize = 12.sp)
                            }
                            Text(n.createdAt.take(16).replace("T", " "), color = c.muted, fontSize = 10.sp)
                        }
                        IconButton(onClick = { onDelete(n.id) }) {
                            Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

// ==================== 3. PLANNING & MON SERVICE ====================

@Composable
fun PlanningAndServiceScreen(
    mod: Modifier = Modifier,
    employees: List<SupabaseApi.EmployeeRow>,
    shifts: List<SupabaseApi.ShiftRow>,
    myOrders: List<SupabaseApi.OrderRow>,
    myTables: List<SupabaseApi.RestaurantTableRow>,
    onRefresh: () -> Unit,
    onCreateShift: (empId: String, date: String, startHm: String, endHm: String, notes: String?, cb: (String?) -> Unit) -> Unit,
    onUpdateShiftStatus: (shiftId: String, status: String) -> Unit,
    onMarkOrderServed: (orderId: String) -> Unit,
) {
    val c = LocalGesmakColors.current
    var shiftModal by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }

    Column(modifier = mod.fillMaxSize().background(c.bg).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = c.accent)
            Spacer(Modifier.width(8.dp))
            Text("Planning & Mon Service", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            Button(
                onClick = { shiftModal = true },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Shift", fontSize = 12.sp)
            }
            IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent) }
        }

        if (!notice.isNullOrBlank()) {
            Text(notice!!, color = c.emerald, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp))
        }

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (myTables.isNotEmpty() || myOrders.isNotEmpty()) {
                item { Text("Mon Service actif (${myTables.size} table(s) · ${myOrders.size} cmd)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
                items(myOrders, key = { "srv_${it.id}" }) { o ->
                    GesmakCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(o.tableNumber?.let { "Table $it" } ?: "Commande", color = c.text, fontWeight = FontWeight.Bold)
                                Text("${formatFcfa(o.total)} · ${o.status}", color = c.muted, fontSize = 12.sp)
                            }
                            if (o.status != "served") {
                                Button(
                                    onClick = { onMarkOrderServed(o.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                                ) { Text("Marquer servie", fontSize = 11.sp) }
                            }
                        }
                    }
                }
            }
            item { Text("Planning de la semaine (${shifts.size})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
            if (shifts.isEmpty()) {
                item { GesmakCard { Text("Aucun shift planifié cette semaine.", color = c.muted, fontSize = 13.sp) } }
            }
            items(shifts, key = { it.id }) { s ->
                val empName = employees.find { it.id == s.employeeId }?.name ?: "Employé"
                val stColor = when (s.status) {
                    "active" -> c.accent
                    "completed" -> c.emerald
                    "cancelled" -> c.rose
                    else -> c.sky
                }
                GesmakCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(empName, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("${s.startTime.take(16).replace("T", " ")} → ${s.endTime.drop(11).take(5)}", color = c.muted, fontSize = 12.sp)
                            if (!s.notes.isNullOrBlank()) Text(s.notes, color = c.muted, fontSize = 11.sp)
                        }
                        StatusPill(label = s.status, color = stColor)
                        if (s.status == "scheduled" || s.status == "active") {
                            IconButton(onClick = {
                                onUpdateShiftStatus(s.id, if (s.status == "scheduled") "active" else "completed")
                            }) {
                                Icon(Icons.Default.Check, contentDescription = "Avancer", tint = c.emerald)
                            }
                        }
                    }
                }
            }
        }
    }

    if (shiftModal) {
        var empId by remember { mutableStateOf(employees.firstOrNull()?.id.orEmpty()) }
        var date by remember { mutableStateOf(java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())) }
        var startHm by remember { mutableStateOf("08:00") }
        var endHm by remember { mutableStateOf("17:00") }
        var notes by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) shiftModal = false },
            containerColor = c.card,
            title = { Text("Planifier un shift", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Employé :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        employees.forEach { e ->
                            FilterChip(selected = empId == e.id, onClick = { empId = e.id }, label = { Text(e.name, fontSize = 11.sp) })
                        }
                    }
                    OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date (AAAA-MM-JJ)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = startHm, onValueChange = { startHm = it }, label = { Text("Début") }, singleLine = true, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = endHm, onValueChange = { endHm = it }, label = { Text("Fin") }, singleLine = true, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (empId.isBlank()) return@Button
                    busy = true
                    onCreateShift(empId, date, startHm, endHm, notes.ifBlank { null }) { e ->
                        busy = false
                        if (e == null) { shiftModal = false; notice = "Shift planifié" }
                    }
                }, enabled = !busy && empId.isNotBlank(), colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { shiftModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }
}

// ==================== 4. POINT MANUEL ====================

@Composable
fun PointManuelScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    onSavePointManuel: (adjustments: List<Pair<SupabaseApi.Product, Double>>, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    val counts = remember(products) {
        mutableStateMapOf<String, String>().apply {
            products.forEach { put(it.id, it.stock.toInt().toString()) }
        }
    }
    var filterDiff by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }

    val deltas = products.mapNotNull { p ->
        val counted = counts[p.id]?.toDoubleOrNull() ?: p.stock
        if (counted != p.stock) p to counted else null
    }
    val list = if (filterDiff) deltas.map { it.first } else products

    Column(modifier = mod.fillMaxSize().background(c.bg).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Point Manuel (Inventaire)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("${deltas.size} écart(s) détecté(s) sur ${products.size} articles", color = c.muted, fontSize = 12.sp)
            }
            Button(
                onClick = {
                    if (deltas.isEmpty()) { msg = "Aucun écart à enregistrer."; return@Button }
                    busy = true
                    onSavePointManuel(deltas) { e ->
                        busy = false
                        msg = e ?: "Inventaire enregistré (${deltas.size} ajustement(s))."
                    }
                },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
            ) { Text(if (busy) "..." else "Valider (${deltas.size})") }
        }
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !filterDiff, onClick = { filterDiff = false }, label = { Text("Tous (${products.size})") })
            FilterChip(selected = filterDiff, onClick = { filterDiff = true }, label = { Text("Écarts (${deltas.size})") })
        }
        if (!msg.isNullOrBlank()) {
            Text(msg!!, color = c.emerald, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(list, key = { it.id }) { p ->
                val curStr = counts[p.id] ?: p.stock.toInt().toString()
                val diff = (curStr.toDoubleOrNull() ?: p.stock) - p.stock
                GesmakCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProductThumb(
                            name = p.name,
                            category = p.category,
                            imageUrl = p.imageUrl,
                            remoteDefaults = productImageDefaults,
                            size = 40.dp,
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(
                                "Théorique : ${p.stock.toInt()} · Écart : ${if (diff > 0) "+${diff.toInt()}" else "${diff.toInt()}"}",
                                color = if (diff == 0.0) c.muted else c.rose,
                                fontSize = 11.sp,
                            )
                        }
                        OutlinedTextField(
                            value = curStr,
                            onValueChange = { counts[p.id] = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Réel") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.width(96.dp),
                        )
                    }
                }
            }
        }
    }
}

// ==================== 5. TRANSFERT DE STOCK INTER-SITES ====================

@Composable
fun StockTransferScreen(
    mod: Modifier = Modifier,
    currentEstId: String?,
    establishments: List<EstChoice>,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    onTransfer: (targetEstId: String, targetEstName: String, lines: List<Pair<SupabaseApi.Product, Double>>, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    val targets = establishments.filter { it.id != currentEstId }
    var targetId by remember(targets) { mutableStateOf(targets.firstOrNull()?.id.orEmpty()) }
    val qtyMap = remember { mutableStateMapOf<String, String>() }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }

    Column(modifier = mod.fillMaxSize().background(c.bg).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.SwapHoriz, contentDescription = null, tint = c.accent)
            Spacer(Modifier.width(8.dp))
            Text("Transfert Inter-Sites", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            Button(
                onClick = {
                    val tgt = targets.find { it.id == targetId } ?: return@Button
                    val lines = products.mapNotNull { p ->
                        val q = qtyMap[p.id]?.toDoubleOrNull() ?: 0.0
                        if (q > 0 && q <= p.stock) p to q else null
                    }
                    if (lines.isEmpty()) { msg = "Saisissez au moins une quantité valide."; return@Button }
                    busy = true
                    onTransfer(tgt.id, tgt.name, lines) { e ->
                        busy = false
                        if (e == null) { qtyMap.clear(); msg = "Transfert effectué vers ${tgt.name}" } else msg = e
                    }
                },
                enabled = !busy && targetId.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
            ) { Text(if (busy) "..." else "Transférer") }
        }
        Spacer(Modifier.height(6.dp))
        if (targets.isEmpty()) {
            GesmakCard { Text("Vous devez avoir au moins 2 établissements pour transférer du stock.", color = c.muted, fontSize = 13.sp) }
        } else {
            Text("Destination :", color = c.muted, fontSize = 12.sp)
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                targets.forEach { est ->
                    FilterChip(
                        selected = targetId == est.id,
                        onClick = { targetId = est.id },
                        label = { Text(est.name) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                    )
                }
            }
        }
        if (!msg.isNullOrBlank()) {
            Text(msg!!, color = c.emerald, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(products.filter { it.stock > 0 }, key = { it.id }) { p ->
                GesmakCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProductThumb(
                            name = p.name,
                            category = p.category,
                            imageUrl = p.imageUrl,
                            remoteDefaults = productImageDefaults,
                            size = 40.dp,
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("Disponible : ${p.stock.toInt()}", color = c.muted, fontSize = 11.sp)
                        }
                        OutlinedTextField(
                            value = qtyMap[p.id].orEmpty(),
                            onValueChange = { qtyMap[p.id] = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Qté") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.width(88.dp),
                        )
                    }
                }
            }
        }
    }
}

// ==================== 6. KITS & PROMOS ====================

@Composable
fun KitsPromosScreen(
    mod: Modifier = Modifier,
    kits: List<SupabaseApi.ProductKitRow>,
    promos: List<SupabaseApi.PromotionRow>,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    onRefresh: () -> Unit,
    onCreateKit: (name: String, desc: String?, price: Double, items: List<Pair<SupabaseApi.Product, Int>>, cb: (String?) -> Unit) -> Unit,
    onToggleKit: (id: String, active: Boolean) -> Unit,
    onDeleteKit: (id: String) -> Unit,
    onCreatePromo: (name: String, desc: String?, type: String, value: Double, productId: String?, buyQty: Int?, getQty: Int?, cb: (String?) -> Unit) -> Unit,
    onTogglePromo: (id: String, active: Boolean) -> Unit,
    onDeletePromo: (id: String) -> Unit,
) {
    val c = LocalGesmakColors.current
    var showKits by remember { mutableStateOf(true) }
    var kitModal by remember { mutableStateOf(false) }
    var promoModal by remember { mutableStateOf(false) }

    Column(modifier = mod.fillMaxSize().background(c.bg).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.LocalOffer, contentDescription = null, tint = c.accent)
            Spacer(Modifier.width(8.dp))
            Text("Kits & Promos", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            Button(
                onClick = { if (showKits) kitModal = true else promoModal = true },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) { Text(if (showKits) "+ Kit" else "+ Promo", fontSize = 12.sp) }
            IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent) }
        }
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = showKits, onClick = { showKits = true }, label = { Text("Kits / Packs (${kits.size})") })
            FilterChip(selected = !showKits, onClick = { showKits = false }, label = { Text("Promotions (${promos.size})") })
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (showKits) {
                if (kits.isEmpty()) item { GesmakCard { Text("Aucun kit configuré.", color = c.muted) } }
                items(kits, key = { it.id }) { k ->
                    GesmakCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(k.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text("${formatFcfa(k.price)} · ${k.items.size} article(s)", color = c.accent, fontSize = 12.sp)
                            }
                            Switch(checked = k.active, onCheckedChange = { onToggleKit(k.id, it) })
                            IconButton(onClick = { onDeleteKit(k.id) }) { Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose) }
                        }
                    }
                }
            } else {
                if (promos.isEmpty()) item { GesmakCard { Text("Aucune promotion configurée.", color = c.muted) } }
                items(promos, key = { it.id }) { pr ->
                    GesmakCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(pr.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                val label = when (pr.promoType) {
                                    "percent" -> "-${pr.value.toInt()}%"
                                    "fixed" -> "-${formatFcfa(pr.value)}"
                                    else -> "${pr.buyQty ?: 2} achetés = +${pr.getQty ?: 1} offert"
                                }
                                Text(label, color = c.emerald, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            }
                            Switch(checked = pr.active, onCheckedChange = { onTogglePromo(pr.id, it) })
                            IconButton(onClick = { onDeletePromo(pr.id) }) { Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose) }
                        }
                    }
                }
            }
        }
    }

    if (kitModal) {
        var name by remember { mutableStateOf("") }
        var price by remember { mutableStateOf("") }
        var desc by remember { mutableStateOf("") }
        val sel = remember { mutableStateMapOf<String, Int>() }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) kitModal = false },
            containerColor = c.card,
            title = { Text("Nouveau Kit / Pack", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom du pack *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = price, onValueChange = { price = it.filter { ch -> ch.isDigit() } }, label = { Text("Prix du pack (FCFA)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Description") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    products.take(12).forEach { p ->
                        val q = sel[p.id] ?: 0
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ProductThumb(
                                name = p.name,
                                category = p.category,
                                imageUrl = p.imageUrl,
                                remoteDefaults = productImageDefaults,
                                size = 32.dp,
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(p.name, color = c.text, fontSize = 12.sp, modifier = Modifier.weight(1f))
                            TextButton(onClick = { if (q > 0) sel[p.id] = q - 1 }) { Text("-") }
                            Text("$q", color = c.text, fontWeight = FontWeight.Bold)
                            TextButton(onClick = { sel[p.id] = q + 1 }) { Text("+") }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    val items = products.mapNotNull { p -> val q = sel[p.id] ?: 0; if (q > 0) p to q else null }
                    busy = true
                    onCreateKit(name, desc.ifBlank { null }, price.toDoubleOrNull() ?: 0.0, items) {
                        busy = false
                        kitModal = false
                    }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Créer") }
            },
            dismissButton = { TextButton(onClick = { kitModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (promoModal) {
        var name by remember { mutableStateOf("") }
        var pType by remember { mutableStateOf("percent") }
        var value by remember { mutableStateOf("10") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) promoModal = false },
            containerColor = c.card,
            title = { Text("Nouvelle Promotion", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom promo *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("percent" to "%", "fixed" to "FCFA", "buy_x_get_y" to "2+1").forEach { (k, l) ->
                            FilterChip(selected = pType == k, onClick = { pType = k }, label = { Text(l) })
                        }
                    }
                    OutlinedTextField(value = value, onValueChange = { value = it.filter { ch -> ch.isDigit() } }, label = { Text(if (pType == "percent") "Pourcentage" else "Montant remise") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    busy = true
                    onCreatePromo(name, null, pType, value.toDoubleOrNull() ?: 0.0, null, if (pType == "buy_x_get_y") 2 else null, if (pType == "buy_x_get_y") 1 else null) {
                        busy = false
                        promoModal = false
                    }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Créer") }
            },
            dismissButton = { TextButton(onClick = { promoModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }
}
