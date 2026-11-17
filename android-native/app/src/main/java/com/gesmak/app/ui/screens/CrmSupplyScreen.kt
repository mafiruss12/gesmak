package com.gesmak.app.ui.screens

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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

@Composable
fun CrmSupplyScreen(
    mod: Modifier = Modifier,
    initialTab: Int = 0,
    customers: List<SupabaseApi.CustomerRow>,
    suppliers: List<SupabaseApi.SupplierRow>,
    purchases: List<SupabaseApi.PurchaseRow>,
    products: List<SupabaseApi.Product>,
    onRefresh: () -> Unit,
    onSaveCustomer: (id: String?, name: String, phone: String?, email: String?, notes: String?, cb: (String?) -> Unit) -> Unit,
    onDeleteCustomer: (id: String, cb: (String?) -> Unit) -> Unit,
    onSaveSupplier: (id: String?, name: String, contact: String?, phone: String?, email: String?, address: String?, notes: String?, cb: (String?) -> Unit) -> Unit,
    onDeleteSupplier: (id: String, cb: (String?) -> Unit) -> Unit,
    onCreatePurchase: (product: SupabaseApi.Product, supplierId: String?, qty: Double, unitCost: Double, notes: String?, cb: (String?) -> Unit) -> Unit,
    onDeletePurchase: (id: String, cb: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    var tab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 2)) }
    var custModal by remember { mutableStateOf(false) }
    var editCust by remember { mutableStateOf<SupabaseApi.CustomerRow?>(null) }
    var supModal by remember { mutableStateOf(false) }
    var editSup by remember { mutableStateOf<SupabaseApi.SupplierRow?>(null) }
    var purModal by remember { mutableStateOf(false) }
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
                Text("Clients & Approvisionnement", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("CRM fidélité, fournisseurs & achats", color = c.muted, fontSize = 12.sp)
            }
            Button(
                onClick = {
                    when (tab) {
                        0 -> { editCust = null; custModal = true }
                        1 -> { editSup = null; supModal = true }
                        else -> purModal = true
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Ajouter", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
            }
        }

        TabRow(selectedTabIndex = tab, containerColor = c.card, contentColor = c.accent) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Clients (${customers.size})", fontSize = 12.sp) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Fournisseurs (${suppliers.size})", fontSize = 12.sp) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text("Achats (${purchases.size})", fontSize = 12.sp) })
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
            // ===== CLIENTS =====
            0 -> {
                val totalSpent = customers.sumOf { it.totalSpent }
                val totalPts = customers.sumOf { it.loyaltyPoints }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("CA Clients", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(totalSpent), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Points fidélité", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Star, contentDescription = null, tint = c.accent, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("$totalPts pts", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                }
                            }
                        }
                    }
                    if (customers.isEmpty()) {
                        item { GesmakCard { Text("Aucun client enregistré.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(customers, key = { it.id }) { cust ->
                        GesmakCard {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = c.accent)
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cust.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text(
                                        "${cust.phone ?: "Sans tél"} · ${cust.totalVisits} visite(s) · ${cust.loyaltyPoints} pts",
                                        color = c.muted,
                                        fontSize = 12.sp,
                                    )
                                    Text("Total achats : ${formatFcfa(cust.totalSpent)}", color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                                IconButton(onClick = { editCust = cust; custModal = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent, modifier = Modifier.size(18.dp))
                                }
                                IconButton(onClick = { onDeleteCustomer(cust.id) { e -> if (e != null) err = e else notice = "Client supprimé" } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }

            // ===== FOURNISSEURS =====
            1 -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (suppliers.isEmpty()) {
                        item { GesmakCard { Text("Aucun fournisseur enregistré.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(suppliers, key = { it.id }) { sup ->
                        GesmakCard {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = c.sky)
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(sup.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    if (!sup.contactPerson.isNullOrBlank()) {
                                        Text("Contact : ${sup.contactPerson}", color = c.muted, fontSize = 12.sp)
                                    }
                                    if (!sup.phone.isNullOrBlank()) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Phone, contentDescription = null, tint = c.muted, modifier = Modifier.size(12.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text(sup.phone, color = c.muted, fontSize = 12.sp)
                                        }
                                    }
                                    if (!sup.address.isNullOrBlank()) {
                                        Text(sup.address, color = c.muted, fontSize = 11.sp)
                                    }
                                }
                                IconButton(onClick = { editSup = sup; supModal = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent, modifier = Modifier.size(18.dp))
                                }
                                IconButton(onClick = { onDeleteSupplier(sup.id) { e -> if (e != null) err = e else notice = "Fournisseur supprimé" } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }

            // ===== ACHATS =====
            else -> {
                val monthSum = purchases.sumOf { it.total }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = c.accent)
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Achats récents", color = c.muted, fontSize = 12.sp)
                                    Text(formatFcfa(monthSum), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                }
                                StatusPill(label = "${purchases.size} bon(s)", color = c.sky)
                            }
                        }
                    }
                    if (purchases.isEmpty()) {
                        item { GesmakCard { Text("Aucun achat enregistré. Appuyez sur « Ajouter » pour réapprovisionner.", color = c.muted, fontSize = 13.sp) } }
                    }
                    items(purchases, key = { it.id }) { p ->
                        val prodName = products.find { it.id == p.productId }?.name ?: "Produit"
                        val supName = suppliers.find { it.id == p.supplierId }?.name ?: "Fournisseur direct"
                        GesmakCard {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(prodName, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text("${p.qty.toInt()} u × ${formatFcfa(p.unitCost)} · $supName", color = c.muted, fontSize = 12.sp)
                                    Text(p.createdAt.take(10), color = c.muted, fontSize = 11.sp)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(formatFcfa(p.total), color = c.accentDeep, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    StatusPill(label = if (p.status == "received") "Reçu" else p.status, color = c.emerald)
                                }
                                IconButton(onClick = { onDeletePurchase(p.id) { e -> if (e != null) err = e else notice = "Achat supprimé" } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (custModal) {
        var name by remember(editCust) { mutableStateOf(editCust?.name.orEmpty()) }
        var phone by remember(editCust) { mutableStateOf(editCust?.phone.orEmpty()) }
        var email by remember(editCust) { mutableStateOf(editCust?.email.orEmpty()) }
        var notes by remember(editCust) { mutableStateOf(editCust?.notes.orEmpty()) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) custModal = false },
            containerColor = c.card,
            title = { Text(if (editCust == null) "Nouveau client" else "Modifier client", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom complet *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Téléphone") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes / Préférences") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isBlank()) return@Button
                        busy = true
                        onSaveCustomer(editCust?.id, name, phone.ifBlank { null }, email.ifBlank { null }, notes.ifBlank { null }) { e ->
                            busy = false
                            if (e == null) { custModal = false; notice = "Client enregistré" } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { custModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (supModal) {
        var name by remember(editSup) { mutableStateOf(editSup?.name.orEmpty()) }
        var contact by remember(editSup) { mutableStateOf(editSup?.contactPerson.orEmpty()) }
        var phone by remember(editSup) { mutableStateOf(editSup?.phone.orEmpty()) }
        var email by remember(editSup) { mutableStateOf(editSup?.email.orEmpty()) }
        var addr by remember(editSup) { mutableStateOf(editSup?.address.orEmpty()) }
        var notes by remember(editSup) { mutableStateOf(editSup?.notes.orEmpty()) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) supModal = false },
            containerColor = c.card,
            title = { Text(if (editSup == null) "Nouveau fournisseur" else "Modifier fournisseur", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Société / Nom *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = contact, onValueChange = { contact = it }, label = { Text("Contact commercial") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Téléphone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = addr, onValueChange = { addr = it }, label = { Text("Adresse") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isBlank()) return@Button
                        busy = true
                        onSaveSupplier(editSup?.id, name, contact.ifBlank { null }, phone.ifBlank { null }, email.ifBlank { null }, addr.ifBlank { null }, notes.ifBlank { null }) { e ->
                            busy = false
                            if (e == null) { supModal = false; notice = "Fournisseur enregistré" } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = { TextButton(onClick = { supModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }

    if (purModal) {
        var selProd by remember { mutableStateOf(products.firstOrNull()) }
        var selSupId by remember { mutableStateOf("") }
        var qty by remember { mutableStateOf("24") }
        var unitCost by remember { mutableStateOf(selProd?.cost?.toLong()?.toString() ?: "") }
        var notes by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) purModal = false },
            containerColor = c.card,
            title = { Text("Nouvel achat (réapprovisionnement)", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Produit :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        products.take(30).forEach { p ->
                            FilterChip(
                                selected = selProd?.id == p.id,
                                onClick = {
                                    selProd = p
                                    if (unitCost.isBlank()) unitCost = p.cost.toLong().toString()
                                },
                                label = { Text(p.name, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                    if (suppliers.isNotEmpty()) {
                        Text("Fournisseur :", color = c.muted, fontSize = 12.sp)
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = selSupId.isBlank(), onClick = { selSupId = "" }, label = { Text("Direct") })
                            suppliers.forEach { s ->
                                FilterChip(selected = selSupId == s.id, onClick = { selSupId = s.id }, label = { Text(s.name, fontSize = 11.sp) })
                            }
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = qty,
                            onValueChange = { qty = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Quantité") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = unitCost,
                            onValueChange = { unitCost = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Coût unit.") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes / Facture") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    val total = (qty.toDoubleOrNull() ?: 0.0) * (unitCost.toDoubleOrNull() ?: 0.0)
                    Text("Total achat : ${formatFcfa(total)} (+stock automatique)", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val p = selProd ?: return@Button
                        val q = qty.toDoubleOrNull() ?: 0.0
                        if (q <= 0) return@Button
                        busy = true
                        onCreatePurchase(p, selSupId.ifBlank { null }, q, unitCost.toDoubleOrNull() ?: p.cost, notes.ifBlank { null }) { e ->
                            busy = false
                            if (e == null) { purModal = false; notice = "Achat enregistré et stock mis à jour" } else err = e
                        }
                    },
                    enabled = !busy && selProd != null,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "..." else "Valider l'achat") }
            },
            dismissButton = { TextButton(onClick = { purModal = false }) { Text("Annuler", color = c.muted) } },
        )
    }
}
