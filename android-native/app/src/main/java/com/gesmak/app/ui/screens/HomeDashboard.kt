package com.gesmak.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun HomeDashboard(
    mod: Modifier = Modifier,
    memberName: String,
    role: String,
    estName: String?,
    productCount: Int,
    openOrders: Int,
    loading: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    onLogout: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    Column(
        modifier = mod
            .fillMaxSize()
            .background(Color(0xFF0C0A09))
            .padding(20.dp),
    ) {
        Text("GESMAK", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = amber)
        Text(memberName, color = Color(0xFFF5F5F4), fontSize = 16.sp)
        Text(
            "${role.uppercase()} · ${estName ?: "Aucun établissement"}",
            color = Color(0xFFA8A29E),
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(20.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(mod = Modifier.weight(1f), title = "Produits", value = "$productCount")
            StatCard(
                mod = Modifier.weight(1f),
                title = "Commandes",
                value = "$openOrders",
                alert = openOrders > 0,
            )
        }
        Spacer(Modifier.height(16.dp))
        if (loading) Text("Actualisation…", color = Color(0xFFA8A29E))
        error?.let { Text(it, color = Color(0xFFF87171), fontSize = 12.sp) }
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onRefresh,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = amber, contentColor = Color(0xFF0C0A09)),
        ) {
            Text("Actualiser", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onLogout) {
            Text("Déconnexion", color = Color(0xFFA8A29E))
        }
    }
}

@Composable
private fun StatCard(
    mod: Modifier,
    title: String,
    value: String,
    alert: Boolean = false,
) {
    Card(
        modifier = mod,
        colors = CardDefaults.cardColors(
            containerColor = if (alert) Color(0xFF450A0A) else Color(0xFF1C1917),
        ),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Color(0xFFA8A29E), fontSize = 12.sp)
            Text(
                value,
                color = if (alert) Color(0xFFF87171) else Color(0xFFF59E0B),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
