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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale

@Composable
fun ReportsScreen(
    mod: Modifier = Modifier,
    caDay: Double,
    caWeek: Double,
    caMonth: Double,
    recent: List<Triple<String, Double, String>>,
    loading: Boolean,
    onRefresh: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    val fcfa = NumberFormat.getNumberInstance(Locale.FRANCE)
    Column(
        modifier = mod.fillMaxSize().background(Color(0xFF0C0A09)).padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                "Rapports CA",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = amber,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = onRefresh,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF292524), contentColor = amber),
            ) { Text("Actualiser") }
        }
        if (loading) Text("Chargement…", color = Color(0xFFA8A29E))
        Spacer(Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            CaCard(Modifier.weight(1f), "Aujourd'hui", caDay, fcfa)
            Spacer(Modifier.height(0.dp))
        }
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            CaCard(Modifier.weight(1f).padding(end = 6.dp), "7 jours", caWeek, fcfa)
            CaCard(Modifier.weight(1f).padding(start = 6.dp), "30 jours", caMonth, fcfa)
        }
        Spacer(Modifier.height(16.dp))
        Text("Dernières ventes (serveur)", color = Color(0xFFA8A29E), fontSize = 12.sp)
        LazyColumn {
            items(recent) { (at, total, qty) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .background(Color(0xFF1C1917), RoundedCornerShape(10.dp))
                        .padding(10.dp),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(at.take(19).replace('T', ' '), color = Color(0xFFA8A29E), fontSize = 11.sp)
                        Text("qté $qty", color = Color(0xFF78716C), fontSize = 11.sp)
                    }
                    Text(
                        "${fcfa.format(total.toLong())} F",
                        color = amber,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun CaCard(
    mod: Modifier,
    title: String,
    value: Double,
    fcfa: NumberFormat,
) {
    Card(
        modifier = mod,
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1917)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(title, color = Color(0xFFA8A29E), fontSize = 12.sp)
            Text(
                "${fcfa.format(value.toLong())} F",
                color = Color(0xFFF59E0B),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
