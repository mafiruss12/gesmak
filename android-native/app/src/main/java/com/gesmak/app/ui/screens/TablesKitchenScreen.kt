package com.gesmak.app.ui.screens

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.ReceiptPrinter
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.components.EstablishmentLogo
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.ProductThumb
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

private val ROOM_STATUSES = listOf(
    "available" to "Disponible",
    "occupied" to "Occupée",
    "reserved" to "Réservée",
    "cleaning" to "Nettoyage",
)

@Composable
fun TablesKitchenScreen(
    mod: Modifier = Modifier,
    initialTab: Int = 0,
    establishment: SupabaseApi.Establishment? = null,
    tables: List<SupabaseApi.RestaurantTableRow>,
    team: List<SupabaseApi.Member>,
    menuCategories: List<SupabaseApi.MenuCategoryRow>,
    menuItems: List<SupabaseApi.MenuItemRow>,
    reservations: List<SupabaseApi.ReservationRow>,
    hotelRooms: List<SupabaseApi.HotelRoomRow> = emptyList(),
    hotelReservations: List<SupabaseApi.HotelReservationRow> = emptyList(),
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    onRefresh: () -> Unit,
    onPickImage: (prefix: String, cb: (url: String?, err: String?) -> Unit) -> Unit = { _, cb -> cb(null, null) },
    onAddTable: (number: String, seats: Int, location: String, cb: (String?) -> Unit) -> Unit,
    onCycleTableStatus: (tableId: String, nextStatus: String, cb: (String?) -> Unit) -> Unit,
    onAssignServer: (tableId: String, serverId: String?, serverName: String?, cb: (String?) -> Unit) -> Unit,
    onDeleteTable: (tableId: String, cb: (String?) -> Unit) -> Unit,
    onSaveCategory: (id: String?, name: String, sortOrder: Int, cb: (String?) -> Unit) -> Unit,
    onDeleteCategory: (id: String, cb: (String?) -> Unit) -> Unit,
    onSaveMenuItem: (
        id: String?,
        name: String,
        price: Double,
        catId: String?,
        desc: String?,
        linkedProdId: String?,
        available: Boolean,
        isDailyMenu: Boolean,
        isWeekendPromo: Boolean,
        promoPrice: Double?,
        imageUrl: String?,
        cb: (String?) -> Unit,
    ) -> Unit,
    onDeleteMenuItem: (id: String, cb: (String?) -> Unit) -> Unit,
    onSaveHotelRoom: (
        id: String?,
        number: String,
        name: String?,
        description: String?,
        imageUrl: String?,
        floor: String?,
        pricePerNight: Double,
        capacity: Int,
        status: String,
        cb: (String?) -> Unit,
    ) -> Unit = { _, _, _, _, _, _, _, _, _, cb -> cb(null) },
    onCycleRoomStatus: (roomId: String, nextStatus: String, cb: (String?) -> Unit) -> Unit = { _, _, cb -> cb(null) },
    onDeleteHotelRoom: (roomId: String, cb: (String?) -> Unit) -> Unit = { _, cb -> cb(null) },
    onUpdateHotelReservationStatus: (resId: String, roomId: String?, nextStatus: String, cb: (String?) -> Unit) -> Unit = { _, _, _, cb -> cb(null) },
    onSaveReservation: (id: String?, customerName: String, phone: String?, partySize: Int, timeIso: String, tableId: String?, status: String, notes: String?, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    val context = LocalContext.current
    var tab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 3)) }

    var addTableModal by remember { mutableStateOf(false) }
    var assignTableTarget by remember { mutableStateOf<SupabaseApi.RestaurantTableRow?>(null) }
    var catModal by remember { mutableStateOf(false) }
    var itemModal by remember { mutableStateOf(false) }
    var editItem by remember { mutableStateOf<SupabaseApi.MenuItemRow?>(null) }
    var roomModal by remember { mutableStateOf(false) }
    var editRoom by remember { mutableStateOf<SupabaseApi.HotelRoomRow?>(null) }
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
                Text("Salle, Carte & Chambres", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("Tables, plats & promos week-end, chambres & réservations", color = c.muted, fontSize = 11.sp)
            }
            Button(
                onClick = {
                    when (tab) {
                        0 -> addTableModal = true
                        1 -> { editItem = null; itemModal = true }
                        2 -> { editRoom = null; roomModal = true }
                        else -> { editRes = null; resModal = true }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(
                    when (tab) {
                        0 -> "Table"
                        1 -> "Plat"
                        2 -> "Chambre"
                        else -> "Réserver"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
            }
        }

        ScrollableTabRow(
            selectedTabIndex = tab,
            containerColor = c.card,
            contentColor = c.accent,
            edgePadding = 8.dp,
        ) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Tables (${tables.size})", fontSize = 12.sp) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Carte (${menuItems.size})", fontSize = 12.sp) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text("Chambres (${hotelRooms.size})", fontSize = 12.sp) })
            Tab(selected = tab == 3, onClick = { tab = 3 }, text = { Text("Réserv. (${reservations.size})", fontSize = 12.sp) })
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

            // ===== CARTE / MENU DU RESTAURANT (+ MENU DU JOUR & PROMOS WEEK-END) =====
            1 -> {
                val dailyCount = menuItems.count { it.isDailyMenu }
                val promoCount = menuItems.count { it.isWeekendPromo }
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
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                StatusPill(label = "$dailyCount Menu du jour", color = c.emerald)
                                StatusPill(label = "$promoCount Promo Week-end", color = c.rose)
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
                        val linkedImg = item.imageUrl ?: products.find { it.id == item.linkedProductId }?.imageUrl
                        val effectivePrice = if (item.isWeekendPromo && item.promoPrice != null && item.promoPrice > 0) item.promoPrice else item.price
                        GesmakCard(
                            borderColor = if (item.isWeekendPromo) c.rose.copy(alpha = 0.4f) else if (item.isDailyMenu) c.emerald.copy(alpha = 0.4f) else null,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                ProductThumb(
                                    name = item.name,
                                    category = catName,
                                    imageUrl = linkedImg,
                                    remoteDefaults = productImageDefaults,
                                    size = 48.dp,
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text("$catName · ${formatFcfa(effectivePrice)}", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        if (item.isWeekendPromo && item.promoPrice != null && item.promoPrice > 0 && item.promoPrice < item.price) {
                                            Text(
                                                formatFcfa(item.price),
                                                color = c.muted,
                                                fontSize = 11.sp,
                                                textDecoration = TextDecoration.LineThrough,
                                            )
                                        }
                                    }
                                    if (item.isDailyMenu || item.isWeekendPromo) {
                                        Spacer(Modifier.height(4.dp))
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            if (item.isDailyMenu) StatusPill(label = "Menu du jour", color = c.emerald)
                                            if (item.isWeekendPromo) StatusPill(label = "Promo Week-end", color = c.rose)
                                        }
                                    }
                                    if (!item.description.isNullOrBlank()) Text(item.description, color = c.muted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
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

            // ===== CHAMBRES D'HÔTEL & RÉSERVATIONS =====
            2 -> {
                val availCount = hotelRooms.count { it.status == "available" }
                val occCount = hotelRooms.count { it.status == "occupied" }
                val resCount = hotelRooms.count { it.status == "reserved" }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatusPill(label = "$availCount Disponible(s)", color = c.emerald)
                            StatusPill(label = "$occCount Occupée(s)", color = c.accent)
                            StatusPill(label = "$resCount Réservée(s)", color = c.sky)
                            StatusPill(label = "${hotelReservations.size} Résa(s)", color = c.muted)
                        }
                    }
                    if (hotelRooms.isEmpty()) {
                        item {
                            GesmakCard {
                                Text(
                                    "Aucune chambre configurée. Appuyez sur « + Chambre » en haut pour ajouter vos chambres avec photo, description et tarif/nuitée (visibles sur le QR client).",
                                    color = c.muted,
                                    fontSize = 13.sp,
                                )
                            }
                        }
                    }
                    items(hotelRooms, key = { it.id }) { room ->
                        val (rLabel, rColor) = when (room.status) {
                            "available" -> "Disponible" to c.emerald
                            "occupied" -> "Occupée" to c.accent
                            "reserved" -> "Réservée" to c.sky
                            else -> "Nettoyage" to c.muted
                        }
                        val nextRoomSt = when (room.status) {
                            "available" -> "occupied"
                            "occupied" -> "cleaning"
                            "cleaning" -> "available"
                            else -> "available"
                        }
                        GesmakCard(
                            borderColor = rColor.copy(alpha = 0.45f),
                            modifier = Modifier.clickable {
                                onCycleRoomStatus(room.id, nextRoomSt) { e -> if (e != null) err = e else notice = "Statut chambre ${room.number} mis à jour" }
                            },
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                EstablishmentLogo(
                                    name = room.name ?: "Ch ${room.number}",
                                    logoUrl = room.imageUrl,
                                    size = 54.dp,
                                    cornerRadius = 12.dp,
                                    accentColor = rColor,
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "Ch. ${room.number}${room.name?.let { " · $it" } ?: ""}",
                                        color = c.text,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        "${formatFcfa(room.pricePerNight)} / nuit · ${room.capacity} pers.${room.floor?.let { " · $it" } ?: ""}",
                                        color = c.accentDeep,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp,
                                    )
                                    if (!room.description.isNullOrBlank()) {
                                        Text(room.description, color = c.muted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                                StatusPill(label = rLabel, color = rColor)
                            }
                            Spacer(Modifier.height(6.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                TextButton(onClick = { editRoom = room; roomModal = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Modifier", color = c.accent, fontSize = 12.sp)
                                }
                                TextButton(onClick = {
                                    onDeleteHotelRoom(room.id) { e ->
                                        if (e != null) err = e else notice = "Chambre ${room.number} supprimée"
                                    }
                                }) {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = c.rose, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Supprimer", color = c.rose, fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    if (hotelReservations.isNotEmpty()) {
                        item {
                            Spacer(Modifier.height(6.dp))
                            Text("Réservations Chambres (${hotelReservations.size})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                        items(hotelReservations, key = { it.id }) { hr ->
                            val stLabel = when (hr.status) {
                                "pending" -> "En attente"
                                "confirmed" -> "Confirmée"
                                "in_progress" -> "En séjour"
                                "completed" -> "Terminée"
                                "cancelled" -> "Annulée"
                                else -> hr.status
                            }
                            val stCol = when (hr.status) {
                                "in_progress", "completed" -> c.emerald
                                "cancelled" -> c.rose
                                "confirmed" -> c.sky
                                else -> c.accent
                            }
                            val printableRes = ReceiptPrinter.PrintableReceipt(
                                id = hr.id,
                                title = "Reçu Réservation Chambre",
                                establishmentName = establishment?.name ?: "GESMAK",
                                establishmentPhone = establishment?.phone,
                                establishmentAddress = establishment?.address,
                                serviceLabel = "Chambre ${hr.roomNumber ?: "Hôtel"}",
                                customerName = hr.guestName,
                                dateLabel = "${hr.checkIn.take(10)} → ${hr.checkOut.take(10)}",
                                statusLabel = stLabel.uppercase(),
                                paymentLabel = hr.paymentMethod,
                                total = hr.total,
                                paidAmount = hr.amountPaid.takeIf { it > 0 },
                                notes = hr.notes,
                                lines = listOf(
                                    ReceiptPrinter.ReceiptLine(
                                        name = "Séjour Chambre ${hr.roomNumber ?: ""} (${hr.checkIn.take(10)} au ${hr.checkOut.take(10)})",
                                        qty = 1,
                                        unitPrice = hr.total,
                                    ),
                                ),
                            )
                            GesmakCard(borderColor = stCol.copy(alpha = 0.4f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Bed, contentDescription = null, tint = stCol)
                                    Spacer(Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${hr.guestName} · Ch. ${hr.roomNumber ?: "?"}", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Text("${hr.checkIn.take(10)} → ${hr.checkOut.take(10)} · ${formatFcfa(hr.total)}", color = c.muted, fontSize = 12.sp)
                                        if (!hr.guestPhone.isNullOrBlank()) {
                                            Text("Tél : ${hr.guestPhone}", color = c.muted, fontSize = 11.sp)
                                        }
                                    }
                                    StatusPill(label = stLabel, color = stCol)
                                }
                                Spacer(Modifier.height(6.dp))
                                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    if (hr.status == "pending") {
                                        OutlinedButton(onClick = {
                                            onUpdateHotelReservationStatus(hr.id, hr.roomId, "confirmed") { e -> if (e != null) err = e else notice = "Réservation confirmée" }
                                        }) { Text("Confirmer", color = c.sky, fontSize = 11.sp) }
                                    }
                                    if (hr.status in setOf("pending", "confirmed")) {
                                        Button(
                                            onClick = {
                                                onUpdateHotelReservationStatus(hr.id, hr.roomId, "in_progress") { e -> if (e != null) err = e else notice = "Check-in effectué" }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                                        ) { Text("Check-in", fontSize = 11.sp) }
                                    }
                                    if (hr.status == "in_progress") {
                                        Button(
                                            onClick = {
                                                onUpdateHotelReservationStatus(hr.id, hr.roomId, "completed") { e -> if (e != null) err = e else notice = "Check-out effectué" }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                                        ) { Text("Check-out", fontSize = 11.sp) }
                                    }
                                    OutlinedButton(onClick = { ReceiptPrinter.printHtmlReceipt(context, printableRes) }) {
                                        Icon(Icons.Default.Print, contentDescription = null, tint = c.accent, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Imprimer Reçu", color = c.accent, fontSize = 11.sp)
                                    }
                                    OutlinedButton(onClick = { ReceiptPrinter.shareTextReceipt(context, printableRes) }) {
                                        Icon(Icons.Default.Share, contentDescription = null, tint = c.sky, modifier = Modifier.size(14.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ===== RÉSERVATIONS TABLES =====
            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (reservations.isEmpty()) {
                        item { GesmakCard { Text("Aucune réservation de table. Appuyez sur « Réserver » en haut.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(reservations, key = { it.id }) { r ->
                        val tNum = tables.find { it.id == r.tableId }?.number
                        val stColor = when (r.status) {
                            "seated" -> c.emerald
                            "cancelled", "no_show" -> c.rose
                            else -> c.sky
                        }
                        val printableTableRes = ReceiptPrinter.PrintableReceipt(
                            id = r.id,
                            title = "Bon de Réservation Table",
                            establishmentName = establishment?.name ?: "GESMAK",
                            establishmentPhone = establishment?.phone,
                            establishmentAddress = establishment?.address,
                            serviceLabel = tNum?.let { "Table $it (${r.partySize} pers.)" } ?: "Salle (${r.partySize} pers.)",
                            customerName = r.customerName,
                            dateLabel = r.reservationTime.take(16).replace("T", " "),
                            statusLabel = r.status.uppercase(),
                            total = 0.0,
                            notes = r.notes,
                            lines = listOf(
                                ReceiptPrinter.ReceiptLine(
                                    name = "Réservation ${r.partySize} personne(s)${tNum?.let { " · Table $it" } ?: ""}",
                                    qty = 1,
                                    unitPrice = 0.0,
                                ),
                            ),
                        )
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
                                IconButton(onClick = { ReceiptPrinter.printHtmlReceipt(context, printableTableRes) }) {
                                    Icon(Icons.Default.Print, contentDescription = "Imprimer", tint = c.accent)
                                }
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
        var imageUrl by remember(editItem) { mutableStateOf(editItem?.imageUrl.orEmpty()) }
        var avail by remember(editItem) { mutableStateOf(editItem?.isAvailable ?: true) }
        var isDaily by remember(editItem) { mutableStateOf(editItem?.isDailyMenu ?: false) }
        var isWeekend by remember(editItem) { mutableStateOf(editItem?.isWeekendPromo ?: false) }
        var promoPrice by remember(editItem) { mutableStateOf(editItem?.promoPrice?.toLong()?.toString().orEmpty()) }
        var imgUploading by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy && !imgUploading) itemModal = false },
            containerColor = c.card,
            title = { Text(if (editItem == null) "Nouveau plat / boisson" else "Modifier plat", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        EstablishmentLogo(
                            name = name.ifBlank { "Plat" },
                            logoUrl = imageUrl.ifBlank { null },
                            size = 48.dp,
                            cornerRadius = 10.dp,
                            accentColor = c.accent,
                        )
                        OutlinedButton(
                            enabled = !imgUploading && !busy,
                            onClick = {
                                imgUploading = true
                                onPickImage("menu") { url, e ->
                                    imgUploading = false
                                    if (!url.isNullOrBlank()) imageUrl = url
                                    else if (e != null) err = e
                                }
                            },
                        ) {
                            Text(if (imgUploading) "Envoi..." else "Photo du plat", fontSize = 12.sp)
                        }
                    }
                    OutlinedTextField(value = imageUrl, onValueChange = { imageUrl = it }, label = { Text("Image (URL)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = price, onValueChange = { price = it.filter { ch -> ch.isDigit() } }, label = { Text("Prix normal (FCFA)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
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
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Menu du jour", color = c.emerald, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Switch(checked = isDaily, onCheckedChange = { isDaily = it })
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Promo Week-end", color = c.rose, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Switch(checked = isWeekend, onCheckedChange = { isWeekend = it })
                    }
                    if (isWeekend) {
                        OutlinedTextField(
                            value = promoPrice,
                            onValueChange = { promoPrice = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Tarif Promo Week-end (FCFA)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isBlank()) return@Button
                    busy = true
                    onSaveMenuItem(
                        editItem?.id,
                        name,
                        price.toDoubleOrNull() ?: 0.0,
                        catId.ifBlank { null },
                        desc.ifBlank { null },
                        editItem?.linkedProductId,
                        avail,
                        isDaily,
                        isWeekend,
                        if (isWeekend) promoPrice.toDoubleOrNull() else null,
                        imageUrl.trim().ifBlank { null },
                    ) { e ->
                        busy = false
                        if (e == null) { itemModal = false; notice = "Plat enregistré" } else err = e
                    }
                }, enabled = !busy && !imgUploading, colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White)) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { itemModal = false }, enabled = !busy && !imgUploading) { Text("Annuler", color = c.muted) } },
        )
    }

    if (roomModal) {
        var rNumber by remember(editRoom) { mutableStateOf(editRoom?.number.orEmpty()) }
        var rName by remember(editRoom) { mutableStateOf(editRoom?.name.orEmpty()) }
        var rDesc by remember(editRoom) { mutableStateOf(editRoom?.description.orEmpty()) }
        var rImage by remember(editRoom) { mutableStateOf(editRoom?.imageUrl.orEmpty()) }
        var rFloor by remember(editRoom) { mutableStateOf(editRoom?.floor.orEmpty()) }
        var rPrice by remember(editRoom) { mutableStateOf(editRoom?.pricePerNight?.toLong()?.toString().orEmpty()) }
        var rCap by remember(editRoom) { mutableStateOf((editRoom?.capacity ?: 2).toString()) }
        var rStatus by remember(editRoom) { mutableStateOf(editRoom?.status ?: "available") }
        var imgUploading by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy && !imgUploading) roomModal = false },
            containerColor = c.card,
            title = { Text(if (editRoom == null) "Nouvelle chambre d'hôtel" else "Modifier Chambre ${editRoom?.number}", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        EstablishmentLogo(
                            name = rName.ifBlank { "Ch $rNumber" },
                            logoUrl = rImage.ifBlank { null },
                            size = 56.dp,
                            cornerRadius = 12.dp,
                            accentColor = c.accent,
                        )
                        OutlinedButton(
                            enabled = !imgUploading && !busy,
                            onClick = {
                                imgUploading = true
                                onPickImage("room") { url, e ->
                                    imgUploading = false
                                    if (!url.isNullOrBlank()) rImage = url
                                    else if (e != null) err = e
                                }
                            },
                        ) {
                            Text(if (imgUploading) "Envoi..." else "Photo chambre", fontSize = 12.sp)
                        }
                    }
                    OutlinedTextField(value = rImage, onValueChange = { rImage = it }, label = { Text("Photo (URL)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = rNumber, onValueChange = { rNumber = it }, label = { Text("N° *") }, singleLine = true, modifier = Modifier.weight(0.45f))
                        OutlinedTextField(value = rFloor, onValueChange = { rFloor = it }, label = { Text("Étage") }, singleLine = true, modifier = Modifier.weight(0.55f))
                    }
                    OutlinedTextField(value = rName, onValueChange = { rName = it }, label = { Text("Nom / Catégorie (ex: Suite VIP)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = rPrice, onValueChange = { rPrice = it.filter { ch -> ch.isDigit() } }, label = { Text("Tarif / nuit (FCFA) *") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = rCap, onValueChange = { rCap = it.filter { ch -> ch.isDigit() } }, label = { Text("Pers.") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(0.45f))
                    }
                    OutlinedTextField(value = rDesc, onValueChange = { rDesc = it }, label = { Text("Description & équipements") }, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ROOM_STATUSES.forEach { (k, lbl) ->
                            FilterChip(
                                selected = rStatus == k,
                                onClick = { rStatus = k },
                                label = { Text(lbl, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (rNumber.isBlank()) return@Button
                        busy = true
                        onSaveHotelRoom(
                            editRoom?.id,
                            rNumber,
                            rName.ifBlank { null },
                            rDesc.ifBlank { null },
                            rImage.trim().ifBlank { null },
                            rFloor.ifBlank { null },
                            rPrice.toDoubleOrNull() ?: 0.0,
                            rCap.toIntOrNull() ?: 2,
                            rStatus,
                        ) { e ->
                            busy = false
                            if (e == null) { roomModal = false; notice = "Chambre enregistrée & publiée sur QR client" } else err = e
                        }
                    },
                    enabled = !busy && !imgUploading,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { roomModal = false }, enabled = !busy && !imgUploading) { Text("Annuler", color = c.muted) } },
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
