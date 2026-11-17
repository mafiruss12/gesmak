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
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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

@Composable
fun ArrivalScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    productImageDefaults: Map<String, String> = emptyMap(),
    canEdit: Boolean,
    busy: Boolean,
    onSubmit: (product: SupabaseApi.Product, casiers: Int, perCasier: Int, unitExtra: Int) -> Unit,
) {
    val c = LocalGesmakColors.current
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<SupabaseApi.Product?>(null) }
    var casiers by remember { mutableStateOf("1") }
    var perCasier by remember { mutableStateOf("24") }
    var extra by remember { mutableStateOf("0") }
    var msg by remember { mutableStateOf<String?>(null) }

    val filtered = remember(products, query) {
        products.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }
    }

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text("Arrivages & Casiers", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
        Text("Ajouter des casiers ou unités reçues au stock", color = c.muted, fontSize = 12.sp)
        Spacer(Modifier.height(10.dp))

        if (!canEdit) {
            GesmakCard(borderColor = c.rose.copy(alpha = 0.3f)) {
                Text(
                    "Accès lecture seule : seul le propriétaire, le manager ou un employé autorisé peut enregistrer un arrivage.",
                    color = c.muted,
                    fontSize = 13.sp,
                )
            }
            return@Column
        }

        if (selected != null) {
            val p = selected!!
            val nCas = casiers.toIntOrNull() ?: 0
            val nPer = perCasier.toIntOrNull() ?: p.unitsPerPackage
            val nExt = extra.toIntOrNull() ?: 0
            val totalAdd = nCas * nPer + nExt

            GesmakCard(borderColor = c.accent) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ProductThumb(
                        name = p.name,
                        category = p.category,
                        imageUrl = p.imageUrl,
                        remoteDefaults = productImageDefaults,
                        size = 42.dp,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(p.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
                    Text(
                        "Changer",
                        color = c.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { selected = null },
                    )
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = casiers,
                        onValueChange = { casiers = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Casiers") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = perCasier,
                        onValueChange = { perCasier = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Par casier") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = extra,
                        onValueChange = { extra = it.filter { ch -> ch.isDigit() } },
                        label = { Text("+ Unités") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "Stock actuel : ${p.stock.toInt()} → Nouveau stock : ${p.stock.toInt() + totalAdd} (+$totalAdd)",
                    color = c.emerald,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        if (totalAdd > 0) {
                            onSubmit(p, nCas, nPer, nExt)
                            msg = "+$totalAdd ${p.name} enregistré(s)"
                            selected = null
                        }
                    },
                    enabled = !busy && totalAdd > 0,
                    colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                ) {
                    if (busy) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Valider l'arrivage (+$totalAdd)", fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }

        if (!msg.isNullOrBlank()) {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = c.emerald.copy(alpha = 0.12f),
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            ) {
                Text(msg!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(10.dp))
            }
        }

        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Choisir un produit à réapprovisionner...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = c.muted) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(filtered, key = { it.id }) { p ->
                GesmakCard(
                    modifier = Modifier.clickable {
                        selected = p
                        perCasier = p.unitsPerPackage.toString()
                        casiers = "1"
                        extra = "0"
                        msg = null
                    },
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
                            size = 44.dp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("Conditionnement par défaut : ${p.unitsPerPackage}/casier", color = c.muted, fontSize = 11.sp)
                        }
                        StatusPill(label = "Stock ${p.stock.toInt()}", color = c.accent)
                    }
                }
            }
        }
    }
}
