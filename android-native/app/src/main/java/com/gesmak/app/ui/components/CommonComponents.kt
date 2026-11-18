package com.gesmak.app.ui.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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

@Composable
fun PrivacyCookiesDialog(
    alreadyAccepted: Boolean,
    acceptedAt: String?,
    onAccept: (includePreferences: Boolean) -> Unit,
    onDismiss: (() -> Unit)? = null,
) {
    val c = LocalGesmakColors.current
    var checkedPolicy by remember(alreadyAccepted) { mutableStateOf(alreadyAccepted) }
    var prefCookies by remember { mutableStateOf(true) }
    var showFullText by remember(alreadyAccepted) { mutableStateOf(alreadyAccepted) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = {
            if (alreadyAccepted && onDismiss != null) onDismiss()
        },
        containerColor = c.card,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = c.accent, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Politique de confidentialité & Cookies",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .heightIn(max = 420.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "GESMAK — App créée par Akoh Ago Armand Kevin de Kevin Tech Pro (Tél : 0502012011 / 0711163661).",
                    color = c.accentDeep,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                )
                Text(
                    "Pour fonctionner (connexion sécurisée, sauvegarde hors-ligne, établissement actif et alertes commandes), GESMAK utilise des cookies techniques et du stockage local sur cet appareil.",
                    color = c.muted,
                    fontSize = 12.sp,
                )

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = c.cardAlt,
                    border = BorderStroke(1.dp, c.border),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Stockage & cookies essentiels", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text("Session, sécurité, panier, file hors-ligne.", color = c.muted, fontSize = 11.sp)
                            }
                            StatusPill(label = "Obligatoire", color = c.emerald)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Préférences & confort", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text("Thème jour/nuit, sonnerie, site actif mémorisé.", color = c.muted, fontSize = 11.sp)
                            }
                            Switch(checked = prefCookies, onCheckedChange = { prefCookies = it })
                        }
                    }
                }

                TextButton(onClick = { showFullText = !showFullText }) {
                    Text(
                        if (showFullText) "Masquer le détail complet" else "Lire la politique complète",
                        color = c.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                if (showFullText) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = c.bg,
                        border = BorderStroke(1.dp, c.border),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "1. Éditeur : Kevin Tech Pro — Akoh Ago Armand Kevin (0502012011 / 0711163661).",
                                color = c.text,
                                fontSize = 11.sp,
                            )
                            Text(
                                "2. Données collectées : identifiant, nom du propriétaire/membre, téléphone, e-mail, nom/logo/adresse/GPS volontaire de l'établissement, stocks, ventes, dépenses et rapports.",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                            Text(
                                "3. Sécurité & confidentialité : vos données sont isolées par établissement via chiffrement HTTPS et ne sont jamais vendues à des tiers.",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                            Text(
                                "4. Vos droits : vous pouvez modifier vos infos, retirer le logo ou arrêter le partage GPS à tout moment depuis Paramètres.",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            checkedPolicy = !checkedPolicy
                            if (checkedPolicy) errorMsg = null
                        },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = checkedPolicy,
                        onCheckedChange = {
                            checkedPolicy = it
                            if (it) errorMsg = null
                        },
                    )
                    Text(
                        "J'ai lu et j'accepte la politique de confidentialité et les cookies / stockage local de GESMAK.",
                        color = c.text,
                        fontSize = 12.sp,
                        modifier = Modifier.weight(1f),
                    )
                }

                if (alreadyAccepted && !acceptedAt.isNullOrBlank()) {
                    Text(
                        "Déjà acceptée ($acceptedAt)",
                        color = c.emerald,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                if (!errorMsg.isNullOrBlank()) {
                    Text(errorMsg!!, color = c.rose, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (!checkedPolicy) {
                        errorMsg = "Cochez la case ci-dessus pour accepter la politique."
                    } else {
                        onAccept(prefCookies)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
            ) {
                Text("Accepter et continuer", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                OutlinedButton(
                    onClick = {
                        if (!checkedPolicy) {
                            errorMsg = "Cochez la case ci-dessus pour accepter la politique."
                        } else {
                            onAccept(false)
                        }
                    },
                ) {
                    Text("Essentiel", color = c.text, fontSize = 11.sp)
                }
                if (alreadyAccepted && onDismiss != null) {
                    TextButton(onClick = onDismiss) {
                        Text("Fermer", color = c.muted, fontSize = 11.sp)
                    }
                }
            }
        },
    )
}
