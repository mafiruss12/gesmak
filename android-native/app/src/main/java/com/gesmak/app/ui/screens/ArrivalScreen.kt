package com.gesmak.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi

@Composable
fun ArrivalScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    canEdit: Boolean,
    busy: Boolean,
    onSubmit: (product: SupabaseApi.Product, casiers: Int, perCasier: Int, unitExtra: Int) -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    var selectedId by remember { mutableStateOf<String?>(null) }
    var casiers by remember { mutableStateOf("1") }
    var perCasier by remember { mutableStateOf("12") }
    var extra by remember { mutableStateOf("0") }
    var msg by remember { mutableStateOf<String?>(null) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = amber,
        unfocusedBorderColor = Color(0xFF44403C),
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        cursorColor = amber,
        focusedLabelColor = amber,
        unfocusedLabelColor = Color(0xFFA8A29E),
    )

    Column(modifier = mod.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp)) {
        Text("Arrivages", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = amber)
        Text(
            if (canEdit) "Casiers × contenu + unités → stock serveur"
            else "Lecture seule — demandez au propriétaire",
            color = Color(0xFFA8A29E),
            fontSize = 12.sp,
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(products, key = { it.id }) { p ->
                val sel = selectedId == p.id
                Button(
                    onClick = { if (canEdit) selectedId = p.id },
                    enabled = canEdit,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (sel) amber else Color(0xFF1C1917),
                        contentColor = if (sel) Color(0xFF0C0A09) else Color.White,
                    ),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("${p.name} · stock ${p.stock.toLong()}")
                }
            }
        }
        if (canEdit && selectedId != null) {
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = casiers,
                    onValueChange = { casiers = it.filter { c -> c.isDigit() } },
                    label = { Text("Casiers") },
                    modifier = Modifier.weight(1f).padding(end = 6.dp),
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = perCasier,
                    onValueChange = { perCasier = it.filter { c -> c.isDigit() } },
                    label = { Text("Par casier") },
                    modifier = Modifier.weight(1f).padding(horizontal = 6.dp),
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = extra,
                    onValueChange = { extra = it.filter { c -> c.isDigit() } },
                    label = { Text("Unités") },
                    modifier = Modifier.weight(1f).padding(start = 6.dp),
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                )
            }
            val c = casiers.toIntOrNull() ?: 0
            val pc = perCasier.toIntOrNull() ?: 0
            val ex = extra.toIntOrNull() ?: 0
            val total = c * pc + ex
            Text("Total bouteilles : $total", color = amber, fontWeight = FontWeight.Bold)
            msg?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 12.sp) }
            Button(
                onClick = {
                    val p = products.find { it.id == selectedId } ?: return@Button
                    if (total <= 0) {
                        msg = "Quantité nulle"
                        return@Button
                    }
                    onSubmit(p, c, pc, ex)
                    msg = "Arrivage envoyé (+$total)"
                },
                enabled = !busy && total > 0,
                modifier = Modifier.fillMaxWidth().height(48.dp).padding(top = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = amber, contentColor = Color(0xFF0C0A09)),
            ) {
                Text(if (busy) "…" else "Valider l'arrivage", fontWeight = FontWeight.Bold)
            }
        }
    }
}
