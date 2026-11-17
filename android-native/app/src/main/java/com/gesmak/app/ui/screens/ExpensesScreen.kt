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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa

private val EXPENSE_CATS = listOf("Achats", "Loyer", "Électricité / Eau", "Salaires", "Transport", "Gaz / Charbon", "Entretien", "Autre")

@Composable
fun ExpensesScreen(
    mod: Modifier = Modifier,
    expenses: List<SupabaseApi.ExpenseRow>,
    todayTotal: Double,
    monthTotal: Double,
    canManage: Boolean,
    onRefresh: () -> Unit,
    onSave: (existingId: String?, category: String, description: String?, amount: Double, paymentMethod: String, cb: (String?) -> Unit) -> Unit,
    onDelete: (expenseId: String) -> Unit,
) {
    val c = LocalGesmakColors.current
    var modalOpen by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<SupabaseApi.ExpenseRow?>(null) }

    Scaffold(
        modifier = mod.fillMaxSize(),
        containerColor = c.bg,
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { editing = null; modalOpen = true },
                    containerColor = c.accent,
                    contentColor = Color.White,
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Nouvelle dépense")
                }
            }
        },
    ) { pad ->
        Column(
            modifier = Modifier
                .padding(pad)
                .fillMaxSize()
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Dépenses", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                    Text("Suivez les sorties de caisse et charges", color = c.muted, fontSize = 12.sp)
                }
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GesmakCard(modifier = Modifier.weight(1f)) {
                    Text("Aujourd'hui", color = c.muted, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(formatFcfa(todayTotal), color = c.rose, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
                GesmakCard(modifier = Modifier.weight(1f)) {
                    Text("Ce mois", color = c.muted, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(formatFcfa(monthTotal), color = c.accentDeep, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            }
            Spacer(Modifier.height(10.dp))

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (expenses.isEmpty()) {
                    item {
                        GesmakCard { Text("Aucune dépense enregistrée.", color = c.muted, fontSize = 13.sp) }
                    }
                }
                items(expenses, key = { it.id }) { e ->
                    GesmakCard(
                        modifier = if (canManage) Modifier.clickable { editing = e; modalOpen = true } else Modifier,
                    ) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(e.category, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text(
                                    "${e.description ?: "—"} · ${e.createdAt.take(10)}",
                                    color = c.muted,
                                    fontSize = 12.sp,
                                )
                            }
                            Text(formatFcfa(e.amount), color = c.rose, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            if (canManage) {
                                IconButton(onClick = { editing = e; modalOpen = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent, modifier = Modifier.size(18.dp))
                                }
                                IconButton(onClick = { onDelete(e.id) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.muted, modifier = Modifier.size(18.dp))
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
        var cat by remember(editing) { mutableStateOf(editing?.category ?: EXPENSE_CATS.first()) }
        var desc by remember(editing) { mutableStateOf(editing?.description.orEmpty()) }
        var amount by remember(editing) { mutableStateOf(editing?.amount?.toLong()?.toString().orEmpty()) }
        var pay by remember(editing) { mutableStateOf(editing?.paymentMethod ?: "cash") }
        var busy by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { if (!busy) modalOpen = false },
            containerColor = c.card,
            title = { Text(if (editing == null) "Nouvelle dépense" else "Modifier dépense", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        EXPENSE_CATS.forEach { k ->
                            FilterChip(
                                selected = cat == k,
                                onClick = { cat = k },
                                label = { Text(k, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.accent,
                                    selectedLabelColor = Color.White,
                                ),
                            )
                        }
                    }
                    OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Description") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Montant (FCFA)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("cash" to "Espèces", "mobile_money" to "Mobile Money").forEach { (k, l) ->
                            FilterChip(
                                selected = pay == k,
                                onClick = { pay = k },
                                label = { Text(l, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.accent,
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
                        val v = amount.toDoubleOrNull() ?: 0.0
                        if (v <= 0) { err = "Montant invalide"; return@Button }
                        busy = true
                        onSave(editing?.id, cat, desc.ifBlank { null }, v, pay) { e ->
                            busy = false
                            if (e == null) modalOpen = false else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) {
                    Text(if (busy) "..." else "Enregistrer")
                }
            },
            dismissButton = {
                TextButton(onClick = { modalOpen = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }
}
