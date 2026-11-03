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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.LocalSalesStore
import com.gesmak.app.data.SupabaseApi
import java.text.NumberFormat
import java.util.Locale

@Composable
fun SalesScreen(
    mod: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    estId: String?,
    salesStore: LocalSalesStore,
    busy: Boolean,
    offlinePending: Int,
    onValidate: (lines: List<Pair<SupabaseApi.Product, Int>>, total: Double) -> Unit,
    onRefresh: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    val cart = remember { mutableStateMapOf<String, Int>() }
    var msg by remember { mutableStateOf<String?>(null) }
    var tickets by remember {
        mutableStateOf(if (estId != null) salesStore.list(estId) else emptyList())
    }
    val fcfa = NumberFormat.getNumberInstance(Locale.FRANCE)
    val total = products.sumOf { (cart[it.id] ?: 0) * it.price }
    val dayTotal = estId?.let { salesStore.dayTotal(it) } ?: 0.0

    Column(modifier = mod.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp)) {
        Text("Caisse", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = amber)
        Text(
            "CA local jour : ${fcfa.format(dayTotal.toLong())} F · sync serveur + stock",
            color = Color(0xFFA8A29E),
            fontSize = 12.sp,
        )
        if (offlinePending > 0) {
            Text("File hors-ligne : $offlinePending opération(s)", color = Color(0xFFFBBF24), fontSize = 12.sp)
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(products, key = { it.id }) { p ->
                val q = cart[p.id] ?: 0
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .background(Color(0xFF1C1917), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(p.name, color = Color.White, fontWeight = FontWeight.Medium)
                        Text(
                            "${fcfa.format(p.price.toLong())} F · stock ${p.stock.toLong()}",
                            color = Color(0xFFA8A29E),
                            fontSize = 12.sp,
                        )
                    }
                    Button(
                        onClick = { if (q > 0) cart[p.id] = q - 1 },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524)),
                    ) { Text("-") }
                    Text("$q", color = Color.White, modifier = Modifier.padding(horizontal = 10.dp, vertical = 12.dp))
                    Button(
                        onClick = { cart[p.id] = q + 1 },
                        colors = ButtonDefaults.buttonColors(containerColor = amber, contentColor = Color(0xFF0C0A09)),
                    ) { Text("+") }
                }
            }
            if (tickets.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text("Ventes du jour (verrouillées)", color = Color(0xFFA8A29E), fontSize = 12.sp)
                }
                items(tickets.take(20), key = { it.id }) { t ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .background(Color(0xFF1C1917), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(t.at, color = Color(0xFF78716C), fontSize = 11.sp)
                            Text(t.lines, color = Color(0xFFA8A29E), fontSize = 12.sp, maxLines = 2)
                        }
                        Text(
                            "${fcfa.format(t.total.toLong())} F",
                            color = Color(0xFF78716C),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
        Text("Total panier : ${fcfa.format(total.toLong())} F", color = amber, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        msg?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 12.sp) }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = {
                if (total <= 0 || estId == null) {
                    msg = if (estId == null) "Aucun établissement" else "Ajoutez des articles"
                    return@Button
                }
                val lines = products.filter { (cart[it.id] ?: 0) > 0 }.map { it to (cart[it.id] ?: 0) }
                val lineTxt = lines.joinToString(", ") { "${it.first.name}×${it.second}" }
                salesStore.add(estId, total, lineTxt)
                tickets = salesStore.list(estId)
                onValidate(lines, total)
                cart.clear()
                msg = "Vente en cours d'envoi…"
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = amber, contentColor = Color(0xFF0C0A09)),
        ) {
            Text(if (busy) "Envoi…" else "Valider la vente", fontWeight = FontWeight.Bold)
        }
        Button(
            onClick = onRefresh,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524), contentColor = Color.White),
        ) { Text("Actualiser") }
    }
}
