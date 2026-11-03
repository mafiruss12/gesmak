package com.gesmak.app.ui.screens
import androidx.compose.ui.Modifier
import androidx.compose.ui.Modifier.modifier

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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import java.text.NumberFormat
import java.util.Locale

@Composable
fun SalesScreen(
    modifier: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    onRefresh: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    val cart = remember { mutableStateMapOf<String, Int>() }
    var msg by remember { mutableStateOf<String?>(null) }
    val fcfa = NumberFormat.getNumberInstance(Locale.FRANCE)
    val total = products.sumOf { (cart[it.id] ?: 0) * it.price }

    Column(
        modifier = modifier.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp),
    ) {
        Text("Caisse", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = amber)
        Text("Sélectionnez les articles puis validez (ticket local).", color = Color(0xFFA8A29E), fontSize = 12.sp)
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
                        Text("${fcfa.format(p.price.toLong())} F", color = Color(0xFFA8A29E), fontSize = 12.sp)
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
        }
        Text("Total : ${fcfa.format(total.toLong())} F", color = amber, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        msg?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 12.sp) }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = {
                if (total <= 0) {
                    msg = "Ajoutez des articles"
                } else {
                    msg = "Vente enregistrée localement · ${fcfa.format(total.toLong())} F"
                    cart.clear()
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = amber, contentColor = Color(0xFF0C0A09)),
        ) {
            Text("Valider la vente", fontWeight = FontWeight.Bold)
        }
        Button(
            onClick = onRefresh,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524), contentColor = Color.White),
        ) { Text("Actualiser le stock") }
    }
}
