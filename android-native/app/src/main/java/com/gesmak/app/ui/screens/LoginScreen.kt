package com.gesmak.app.ui.screens
import androidx.compose.ui.Modifier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun LoginScreen(
    authConfigured: Boolean,
    onLogin: (login: String, password: String, onResult: (String?) -> Unit) -> Unit,
) {
    var login by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    val amber = Color(0xFFF59E0B)
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = amber,
        unfocusedBorderColor = Color(0xFF44403C),
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        cursorColor = amber,
        focusedLabelColor = amber,
        unfocusedLabelColor = Color(0xFFA8A29E),
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C0A09))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "GESMAK",
            fontSize = 36.sp,
            fontWeight = FontWeight.Bold,
            color = amber,
        )
        Text(
            text = "Gestion simplifiée · Business maîtrisé",
            color = Color(0xFFA8A29E),
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(28.dp))

        if (!authConfigured) {
            Text(
                text = "Build sans clés Supabase — configurez SUPABASE_URL et SUPABASE_ANON_KEY dans le CI.",
                color = Color(0xFFFBBF24),
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = 12.dp),
            )
        }

        OutlinedTextField(
            value = login,
            onValueChange = { login = it },
            label = { Text("Identifiant ou email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Mot de passe") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors,
        )

        error?.let {
            Spacer(Modifier.height(8.dp))
            Text(text = it, color = Color(0xFFF87171), fontSize = 13.sp)
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                error = null
                loading = true
                onLogin(login, password) { err ->
                    loading = false
                    error = err
                }
            },
            enabled = !loading && login.isNotBlank() && password.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = amber,
                contentColor = Color(0xFF0C0A09),
            ),
        ) {
            if (loading) CircularProgressIndicator(color = Color(0xFF0C0A09))
            else Text("Se connecter", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(Modifier.height(16.dp))
        Text(
            text = "App créée par Kevin Akoh · Kevin Tech Pro",
            color = Color(0xFF57534E),
            fontSize = 11.sp,
        )
    }
}
