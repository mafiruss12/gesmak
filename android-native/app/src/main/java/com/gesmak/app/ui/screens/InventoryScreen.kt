package com.gesmak.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.gesmak.app.ui.components.ProductThumb
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

@Composable
fun InventoryScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    loading: Boolean,
    canEdit: Boolean,
    onRefresh: () -> Unit,
    onSaveProduct: (
        existingId: String?,
        name: String,
        category: String?,
        price: Double,
        cost: Double,
        stock: Double,
        minStock: Double,
        unit: String?,
        unitsPerPackage: Int,
        onDone: (String?) -> Unit,
    ) -> Unit,
    onDeleteProduct: (productId: String, onDone: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    var query by remember { mutableStateOf("") }
    var onlyAlerts by remember { mutableStateOf(false) }
    var editingProduct by remember { mutableStateOf<SupabaseApi.Product?>(null) }
    var modalOpen by remember { mutableStateOf(false) }
    var deleteConfirmProduct by remember { mutableStateOf<SupabaseApi.Product?>(null) }

    val filtered = remember(products, query, onlyAlerts) {
        products.filter { p ->
            (!onlyAlerts || p.stock <= p.minStock) &&
                (query.isBlank() || p.name.contains(query, ignoreCase = true) ||
                    (p.category?.contains(query, ignoreCase = true) == true))
        }
    }

    Scaffold(
        modifier = mod.fillMaxSize(),
        containerColor = c.bg,
        floatingActionButton = {
            if (canEdit) {
                FloatingActionButton(
                    onClick = { editingProduct = null; modalOpen = true },
                    containerColor = c.accent,
                    contentColor = Color.White,
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Nouveau produit")
                }
            }
        },
    ) { innerPad ->
        Column(
            modifier = Modifier
                .padding(innerPad)
                .fillMaxSize()
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Stock & Inventaire", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                    Text("${products.size} référence(s)", color = c.muted, fontSize = 12.sp)
                }
                IconButton(onClick = onRefresh, enabled = !loading) {
                    if (loading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = c.accent, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Rechercher produit ou catégorie...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = c.muted) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !onlyAlerts,
                    onClick = { onlyAlerts = false },
                    label = { Text("Tous (${products.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = c.accent,
                        selectedLabelColor = Color.White,
                    ),
                )
                val alertCount = products.count { it.stock <= it.minStock }
                FilterChip(
                    selected = onlyAlerts,
                    onClick = { onlyAlerts = true },
                    label = { Text("Stock bas ($alertCount)") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = c.rose,
                        selectedLabelColor = Color.White,
                    ),
                )
            }

            Spacer(Modifier.height(8.dp))
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(filtered, key = { it.id }) { p ->
                    val isOut = p.stock <= 0.0
                    val isLow = p.stock <= p.minStock
                    GesmakCard(
                        borderColor = if (isOut) c.rose.copy(alpha = 0.4f) else null,
                        modifier = if (canEdit) Modifier.clickable { editingProduct = p; modalOpen = true } else Modifier,
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            ProductThumb(
                                name = p.name,
                                category = p.category,
                                imageUrl = p.imageUrl,
                                remoteDefaults = productImageDefaults,
                                size = 46.dp,
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    "${p.category ?: "Sans catégorie"} · Vente: ${formatFcfa(p.price)} · Achat: ${formatFcfa(p.cost)}",
                                    color = c.muted,
                                    fontSize = 12.sp,
                                )
                            }
                            StatusPill(
                                label = "${p.stock.toInt()} ${p.unit ?: "u"}",
                                color = when {
                                    isOut -> c.rose
                                    isLow -> c.accentDeep
                                    else -> c.emerald
                                },
                            )
                            if (canEdit) {
                                Spacer(Modifier.width(4.dp))
                                IconButton(onClick = { editingProduct = p; modalOpen = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.muted, modifier = Modifier.size(18.dp))
                                }
                                IconButton(onClick = { deleteConfirmProduct = p }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(72.dp)) }
            }
        }
    }

    if (modalOpen) {
        var name by remember(editingProduct) { mutableStateOf(editingProduct?.name.orEmpty()) }
        var category by remember(editingProduct) { mutableStateOf(editingProduct?.category.orEmpty()) }
        var price by remember(editingProduct) { mutableStateOf(editingProduct?.price?.toLong()?.toString().orEmpty()) }
        var cost by remember(editingProduct) { mutableStateOf(editingProduct?.cost?.toLong()?.toString().orEmpty()) }
        var stock by remember(editingProduct) { mutableStateOf(editingProduct?.stock?.toInt()?.toString().orEmpty()) }
        var minStock by remember(editingProduct) { mutableStateOf((editingProduct?.minStock ?: 5.0).toInt().toString()) }
        var unit by remember(editingProduct) { mutableStateOf(editingProduct?.unit ?: "bouteille") }
        var unitsPerPkg by remember(editingProduct) { mutableStateOf((editingProduct?.unitsPerPackage ?: 24).toString()) }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { if (!busy) modalOpen = false },
            containerColor = c.card,
            title = {
                Text(
                    if (editingProduct == null) "Nouveau produit" else "Modifier ${editingProduct!!.name}",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom du produit") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Catégorie (Boissons, Plats...)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = price,
                            onValueChange = { price = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Prix vente") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = cost,
                            onValueChange = { cost = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Coût achat") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = stock,
                            onValueChange = { stock = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Stock") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = minStock,
                            onValueChange = { minStock = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Seuil alerte") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = unit,
                            onValueChange = { unit = it },
                            label = { Text("Unité (bouteille, plat...)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = unitsPerPkg,
                            onValueChange = { unitsPerPkg = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Qté / casier") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isBlank()) { err = "Nom requis"; return@Button }
                        busy = true
                        onSaveProduct(
                            editingProduct?.id,
                            name,
                            category.ifBlank { null },
                            price.toDoubleOrNull() ?: 0.0,
                            cost.toDoubleOrNull() ?: 0.0,
                            stock.toDoubleOrNull() ?: 0.0,
                            minStock.toDoubleOrNull() ?: 5.0,
                            unit.ifBlank { null },
                            (unitsPerPkg.toIntOrNull() ?: 24).coerceAtLeast(1),
                        ) { e ->
                            busy = false
                            if (e == null) modalOpen = false else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) {
                    Text(if (busy) "Enregistrement..." else "Enregistrer")
                }
            },
            dismissButton = {
                TextButton(onClick = { modalOpen = false }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    if (deleteConfirmProduct != null) {
        val target = deleteConfirmProduct!!
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) deleteConfirmProduct = null },
            containerColor = c.card,
            title = { Text("Supprimer le produit", color = c.rose, fontWeight = FontWeight.Bold) },
            text = { Text("Supprimer définitivement « ${target.name} » de votre stock ?", color = c.text) },
            confirmButton = {
                Button(
                    onClick = {
                        busy = true
                        onDeleteProduct(target.id) {
                            busy = false
                            deleteConfirmProduct = null
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.rose, contentColor = Color.White),
                ) { Text("Supprimer") }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirmProduct = null }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }
}
