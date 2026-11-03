package com.gesmak.app.ui.screens
import androidx.compose.ui.Modifier
import androidx.compose.ui.Modifier.modifier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun HomeScreen(
    email: String,
    onLogout: () -> Unit,
) {
    val amber = Color(0xFFF59E0B)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C0A09))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("GESMAK", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = amber)
        Spacer(Modifier.height(8.dp))
        Text(
            "Version native Kotlin (fondations)",
            color = Color(0xFFA8A29E),
            fontSize = 14.sp,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Connecté : ${email.ifBlank { "session active" }}",
            color = Color(0xFFF5F5F4),
            fontSize = 15.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "Prochaines étapes natives : dashboard, caisse, commandes, inventaire, FCM.",
            color = Color(0xFF78716C),
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(28.dp))
        Button(
            onClick = onLogout,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF292524),
                contentColor = Color.White,
            ),
        ) {
            Text("Déconnexion")
        }
    }
}
