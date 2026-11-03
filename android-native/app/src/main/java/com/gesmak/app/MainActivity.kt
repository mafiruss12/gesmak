package com.gesmak.app
import androidx.compose.ui.modifier.Modifier

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.gesmak.app.ui.GesmakApp
import com.gesmak.app.ui.theme.GesmakTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GesmakTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF0C0A09),
                ) {
                    GesmakApp()
                }
            }
        }
    }
}
