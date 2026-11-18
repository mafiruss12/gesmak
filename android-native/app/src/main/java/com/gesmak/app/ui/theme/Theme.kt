package com.gesmak.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.gesmak.app.data.BusinessTypes
import java.text.NumberFormat
import java.util.Locale

data class GesmakPalette(
    val isLight: Boolean,
    val bg: Color,
    val card: Color,
    val cardAlt: Color,
    val border: Color,
    val text: Color,
    val muted: Color,
    val accent: Color,
    val accentDeep: Color,
    val accentSoft: Color,
    val headerBg: Color,
    val emerald: Color,
    val sky: Color,
    val rose: Color,
)

val LightGesmakPalette = GesmakPalette(
    isLight = true,
    bg = Color(0xFFF5F5F5),
    card = Color(0xFFFFFFFF),
    cardAlt = Color(0xFFF7F7F7),
    border = Color(0xFFE8E8E8),
    text = Color(0xFF1A1A1A),
    muted = Color(0xFF666666),
    accent = Color(0xFFFF7900),
    accentDeep = Color(0xFFE56A00),
    accentSoft = Color(0xFFFFF3E6),
    headerBg = Color(0xFFFFFFFF),
    emerald = Color(0xFF059669),
    sky = Color(0xFF0284C7),
    rose = Color(0xFFDC2626),
)

val DarkGesmakPalette = GesmakPalette(
    isLight = false,
    bg = Color(0xFF0C0A09),
    card = Color(0xFF1C1917),
    cardAlt = Color(0xFF292524),
    border = Color(0xFF3A332E),
    text = Color(0xFFF5F5F4),
    muted = Color(0xFFA8A29E),
    accent = Color(0xFFF59E0B),
    accentDeep = Color(0xFFD97706),
    accentSoft = Color(0xFF2D2114),
    headerBg = Color(0xFF14110F),
    emerald = Color(0xFF34D399),
    sky = Color(0xFF38BDF8),
    rose = Color(0xFFF87171),
)

val LocalGesmakColors = staticCompositionLocalOf { LightGesmakPalette }

private val LightScheme = lightColorScheme(
    primary = Color(0xFFFF7900),
    onPrimary = Color.White,
    background = Color(0xFFF5F5F5),
    onBackground = Color(0xFF1A1A1A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1A1A1A),
    surfaceVariant = Color(0xFFF7F7F7),
    onSurfaceVariant = Color(0xFF666666),
    outline = Color(0xFFE8E8E8),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFF59E0B),
    onPrimary = Color(0xFF0C0A09),
    background = Color(0xFF0C0A09),
    onBackground = Color(0xFFF5F5F4),
    surface = Color(0xFF1C1917),
    onSurface = Color(0xFFF5F5F4),
    surfaceVariant = Color(0xFF292524),
    onSurfaceVariant = Color(0xFFA8A29E),
    outline = Color(0xFF3A332E),
)

@Composable
fun GesmakTheme(
    isLight: Boolean = true,
    businessType: String? = null,
    content: @Composable () -> Unit,
) {
    val bizSpec = BusinessTypes.spec(businessType)
    val basePalette = if (isLight) LightGesmakPalette else DarkGesmakPalette
    val palette = basePalette.copy(
        accent = bizSpec.accent(isLight),
        accentDeep = bizSpec.deep(isLight),
        accentSoft = bizSpec.soft(isLight),
    )
    val scheme = if (isLight) {
        LightScheme.copy(primary = palette.accent, secondary = palette.accentDeep)
    } else {
        DarkScheme.copy(primary = palette.accent, secondary = palette.accentDeep)
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            @Suppress("DEPRECATION")
            window.statusBarColor = palette.headerBg.toArgb()
            @Suppress("DEPRECATION")
            window.navigationBarColor = palette.headerBg.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = palette.isLight
                isAppearanceLightNavigationBars = palette.isLight
            }
        }
    }
    CompositionLocalProvider(LocalGesmakColors provides palette) {
        MaterialTheme(
            colorScheme = scheme,
            content = content,
        )
    }
}

fun formatFcfa(amount: Double): String {
    val nf = NumberFormat.getIntegerInstance(Locale.FRANCE)
    return "${nf.format(amount.toLong())} F"
}

fun roleLabelFr(role: String?): String = when (role?.lowercase()) {
    "super_admin" -> "Super Admin"
    "admin" -> "Admin"
    "owner", "proprietaire", "propriétaire" -> "Propriétaire"
    "manager", "gerant", "gérant" -> "Manager de pôle"
    "cashier", "caissier", "caissiere", "caissière" -> "Caissière"
    else -> "Employé"
}

fun poleLabelFr(code: String?): String = when (code?.lowercase()) {
    "maquis" -> "Maquis"
    "bar" -> "Bar & Lounge"
    "restaurant" -> "Restaurant"
    "piscine" -> "Piscine"
    "hotel" -> "Hôtel & Réception"
    "jeux" -> "Espace de jeux"
    "boutique" -> "Boutique"
    null, "" -> "Caisse générale"
    else -> code.replaceFirstChar { it.uppercase() }
}

fun poleColorHex(code: String?): Color = when (code?.lowercase()) {
    "maquis" -> Color(0xFFF59E0B)
    "bar" -> Color(0xFFEC4899)
    "restaurant" -> Color(0xFFEF4444)
    "piscine" -> Color(0xFF06B6D4)
    "hotel" -> Color(0xFF6366F1)
    "jeux" -> Color(0xFF10B981)
    "boutique" -> Color(0xFF0EA5E9)
    else -> Color(0xFFFF7900)
}
