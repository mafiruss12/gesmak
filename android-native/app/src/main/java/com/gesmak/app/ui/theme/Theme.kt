package com.gesmak.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Amber = Color(0xFFF59E0B)
private val Stone950 = Color(0xFF0C0A09)
private val Stone100 = Color(0xFFF5F5F4)

private val DarkColors = darkColorScheme(
    primary = Amber,
    onPrimary = Stone950,
    background = Stone950,
    onBackground = Stone100,
    surface = Color(0xFF1C1917),
    onSurface = Stone100,
)

@Composable
fun GesmakTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        content = content,
    )
}
