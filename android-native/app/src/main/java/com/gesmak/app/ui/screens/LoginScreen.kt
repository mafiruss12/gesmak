package com.gesmak.app.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.BuildConfig
import com.gesmak.app.R
import com.gesmak.app.ui.theme.LocalGesmakColors
import kotlinx.coroutines.delay

private val HIGHLIGHTS = listOf(
    "Stock sous contrôle" to "Suivez chaque produit, casier et arrivage sans perte invisible.",
    "Caisse & Clôture Z" to "Point du soir en quelques secondes : espèces, Mobile Money et écarts.",
    "Hiérarchie multi-pôles" to "Propriétaire → Manager de pôle → Caissière avec code PIN terrain.",
    "Marche hors ligne" to "L'app mobile enregistre les ventes ; dès que internet revient, tout se synchronise.",
)

private val MARQUEE_ITEMS = listOf(
    "GESMAK — Gestion simplifiée, business maîtrisé",
    "Zéro perte de stock invisible · Caisse multi-pôles · Clôture Z",
    "App créée par Akoh Ago Armand Kevin · Kevin Tech Pro",
)

@Composable
fun LoginScreen(
    authConfigured: Boolean,
    isLightTheme: Boolean,
    onToggleTheme: () -> Unit,
    onLogin: (login: String, password: String, onResult: (String?) -> Unit) -> Unit,
    onForgotPassword: (login: String, onResult: (String?) -> Unit) -> Unit,
) {
    val c = LocalGesmakColors.current
    var login by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    var highlightIdx by remember { mutableIntStateOf(0) }
    var marqueeIdx by remember { mutableIntStateOf(0) }

    var forgotOpen by remember { mutableStateOf(false) }
    var forgotInput by remember { mutableStateOf("") }
    var forgotBusy by remember { mutableStateOf(false) }
    var forgotMsg by remember { mutableStateOf<String?>(null) }
    var forgotErr by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(4200)
            highlightIdx = (highlightIdx + 1) % HIGHLIGHTS.size
            marqueeIdx = (marqueeIdx + 1) % MARQUEE_ITEMS.size
        }
    }

    val inf = rememberInfiniteTransition(label = "authLogo")
    val spin by inf.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(4200, easing = LinearEasing), RepeatMode.Restart),
        label = "ringSpin",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bg)
            .systemBarsPadding(),
    ) {
        // Bandeau d'annonce Orange comme AdMarquee sur gesmak.vercel.app
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(Color(0xFFFF7900), Color(0xFFF59E0B), Color(0xFFE56A00)),
                    ),
                )
                .padding(horizontal = 14.dp, vertical = 7.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = MARQUEE_ITEMS[marqueeIdx],
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onToggleTheme) {
                    Text(
                        text = if (isLightTheme) "🌙 Mode sombre" else "☀️ Mode jour",
                        color = c.muted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            // Logo circulaire animé
            Box(
                modifier = Modifier.size(96.dp),
                contentAlignment = Alignment.Center,
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    rotate(spin) {
                        drawArc(
                            brush = Brush.sweepGradient(
                                listOf(Color(0xFF2563EB), Color(0xFFFF7900), Color.Transparent),
                            ),
                            startAngle = 0f,
                            sweepAngle = 240f,
                            useCenter = false,
                            style = Stroke(width = 5f, cap = StrokeCap.Round),
                        )
                    }
                }
                Image(
                    painter = painterResource(id = R.drawable.logo_circle),
                    contentDescription = "GESMAK",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .border(2.dp, c.accent.copy(alpha = 0.3f), CircleShape),
                )
            }

            Spacer(Modifier.height(10.dp))

            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = Color(0xFF2563EB), fontWeight = FontWeight.Black)) {
                        append("GES")
                    }
                    withStyle(SpanStyle(color = c.accent, fontWeight = FontWeight.Black)) {
                        append("MAK")
                    }
                },
                fontSize = 28.sp,
                letterSpacing = 1.sp,
            )
            Text(
                text = "Gestion Simplifiée · Business Maîtrisé",
                color = c.muted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(12.dp))

            // Carte highlight animée (style web AuthPage)
            val (hlTitle, hlBody) = HIGHLIGHTS[highlightIdx]
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = c.accentSoft,
                border = BorderStroke(1.dp, c.accent.copy(alpha = 0.25f)),
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(hlTitle, color = c.accentDeep, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(Modifier.height(2.dp))
                    Text(hlBody, color = c.text.copy(alpha = 0.8f), fontSize = 12.sp, lineHeight = 16.sp)
                }
            }

            Spacer(Modifier.height(16.dp))

            // Carte connexion
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(22.dp),
                color = c.card,
                border = BorderStroke(1.dp, c.border),
                shadowElevation = if (c.isLight) 2.dp else 0.dp,
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        "Connexion à votre espace",
                        color = c.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                    )
                    Text(
                        "Utilisez votre numéro de téléphone, identifiant ou e-mail",
                        color = c.muted,
                        fontSize = 12.sp,
                    )
                    Spacer(Modifier.height(14.dp))

                    val fieldColors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = c.accent,
                        unfocusedBorderColor = c.border,
                        focusedLabelColor = c.accent,
                        unfocusedLabelColor = c.muted,
                        focusedTextColor = c.text,
                        unfocusedTextColor = c.text,
                        cursorColor = c.accent,
                    )

                    OutlinedTextField(
                        value = login,
                        onValueChange = { login = it; error = null },
                        label = { Text("Téléphone, identifiant ou e-mail") },
                        placeholder = { Text("Ex: 0700000000 ou nom@email.com") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = c.muted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next,
                        ),
                        colors = fieldColors,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = { Text("Mot de passe") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = c.muted) },
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = "Afficher",
                                    tint = c.muted,
                                )
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        colors = fieldColors,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(
                            onClick = {
                                forgotInput = login
                                forgotErr = null
                                forgotMsg = null
                                forgotOpen = true
                            },
                        ) {
                            Text("Mot de passe oublié ?", color = c.accent, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }

                    if (!authConfigured) {
                        Text(
                            "Configuration serveur manquante dans ce build.",
                            color = c.rose,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    if (!error.isNullOrBlank()) {
                        Surface(
                            color = c.rose.copy(alpha = 0.10f),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, c.rose.copy(alpha = 0.3f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp),
                        ) {
                            Text(
                                text = error!!,
                                color = c.rose,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(10.dp),
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (login.isBlank() || password.isBlank()) {
                                error = "Identifiant et mot de passe requis"
                                return@Button
                            }
                            busy = true
                            error = null
                            onLogin(login, password) { err ->
                                busy = false
                                error = err
                            }
                        },
                        enabled = !busy && authConfigured,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = c.accent,
                            contentColor = Color.White,
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                    ) {
                        if (busy) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text("Se connecter", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Footer Kevin Tech Pro
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.kevin_tech_pro_logo),
                    contentDescription = "Kevin Tech Pro",
                    modifier = Modifier
                        .size(22.dp)
                        .clip(CircleShape),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "App créée par Akoh Ago Armand Kevin · Kevin Tech Pro · v${BuildConfig.VERSION_NAME}",
                    color = c.muted,
                    fontSize = 11.sp,
                )
            }
        }
    }

    if (forgotOpen) {
        AlertDialog(
            onDismissRequest = { if (!forgotBusy) forgotOpen = false },
            containerColor = c.card,
            title = { Text("Mot de passe oublié", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        "Entrez l'adresse e-mail associée à votre compte pour recevoir le lien de réinitialisation.",
                        color = c.muted,
                        fontSize = 13.sp,
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = forgotInput,
                        onValueChange = { forgotInput = it; forgotErr = null },
                        label = { Text("Adresse e-mail") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!forgotErr.isNullOrBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(forgotErr!!, color = c.rose, fontSize = 12.sp)
                    }
                    if (!forgotMsg.isNullOrBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(forgotMsg!!, color = c.emerald, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        forgotBusy = true
                        forgotErr = null
                        forgotMsg = null
                        onForgotPassword(forgotInput) { err ->
                            forgotBusy = false
                            if (err == null) {
                                forgotMsg = "E-mail de réinitialisation envoyé si le compte existe."
                            } else {
                                forgotErr = err
                            }
                        }
                    },
                    enabled = !forgotBusy && forgotInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) {
                    if (forgotBusy) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                    } else {
                        Text("Envoyer")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { forgotOpen = false }, enabled = !forgotBusy) {
                    Text("Fermer", color = c.muted)
                }
            },
        )
    }
}
