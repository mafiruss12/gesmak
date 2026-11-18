package com.gesmak.app.ui.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.gesmak.app.R
import com.gesmak.app.data.ProductImages
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.theme.LocalGesmakColors

@Composable
fun GesmakCard(
    modifier: Modifier = Modifier,
    borderColor: Color? = null,
    bgColor: Color? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = LocalGesmakColors.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = bgColor ?: c.card,
        border = BorderStroke(1.dp, borderColor ?: c.border),
        shadowElevation = if (c.isLight) 1.dp else 0.dp,
    ) {
        Column(modifier = Modifier.padding(14.dp), content = content)
    }
}

@Composable
fun ProductThumb(
    name: String,
    category: String?,
    imageUrl: String?,
    remoteDefaults: Map<String, String> = emptyMap(),
    size: Dp = 46.dp,
) {
    val c = LocalGesmakColors.current
    val ctx = LocalContext.current
    val resolvedPrimary = remember(name, category, imageUrl, remoteDefaults) {
        ProductImages.resolve(name, category, imageUrl, remoteDefaults)
    }
    val fallbackPhoto = remember(name, category) {
        ProductImages.matchDrinkPhoto(name, category) ?: ProductImages.categoryFallback(category)
    }
    var useFallback by remember(resolvedPrimary) { mutableStateOf(false) }
    val activeUrl = if (useFallback) fallbackPhoto else resolvedPrimary

    // Instant in-memory Bitmap decode for Base64 data:image/... URIs returned from Supabase
    val decodedBitmap = remember(activeUrl) {
        if (activeUrl.startsWith("data:image", ignoreCase = true)) {
            try {
                val comma = activeUrl.indexOf(',')
                if (comma > 0) {
                    val bytes = Base64.decode(activeUrl.substring(comma + 1).trim(), Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                } else {
                    null
                }
            } catch (_: Exception) {
                null
            }
        } else {
            null
        }
    }

    val initial = name.trim().take(2).uppercase().ifBlank { "B" }
    Surface(
        modifier = Modifier.size(size),
        shape = RoundedCornerShape(10.dp),
        color = Color.White,
        border = BorderStroke(1.dp, c.border),
    ) {
        if (decodedBitmap != null) {
            Image(
                bitmap = decodedBitmap,
                contentDescription = name,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(3.dp),
            )
        } else {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(if (activeUrl.startsWith("data:image", ignoreCase = true)) fallbackPhoto else activeUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = name,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(3.dp),
                loading = {
                    Box(
                        modifier = Modifier.fillMaxSize().background(c.accentSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(initial, color = c.accentDeep, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                },
                error = {
                    LaunchedEffect(activeUrl) {
                        if (!useFallback && activeUrl != fallbackPhoto) {
                            useFallback = true
                        }
                    }
                    Box(
                        modifier = Modifier.fillMaxSize().background(c.accentSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(initial, color = c.accentDeep, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                },
            )
        }
    }
}

@Composable
fun EstablishmentLogo(
    name: String,
    logoUrl: String?,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    cornerRadius: Dp = 12.dp,
    isCircle: Boolean = false,
    accentColor: Color = LocalGesmakColors.current.accent,
) {
    val c = LocalGesmakColors.current
    val ctx = LocalContext.current
    val cleanUrl = logoUrl?.trim().orEmpty()
    val decodedBitmap = remember(cleanUrl) {
        if (cleanUrl.startsWith("data:image", ignoreCase = true)) {
            try {
                val comma = cleanUrl.indexOf(',')
                if (comma > 0) {
                    val bytes = Base64.decode(cleanUrl.substring(comma + 1).trim(), Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                } else {
                    null
                }
            } catch (_: Exception) {
                null
            }
        } else {
            null
        }
    }
    val shape = if (isCircle) CircleShape else RoundedCornerShape(cornerRadius)
    Surface(
        modifier = modifier.size(size),
        shape = shape,
        color = c.cardAlt,
        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.45f)),
    ) {
        when {
            decodedBitmap != null -> {
                Image(
                    bitmap = decodedBitmap,
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            cleanUrl.startsWith("http://", ignoreCase = true) || cleanUrl.startsWith("https://", ignoreCase = true) -> {
                SubcomposeAsyncImage(
                    model = ImageRequest.Builder(ctx)
                        .data(cleanUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    loading = {
                        Box(
                            modifier = Modifier.fillMaxSize().background(c.accentSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(size / 2.2f), strokeWidth = 2.dp, color = accentColor)
                        }
                    },
                    error = {
                        Image(
                            painter = painterResource(id = R.drawable.logo_circle),
                            contentDescription = name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    },
                )
            }
            else -> {
                Image(
                    painter = painterResource(id = R.drawable.logo_circle),
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

@Composable
fun StatusPill(
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            text = label,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

@Composable
fun ManagerPinModal(
    title: String,
    subtitle: String,
    busy: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onConfirm: (pin: String) -> Unit,
) {
    val c = LocalGesmakColors.current
    var pin by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        containerColor = c.card,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = c.accent, modifier = Modifier.size(20.dp))
                Text(title, color = c.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        },
        text = {
            Column {
                Text(subtitle, color = c.muted, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = pin,
                    onValueChange = { if (it.length <= 8) pin = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Code PIN Manager (4+ chiffres)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!error.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(error, color = c.rose, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(pin) },
                enabled = !busy && pin.length >= 4,
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
            ) {
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                } else {
                    Text("Valider")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !busy) {
                Text("Annuler", color = c.muted)
            }
        },
    )
}

fun parseHexColor(hex: String?, fallback: Color): Color {
    if (hex.isNullOrBlank()) return fallback
    return try {
        val clean = hex.trim().removePrefix("#")
        val value = clean.toLong(16)
        when (clean.length) {
            6 -> Color(0xFF000000 or value)
            8 -> Color(value)
            else -> fallback
        }
    } catch (_: Exception) {
        fallback
    }
}

@Suppress("UNUSED_PARAMETER")
fun unusedHelperCheck(p: SupabaseApi.Product) = Unit
