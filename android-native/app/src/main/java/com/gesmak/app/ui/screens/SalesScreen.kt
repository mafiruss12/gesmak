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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.LocalSalesStore
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.ManagerPinModal
import com.gesmak.app.ui.components.ProductThumb
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr

private val PAYMENT_MODES = listOf(
    "cash" to "Espèces",
    "wave" to "Wave",
    "orange_money" to "Orange Money",
    "mtn_money" to "MTN Money",
    "card" to "Carte",
)

@Composable
fun SalesScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    poles: List<SupabaseApi.EstablishmentPole>,
    lockedPole: String?,
    activePole: String?,
    isCashierOnly: Boolean,
    estId: String?,
    salesStore: LocalSalesStore,
    busy: Boolean,
    onSelectPole: (String?) -> Unit,
    onVerifyPin: (pin: String, reason: String, cb: (Boolean, String?) -> Unit) -> Unit,
    onValidateSale: (
        lines: List<Pair<SupabaseApi.Product, Int>>,
        paymentMethod: String,
        discountAmount: Double,
        poleCode: String?,
    ) -> Unit,
) {
    val c = LocalGesmakColors.current
    var query by remember { mutableStateOf("") }
    var selectedCat by remember { mutableStateOf("Tout") }
    var paymentMethod by remember { mutableStateOf("cash") }
    var discountInput by remember { mutableStateOf("") }
    var checkoutOpen by remember { mutableStateOf(false) }
    var pinOpen by remember { mutableStateOf(false) }
    var pinBusy by remember { mutableStateOf(false) }
    var pinErr by remember { mutableStateOf<String?>(null) }

    val cart = remember { mutableStateMapOf<String, Int>() }
    val categories = remember(products) {
        listOf("Tout") + products.mapNotNull { it.category?.trim()?.ifBlank { null } }.distinct().sorted()
    }
    val filtered = remember(products, query, selectedCat) {
        products.filter { p ->
            (selectedCat == "Tout" || p.category.equals(selectedCat, ignoreCase = true)) &&
                (query.isBlank() || p.name.contains(query, ignoreCase = true))
        }
    }

    val cartItems = cart.entries.mapNotNull { (id, q) ->
        val p = products.find { it.id == id }
        if (p != null && q > 0) p to q else null
    }
    val subtotal = cartItems.sumOf { (p, q) -> p.price * q }
    val discount = discountInput.toDoubleOrNull()?.coerceIn(0.0, subtotal) ?: 0.0
    val netTotal = maxOf(0.0, subtotal - discount)
    val ticketList = remember(estId, busy) {
        if (estId != null) salesStore.list(estId) else emptyList()
    }
    val currentPole = lockedPole ?: activePole

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        // En-tête Ma Caisse + pôle actif
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Ma Caisse", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp, modifier = Modifier.weight(1f))
            if (!lockedPole.isNullOrBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = poleColorHex(lockedPole), modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    StatusPill(label = poleLabelFr(lockedPole), color = poleColorHex(lockedPole))
                }
            } else if (!currentPole.isNullOrBlank()) {
                StatusPill(label = poleLabelFr(currentPole), color = poleColorHex(currentPole))
            }
        }

        // Sélecteur pôle si non verrouillé
        if (lockedPole.isNullOrBlank() && poles.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FilterChip(
                    selected = activePole.isNullOrBlank(),
                    onClick = { onSelectPole(null) },
                    label = { Text("Toutes caisses") },
                )
                poles.forEach { pole ->
                    FilterChip(
                        selected = activePole == pole.code,
                        onClick = { onSelectPole(pole.code) },
                        label = { Text(pole.name) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = poleColorHex(pole.code),
                            selectedLabelColor = Color.White,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Rechercher un produit...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = c.muted) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(),
        )

        if (categories.size > 1) {
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                categories.forEach { cat ->
                    FilterChip(
                        selected = selectedCat == cat,
                        onClick = { selectedCat = cat },
                        label = { Text(cat, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = c.accent,
                            selectedLabelColor = Color.White,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(filtered, key = { it.id }) { p ->
                val qty = cart[p.id] ?: 0
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = c.card,
                    border = BorderStroke(
                        1.dp,
                        if (qty > 0) c.accent else c.border,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (p.stock > qty) cart[p.id] = qty + 1
                        },
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ProductThumb(
                            name = p.name,
                            category = p.category,
                            imageUrl = p.imageUrl,
                            remoteDefaults = productImageDefaults,
                            size = 48.dp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(2.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(formatFcfa(p.price), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    "Stock: ${p.stock.toInt()}",
                                    color = if (p.stock <= p.minStock) c.rose else c.muted,
                                    fontSize = 12.sp,
                                )
                            }
                        }
                        if (qty > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(onClick = {
                                    if (qty <= 1) cart.remove(p.id) else cart[p.id] = qty - 1
                                }) {
                                    Icon(Icons.Default.Remove, contentDescription = "Moins", tint = c.text)
                                }
                                Text("$qty", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                IconButton(onClick = {
                                    if (p.stock > qty) cart[p.id] = qty + 1
                                }) {
                                    Icon(Icons.Default.Add, contentDescription = "Plus", tint = c.accent)
                                }
                            }
                        } else {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = c.accentSoft,
                            ) {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = "Ajouter",
                                    tint = c.accent,
                                    modifier = Modifier.padding(8.dp),
                                )
                            }
                        }
                    }
                }
            }

            if (ticketList.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(6.dp))
                    Text("Tickets du jour (${ticketList.size})", color = c.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                items(ticketList.take(5), key = { it.id }) { t ->
                    GesmakCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text("${t.at} · ${t.lines}", color = c.text, fontSize = 12.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.width(8.dp))
                            Text(formatFcfa(t.total), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Barre panier en bas
        if (cartItems.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = c.card,
                border = BorderStroke(1.5.dp, c.accent),
                shadowElevation = 4.dp,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { cart.clear(); discountInput = "" }) {
                        Icon(Icons.Default.Delete, contentDescription = "Vider", tint = c.rose)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${cartItems.sumOf { it.second }} article(s)", color = c.muted, fontSize = 11.sp)
                        Text(formatFcfa(netTotal), color = c.text, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                    }
                    Button(
                        onClick = { checkoutOpen = true },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        if (busy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.ShoppingCart, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Encaisser", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    if (checkoutOpen) {
        AlertDialog(
            onDismissRequest = { if (!busy) checkoutOpen = false },
            containerColor = c.card,
            title = { Text("Validation encaissement", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Total panier : ${formatFcfa(subtotal)}", color = c.text, fontWeight = FontWeight.SemiBold)
                    Text("Mode de paiement", color = c.muted, fontSize = 12.sp)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        PAYMENT_MODES.forEach { (key, label) ->
                            FilterChip(
                                selected = paymentMethod == key,
                                onClick = { paymentMethod = key },
                                label = { Text(label, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.accent,
                                    selectedLabelColor = Color.White,
                                ),
                            )
                        }
                    }
                    OutlinedTextField(
                        value = discountInput,
                        onValueChange = { discountInput = it.filter { ch -> ch.isDigit() } },
                        label = {
                            Text(
                                if (isCashierOnly) "Remise FCFA (PIN manager requis)" else "Remise FCFA (optionnel)",
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("Net à encaisser : ${formatFcfa(netTotal)}", color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isCashierOnly && discount > 0.0) {
                            pinErr = null
                            pinOpen = true
                        } else {
                            val summary = cartItems.joinToString(", ") { "${it.second}x ${it.first.name}" }
                            estId?.let { salesStore.add(it, netTotal, summary) }
                            onValidateSale(cartItems, paymentMethod, discount, currentPole)
                            cart.clear()
                            discountInput = ""
                            checkoutOpen = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Valider ${formatFcfa(netTotal)}")
                }
            },
            dismissButton = {
                TextButton(onClick = { checkoutOpen = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }

    if (pinOpen) {
        ManagerPinModal(
            title = "Validation Manager requise",
            subtitle = "Une remise de ${formatFcfa(discount)} nécessite le code PIN du manager de pôle.",
            busy = pinBusy,
            error = pinErr,
            onDismiss = { pinOpen = false },
            onConfirm = { pin ->
                pinBusy = true
                pinErr = null
                onVerifyPin(pin, "Remise caisse ${formatFcfa(discount)}") { ok, err ->
                    pinBusy = false
                    if (ok) {
                        val summary = cartItems.joinToString(", ") { "${it.second}x ${it.first.name}" }
                        estId?.let { salesStore.add(it, netTotal, summary) }
                        onValidateSale(cartItems, paymentMethod, discount, currentPole)
                        cart.clear()
                        discountInput = ""
                        pinOpen = false
                        checkoutOpen = false
                    } else {
                        pinErr = err ?: "PIN incorrect"
                    }
                }
            },
        )
    }
}
