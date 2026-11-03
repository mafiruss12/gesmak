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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import java.text.NumberFormat
import java.util.Locale

@Composable
fun InventoryScreen(
    modifier: Modifier = Modifier,
    products: List<SupabaseApi.Product>,
    loading: Boolean,
    onRefresh: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    val fcfa = NumberFormat.getNumberInstance(Locale.FRANCE)
    Column(
        modifier = modifier.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp),
    ) {
        Row(Modifier = Modifier.fillMaxWidth()) {
            Text("Stock", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = amber, modifier = Modifier.weight(1f))
            Button(
                onClick = onRefresh,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524), contentColor = amber),
                shape = RoundedCornerShape(10.dp),
            ) { Text("Actualiser") }
        }
        if (loading) Text("Chargement…", color = Color(0xFFA8A29E))
        if (products.isEmpty() && !loading) Text("Aucun produit", color = Color(0xFF78716C))
        Spacer(Modifier.height(8.dp))
        LazyColumn {
            items(products, key = { it.id }) { p ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp)
                        .background(Color(0xFF1C1917), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                ) {
                    Column(Modifier = Modifier.weight(1f)) {
                        Text(p.name, color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text(p.category ?: "—", color = Color(0xFF78716C), fontSize = 12.sp)
                    }
                    Column {
                        Text("${fcfa.format(p.stock.toLong())}", color = amber, fontWeight = FontWeight.Bold)
                        Text("${fcfa.format(p.price.toLong())} F", color = Color(0xFFA8A29E), fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
