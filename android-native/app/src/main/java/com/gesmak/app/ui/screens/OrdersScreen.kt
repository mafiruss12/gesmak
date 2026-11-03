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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import java.text.NumberFormat
import java.util.Locale

@Composable
fun OrdersScreen(
    mod: modifier = Modifier,
    orders: List<SupabaseApi.OrderRow>,
    loading: Boolean,
    busyId: String?,
    onRefresh: () -> Unit,
    onAdvance: (orderId: String, nextStatus: String) -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    val fcfa = NumberFormat.getNumberInstance(Locale.FRANCE)
    Column(
        modifier = mod.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                "Commandes",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = amber,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = onRefresh,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524), contentColor = amber),
                shape = RoundedCornerShape(10.dp),
            ) { Text("Actualiser") }
        }
        if (loading) Text("Chargement…", color = Color(0xFFA8A29E))
        if (orders.isEmpty() && !loading) Text("Aucune commande en cours", color = Color(0xFF78716C))
        Spacer(Modifier.height(8.dp))
        LazyColumn {
            items(orders, key = { it.id }) { o ->
                val isNew = o.status == "pending"
                val next = when (o.status) {
                    "pending" -> "preparing"
                    "preparing" -> "ready"
                    "ready" -> "served"
                    else -> null
                }
                val nextLabel = when (next) {
                    "preparing" -> "En préparation"
                    "ready" -> "Prête"
                    "served" -> "Servie"
                    else -> null
                }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .background(
                            if (isNew) Color(0xFF450A0A) else Color(0xFF1C1917),
                            RoundedCornerShape(14.dp),
                        )
                        .padding(14.dp),
                ) {
                    Row {
                        Text(
                            o.status.uppercase(),
                            color = if (isNew) Color(0xFFF87171) else amber,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "${fcfa.format(o.total.toLong())} F",
                            color = amber,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        o.customerName ?: "Client",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (!o.tableNumber.isNullOrBlank()) {
                        Text("Table ${o.tableNumber}", color = Color(0xFFA8A29E), fontSize = 12.sp)
                    }
                    if (next != null && nextLabel != null) {
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = { onAdvance(o.id, next) },
                            enabled = busyId != o.id,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = amber,
                                contentColor = Color(0xFF0C0A09),
                            ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text(
                                if (busyId == o.id) "…" else nextLabel,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
    }
}
