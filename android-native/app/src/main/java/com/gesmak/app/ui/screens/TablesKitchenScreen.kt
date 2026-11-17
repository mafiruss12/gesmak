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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.TableRestaurant
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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

@Composable
fun TablesKitchenScreen(
    mod: Modifier = Modifier,
    initialTab: Int = 0,
    tables: List<SupabaseApi.RestaurantTableRow>,
    team: List<SupabaseApi.Member>,
    menuCategories: List<SupabaseApi.MenuCategoryRow>,
    menuItems: List<SupabaseApi.MenuItemRow>,
    reservations: List<SupabaseApi.ReservationRow>,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    onRefresh: () -> Unit,
    onAddTable: (number: String, seats: Int, location: String, cb: (String?) -> Unit) -> Unit,
    onCycleTableStatus: (tableId: String, nextStatus: String, cb: (String?) -> Unit) -> Unit,
    onAssignServer: (tableId: String, serverId: String?, serverName: String?, cb: (String?) -> Unit) -> Unit,
    onDeleteTable: (tableId: String, cb: (String?) -> Unit) -> Unit,
    onSaveCategory: (id: String?, name: String, sortOrder: Int, cb: (String?) -> Unit) -> Unit,
    onDeleteCategory: (id: String, cb: (String?) -> Unit) -> Unit,
    onSaveMenuItem: (id: String?, name: String, price: Double, catId: String?, desc: String?, linkedProdId: String?, available: Boolean, cb: (String?) -> Unit) -> Unit,
    onDeleteMenuItem: (id: String, cb: (String?) -> Unit) -> Unit,
    onSaveReservation: (id: String?, customerName: String, phone: String?, partySize: Int, timeIso: String, tableId: String?, status: String, notes: String?, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    var tab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 2)) }

    var addTableModal by remember { mutableStateOf(false) }
    var assignTableTarget by remember { mutableStateOf<SupabaseApi.RestaurantTableRow?>(null) }
    var catModal by remember { mutableStateOf(false) }
    var itemModal by remember { mutableStateOf(false) }
    var editItem by remember { mutableStateOf<SupabaseApi.MenuItemRow?>(null) }
    var resModal by remember { mutableStateOf(false) }
    var editRes by remember { mutableStateOf<SupabaseApi.ReservationRow?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var err by remember { mutableStateOf<String?>(null) }

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
                Text("Salle, Carte & Réservations", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("Tables, serveurs, menu restaurant & réservations", color = c.muted, fontSize = 12.sp)
            }
            Button(
                onClick = {
                    when (tab) {
                        0 -> addTableModal = true
                        1 -> { editItem = null; itemModal = true }
                        else -> { editRes = null; resModal = true }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(when (tab) { 0 -> "Table"; 1 -> "Plat"; else -> "Réserver" }, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
            }
        }

        TabRow(selectedTabIndex = tab, containerColor = c.card, contentColor = c.accent) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Tables (${tables.size})", fontSize = 12.sp) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Carte (${menuItems.size})", fontSize = 12.sp) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text("Réserv. (${reservations.size})", fontSize = 12.sp) })
        }

        if (!notice.isNullOrBlank()) {
            Surface(color = c.emerald.copy(alpha = 0.14f), modifier = Modifier.fillMaxWidth().padding(10.dp), shape = RoundedCornerShape(8.dp)) {
                Text(notice!!, color = c.emerald, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
            }
        }
        if (!err.isNullOrBlank()) {
            Surface(color = c.rose.copy(alpha = 0.14f), modifier = Modifier.fillMaxWidth().padding(10.dp), shape = RoundedCornerShape(8.dp)) {
                Text(err!!, color = c.rose, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
            }
        }

        when (tab) {
            // ===== TABLES & SERVEURS =====
            0 -> {
                val freeCount = tables.count { it.status == "free" }
                val occCount = tables.count { it.status == "occupied" }
                val resCount = tables.count { it.status == "reserved" }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatusPill(label = "$freeCount Libre(s)", color = c.emerald)
                            StatusPill(label = "$occCount Occupée(s)", color = c.accent)
                            StatusPill(label = "$resCount Réservée(s)", color = c.sky)
                        }
                    }
                    if (tables.isEmpty()) {
                        item { GesmakCard { Text("Aucune table configurée. Touchez « Table » en haut.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(tables, key = { it.id }) { t ->
                        val (stLabel, stColor) = when (t.status) {
                            "free" -> "Libre" to c.emerald
                            "occupied" -> "Occupée" to c.accent
                            "reserved" -> "Réservée" to c.sky
                            else -> "Nettoyage" to c.muted
                        }
                        val nextStatus = when (t.status) {
                            "free" -> "occupied"
                            "occupied" -> "reserved"
                            "reserved" -> "cleaning"
                            else -> "free"
                        }
                        GesmakCard(
                            borderColor = stColor.copy(alpha = 0.45f),
                            modifier = Modifier.clickable {
                                onCycleTableStatus(t.id, nextStatus) { e -> if (e != null) err = e }
                            },
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.TableRestaurant, contentDescription = null, tint = stColor)
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Table ${t.number} · ${t.seats} pl.", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text(
                                        "${t.location ?: "Salle"} · Serveur : ${t.serverName ?: "Non assigné"} (toucher pour changer statut)",
                                        color = c.muted,
                                        fontSize = 11.sp,
                                    )
                                }
                                StatusPill(label = stLabel, color = stColor)
                                IconButton(onClick = { assignTableTarget = t }) {
                                    Icon(Icons.Default.Person, contentDescription = "Serveur", tint = c.sky)
                                }
                                IconButton(onClick = { onDeleteTable(t.id) { e -> if (e != null) err = e else notice = "Table ${t.number} supprimée" } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose)
                                }
                            }
                        }
                    }
                }
            }

            // ===== CARTE / MENU DU RESTAURANT =====
            1 -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.RestaurantMenu, contentDescription = null, tint = c.accent)
                                Spacer(Modifier.width(8.dp))
                                Text("Catégories (${menuCategories.size})", color = c.text, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                OutlinedButton(onClick = { catModal = true }) {
                                    Text("+ Catégorie", color = c.accent, fontSize = 12.sp)
                                }
                            }
                            if (menuCategories.isNotEmpty()) {
                                Spacer(Modifier.height(6.dp))
                                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    menuCategories.forEach { cat ->
                                        FilterChip(
                                            selected = false,
                                            onClick = { onDeleteCategory(cat.id) { e -> if (e != null) err = e } },
                                            label = { Text("${cat.name} ✕", fontSize = 11.sp) },
                                        )
                                    }
                                }
                            }
                        }
                    }
                    if (menuItems.isEmpty()) {
                        item { GesmakCard { Text("Aucun plat dans la carte. Appuyez sur « Plat » pour ajouter.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(menuItems, key = { it.id }) { item ->
                        val catName = menuCategories.find { it.id == item.categoryId }?.name ?: "Sans catégorie"
                        val linkedImg = products.find { it.id == item.linkedProductId }?.imageUrl
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                ProductThumb(
                                    name = item.name,
                                    category = catName,
                                    imageUrl = linkedImg,
                                    remoteDefaults = productImageDefaults,
                                    size = 42.dp,
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text("$catName · ${formatFcfa(item.price)}", color = c.accent, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                    if (!item.description.isNullOrBlank()) Text(item.description, color = c.muted, fontSize = 11.sp)
                                }
                                StatusPill(
                                    label = if (item.isAvailable) "Dispo" else "Épuisé",
                                    color = if (item.isAvailable) c.emerald else c.rose,
                                )
                                IconButton(onClick = { editItem = item; itemModal = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent)
                                }
                                IconButton(onClick = { onDeleteMenuItem(item.id) { e -> if (e != null) err = e else notice = "Plat supprimé" } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose)
                                }
                            }
                        }
                    }
                }
            }

            // ===== RÉSERVATIONS =====
            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (reservations.isEmpty()) {
                        item { GesmakCard { Text("Aucune réservation. Appuyez sur « Réserver » en haut.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(reservations, key = { it.id }) { r ->
                        val tNum = tables.find { it.id == r.tableId }?.number
                        val stColor = when (r.status) {
                            "seated" -> c.emerald
                            "cancelled", "no_show" -> c.rose
                            else -> c.sky
                        }
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.EventSeat, contentDescription = null, tint = stColor)
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("${r.customerName} (${r.partySize} pers.)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text(
                                        "${r.reservationTime.take(16).replace("T", " ")}${tNum?.let { " · Table $it" } ?: ""}${r.phone?.let { " · $it" } ?: ""}",
                                        color = c.muted,
                                        fontSize = 12.sp,
                                    )
                                }
                                StatusPill(label = r.status, color = stColor)
                                if (r.status == "confirmed") {
                                    IconButton(onClick = {
                                        onSaveReservation(r.id, r.customerName, r.phone, r.partySize, r.reservationTime, r.tableId, "seated", r.notes) { e ->
                                            if (e != null) err = e else notice = "${r.customerName} installé(e)"
                                        }
                                    }) {
                                        Icon(Icons.Default.Check, contentDescription = "Installer", tint = c.emerald)
                                    }
                                }
                                IconButton(onClick = { editRes = r; resModal = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (addTableModal) {
        var number by remember { mutableStateOf("") }
        var seats by remember { mutableStateOf("4") }
        var loc by remember { mutableStateOf("salle") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) addTableModal = false },
            containerColor = c.card,
            title = { Text("Ajouter une table", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = number, onValueChange = { number = it }, label = { Text("Numéro (ex: 1, VIP2...)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = seats, onValueChange = { seats = it.filter { ch -> ch.isDigit() } }, label = { Text("Nombre de places") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = loc, onValueChange = { loc = it }, label = { Text("Emplacement (salle, terrasse, VIP)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (number.isBlank()) return@Button
                        busy = true
                        onAddTable(number, seats.toIntOrNull() ?: 4, loc.ifBlank { "salle" }) { e ->
                            busy = false
                            if (e == null) { addTableModal = false; notice = "Table ajoutée" } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Ajouter") }
            },
            dismissButton = { TextButton(onClick = { addTableModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (assignTableTarget != null) {
        val tbl = assignTableTarget!!
        AlertDialog(
            onDismissRequest = { assignTableTarget = null },
            containerColor = c.card,
            title = { Text("Serveur pour Table ${tbl.number}", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    team.forEach { m ->
                        val label = m.fullName.ifBlank { SupabaseAuth.displayLogin(m.email) }
                        OutlinedButton(
                            onClick = {
                                onAssignServer(tbl.id, m.userId, label) { e ->
                                    assignTableTarget = null
                                    if (e != null) err = e else notice = "Table ${tbl.number} assignée à $label"
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(label) }
                    }
                    TextButton(onClick = {
                        onAssignServer(tbl.id, null, null) { e ->
                            assignTableTarget = null
                            if (e != null) err = e
                        }
                    }) { Text("Retirer le serveur", color = c.rose) }
                }
            },
            confirmButton = { TextButton(onClick = { assignTableTarget = null }) { Text("Fermer", color = c.muted) } },
        )
    }

    if (catModal) {
        var name by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) catModal = false },
            containerColor = c.card,
            title = { Text("Nouvelle catégorie de carte", color = c.text, fontWeight = FontWeight.Bold) },
            text = { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom (Entrées, Grillades, Boissons)") }, singleLine = true, modifier = Modifier.fillMaxWidth()) },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    busy = true
                    onSaveCategory(null, name, menuCategories.size) { e ->
                        busy = false
                        if (e == null) catModal = false else err = e
                    }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Ajouter") }
            },
            dismissButton = { TextButton(onClick = { catModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (itemModal) {
        var name by remember(editItem) { mutableStateOf(editItem?.name.orEmpty()) }
        var price by remember(editItem) { mutableStateOf(editItem?.price?.toLong()?.toString().orEmpty()) }
        var catId by remember(editItem) { mutableStateOf(editItem?.categoryId.orEmpty()) }
        var desc by remember(editItem) { mutableStateOf(editItem?.description.orEmpty()) }
        var avail by remember(editItem) { mutableStateOf(editItem?.isAvailable ?: true) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) itemModal = false },
            containerColor = c.card,
            title = { Text(if (editItem == null) "Nouveau plat / boisson" else "Modifier plat", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = price, onValueChange = { price = it.filter { ch -> ch.isDigit() } }, label = { Text("Prix (FCFA)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                    if (menuCategories.isNotEmpty()) {
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            menuCategories.forEach { cat ->
                                FilterChip(selected = catId == cat.id, onClick = { catId = cat.id }, label = { Text(cat.name, fontSize = 11.sp) })
                            }
                        }
                    }
                    OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Disponible sur la carte", color = c.text, fontSize = 13.sp)
                        Switch(checked = avail, onCheckedChange = { avail = it })
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    busy = true
                    onSaveMenuItem(editItem?.id, name, price.toDoubleOrNull() ?: 0.0, catId.ifBlank { null }, desc.ifBlank { null }, editItem?.linkedProductId, avail) { e ->
                        busy = false
                        if (e == null) { itemModal = false; notice = "Plat enregistré" } else err = e
                    }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { itemModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (resModal) {
        var name by remember(editRes) { mutableStateOf(editRes?.customerName.orEmpty()) }
        var phone by remember(editRes) { mutableStateOf(editRes?.phone.orEmpty()) }
        var size by remember(editRes) { mutableStateOf((editRes?.partySize ?: 2).toString()) }
        var timeIso by remember(editRes) { mutableStateOf(editRes?.reservationTime ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm", java.util.Locale.US).format(java.util.Date())) }
        var tableId by remember(editRes) { mutableStateOf(editRes?.tableId.orEmpty()) }
        var notes by remember(editRes) { mutableStateOf(editRes?.notes.orEmpty()) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) resModal = false },
            containerColor = c.card,
            title = { Text(if (editRes == null) "Nouvelle réservation" else "Modifier réservation", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom client *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Tél") }, singleLine = true, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = size, onValueChange = { size = it.filter { ch -> ch.isDigit() } }, label = { Text("Pers.") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(0.6f))
                    }
                    OutlinedTextField(value = timeIso, onValueChange = { timeIso = it }, label = { Text("Date & heure (AAAA-MM-JJTHH:MM)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    if (tables.isNotEmpty()) {
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = tableId.isBlank(), onClick = { tableId = "" }, label = { Text("Auto") })
                            tables.forEach { t ->
                                FilterChip(selected = tableId == t.id, onClick = { tableId = t.id }, label = { Text("T${t.number}") })
                            }
                        }
                    }
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    busy = true
                    onSaveReservation(editRes?.id, name, phone.ifBlank { null }, size.toIntOrNull() ?: 2, timeIso, tableId.ifBlank { null }, editRes?.status ?: "confirmed", notes.ifBlank { null }) { e ->
                        busy = false
                        if (e == null) { resModal = false; notice = "Réservation enregistrée" } else err = e
                    }
                }, enabled = !busy, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { resModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }
}
