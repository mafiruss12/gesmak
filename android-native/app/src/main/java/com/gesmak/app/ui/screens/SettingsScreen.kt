package com.gesmak.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.BuildConfig
import com.gesmak.app.R
import com.gesmak.app.data.RemoteVersion
import com.gesmak.app.data.SubscriptionPlans
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.roleLabelFr

private val BIZ_TYPES = listOf(
    "maquis" to "Maquis",
    "restaurant" to "Restaurant",
    "complexe" to "Complexe",
    "depot" to "Dépôt Boissons",
    "location_event" to "Location Event",
    "btp" to "BTP / Chantier",
)

@Composable
fun SettingsScreen(
    mod: Modifier = Modifier,
    member: SupabaseApi.Member?,
    memberEmail: String,
    establishment: SupabaseApi.Establishment?,
    pendingPaymentRequests: List<SupabaseApi.PaymentRequestRow> = emptyList(),
    isLightTheme: Boolean,
    orderSoundEnabled: Boolean,
    remoteUpdate: RemoteVersion?,
    updateChecking: Boolean,
    updateDownloading: Boolean,
    updateProgress: Int,
    updateStatusMsg: String?,
    canInstallUnknownApps: Boolean,
    onToggleTheme: (Boolean) -> Unit,
    onToggleOrderSound: (Boolean) -> Unit,
    onCheckUpdate: () -> Unit,
    onInstallUpdate: () -> Unit,
    onOpenUnknownAppsSettings: () -> Unit,
    onSaveProfile: (fullName: String, cb: (String?) -> Unit) -> Unit,
    onChangePassword: (currentPwd: String, newPwd: String, cb: (String?) -> Unit) -> Unit,
    onSaveEstablishment: (name: String, address: String, phone: String, type: String, cb: (String?) -> Unit) -> Unit,
    onCreateEstablishment: (name: String, type: String, address: String, phone: String, cb: (String?) -> Unit) -> Unit,
    onCreatePaymentRequest: (
        planTier: String,
        months: Int,
        amountFcfa: Int,
        referenceCode: String,
        payerName: String,
        cb: (String?) -> Unit,
    ) -> Unit = { _, _, _, _, _, cb -> cb(null) },
    onCaptureGps: (cb: (String?) -> Unit) -> Unit,
    onRequestPermissions: () -> Unit,
    onOpenAppSystemSettings: () -> Unit,
    onLogout: () -> Unit,
) {
    val c = LocalGesmakColors.current
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val role = member?.role?.lowercase().orEmpty()
    val canManageEst = role in setOf("super_admin", "admin", "owner", "propriétaire", "proprietaire")

    val subState = remember(establishment) { SubscriptionPlans.getSubscriptionState(establishment) }
    val activePlan = remember(establishment) { SubscriptionPlans.getEffectivePlan(establishment) }
    val onTrial = remember(establishment) { SubscriptionPlans.isOnTrial(establishment) }
    val displayTitle = remember(establishment) { SubscriptionPlans.getPlanDisplayTitle(establishment) }

    var profileModal by remember { mutableStateOf(false) }
    var passwordModal by remember { mutableStateOf(false) }
    var estModal by remember { mutableStateOf(false) }
    var newEstModal by remember { mutableStateOf(false) }
    var subModal by remember { mutableStateOf(false) }
    var aboutModal by remember { mutableStateOf(false) }
    var statusMsg by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Paramètres", color = c.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Text("Compte, sécurité, établissement & mises à jour", color = c.muted, fontSize = 12.sp)
        }

        if (!statusMsg.isNullOrBlank()) {
            item {
                Surface(shape = RoundedCornerShape(12.dp), color = c.emerald.copy(alpha = 0.12f), modifier = Modifier.fillMaxWidth()) {
                    Text(statusMsg!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(12.dp))
                }
            }
        }

        // SECTION MISE À JOUR IN-APP
        item {
            GesmakCard(borderColor = c.accent.copy(alpha = 0.45f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(c.accentSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.SystemUpdate, contentDescription = null, tint = c.accent)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Mise à jour de l'application", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            "Version installée : v${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})",
                            color = c.muted,
                            fontSize = 12.sp,
                        )
                    }
                    if (remoteUpdate != null) {
                        StatusPill(label = "v${remoteUpdate.versionName}", color = c.emerald)
                    }
                }

                Spacer(Modifier.height(10.dp))

                if (!canInstallUnknownApps) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = c.accentSoft,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                "Autorisation requise pour installer sans désinstaller",
                                color = c.accentDeep,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                            Text(
                                "Activez « Sources inconnues » pour GESMAK dans Android afin de mettre à jour en 1 clic.",
                                color = c.text,
                                fontSize = 11.sp,
                            )
                            Spacer(Modifier.height(6.dp))
                            OutlinedButton(onClick = onOpenUnknownAppsSettings) {
                                Text("Autoriser les mises à jour APK", color = c.accent, fontSize = 12.sp)
                            }
                        }
                    }
                }

                if (updateDownloading) {
                    LinearProgressIndicator(
                        progress = { (updateProgress / 100f).coerceIn(0.02f, 1f) },
                        color = c.accent,
                        trackColor = c.border,
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)),
                    )
                    Spacer(Modifier.height(6.dp))
                    Text("Téléchargement de l'APK : $updateProgress%", color = c.accentDeep, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                if (!updateStatusMsg.isNullOrBlank()) {
                    Text(updateStatusMsg, color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onCheckUpdate,
                        enabled = !updateChecking && !updateDownloading,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        if (updateChecking) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = c.accent, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = null, tint = c.accent, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Vérifier", color = c.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Button(
                        onClick = onInstallUpdate,
                        enabled = !updateDownloading && !updateChecking,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (remoteUpdate != null) c.emerald else c.accent,
                            contentColor = Color.White,
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1.4f),
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (remoteUpdate != null) "Mettre à jour" else "Télécharger dernière APK",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        // APPARENCE & NOTIFICATIONS
        item {
            GesmakCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Palette, contentDescription = null, tint = c.accent)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Mode Jour (Blanc & Orange)", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(if (isLightTheme) "Activé (identique à gesmak.vercel.app)" else "Mode sombre actif", color = c.muted, fontSize = 11.sp)
                    }
                    Switch(checked = isLightTheme, onCheckedChange = onToggleTheme)
                }
                HorizontalDivider(color = c.border, modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Notifications, contentDescription = null, tint = c.sky)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Sonnerie nouvelles commandes", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text("Alerte sonore & vibration à chaque commande", color = c.muted, fontSize = 11.sp)
                    }
                    Switch(checked = orderSoundEnabled, onCheckedChange = onToggleOrderSound)
                }
            }
        }

        // COMPTE, MOT DE PASSE, ÉTABLISSEMENT, ABONNEMENT, GPS & AUTORISATIONS
        item {
            val subSubtitle = if (establishment == null) {
                "Forfait et paiement Wave"
            } else {
                val leftStr = subState.daysLeft?.let { " · $it j restant${if (it <= 1) "" else "s"}" } ?: ""
                "$displayTitle$leftStr · Wave ${SubscriptionPlans.WAVE_NUMBER_DISPLAY}"
            }
            GesmakCard {
                SettingNavRow(
                    icon = Icons.Default.Person,
                    title = "Mon Profil",
                    subtitle = "${member?.fullName?.ifBlank { SupabaseAuth.displayLogin(memberEmail) } ?: SupabaseAuth.displayLogin(memberEmail)} · ${roleLabelFr(member?.role)}",
                    onClick = { profileModal = true },
                )
                HorizontalDivider(color = c.border)
                SettingNavRow(
                    icon = Icons.Default.Key,
                    title = "Mot de passe",
                    subtitle = "Modifier mon mot de passe de connexion",
                    onClick = { passwordModal = true },
                )
                HorizontalDivider(color = c.border)
                SettingNavRow(
                    icon = Icons.Default.Wallet,
                    title = "Abonnement & Forfait",
                    subtitle = subSubtitle,
                    onClick = { subModal = true },
                )
                if (canManageEst && establishment != null) {
                    HorizontalDivider(color = c.border)
                    SettingNavRow(
                        icon = Icons.Default.Business,
                        title = "Établissement & Activité",
                        subtitle = "${establishment.name} (${establishment.type ?: "maquis"})",
                        onClick = { estModal = true },
                    )
                    HorizontalDivider(color = c.border)
                    SettingNavRow(
                        icon = Icons.Default.Add,
                        title = "Créer un nouvel établissement",
                        subtitle = "Ajouter un 2ᵉ site / dépôt / restaurant",
                        onClick = { newEstModal = true },
                    )
                    HorizontalDivider(color = c.border)
                    SettingNavRow(
                        icon = Icons.Default.LocationOn,
                        title = "Position GPS de l'établissement",
                        subtitle = if (establishment.latitude != null) {
                            "Enregistrée (${String.format("%.4f", establishment.latitude)}, ${String.format("%.4f", establishment.longitude)})"
                        } else {
                            "Appuyer pour capturer la position GPS"
                        },
                        onClick = {
                            onCaptureGps { m -> statusMsg = m }
                        },
                    )
                }
                HorizontalDivider(color = c.border)
                SettingNavRow(
                    icon = Icons.Default.Security,
                    title = "Autorisations du téléphone",
                    subtitle = "Notifications, GPS, Caméra, Microphone",
                    onClick = onRequestPermissions,
                )
                HorizontalDivider(color = c.border)
                SettingNavRow(
                    icon = Icons.Default.Info,
                    title = "Paramètres système Android",
                    subtitle = "Gérer stockage et autorisations Android",
                    onClick = onOpenAppSystemSettings,
                )
                HorizontalDivider(color = c.border)
                SettingNavRow(
                    icon = Icons.Default.Info,
                    title = "À propos de GESMAK",
                    subtitle = "Kevin Akoh · Kevin Tech Pro",
                    onClick = { aboutModal = true },
                )
            }
        }

        // DÉCONNEXION
        item {
            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(
                    containerColor = c.rose.copy(alpha = 0.14f),
                    contentColor = c.rose,
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Se déconnecter", fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(14.dp))
        }
    }

    if (profileModal) {
        var name by remember { mutableStateOf(member?.fullName.orEmpty()) }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) profileModal = false },
            containerColor = c.card,
            title = { Text("Modifier mon profil", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom complet") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        busy = true
                        onSaveProfile(name) { err ->
                            busy = false
                            statusMsg = err ?: "Profil enregistré"
                            profileModal = false
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { profileModal = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }

    if (passwordModal) {
        var cur by remember { mutableStateOf("") }
        var nxt by remember { mutableStateOf("") }
        var cfm by remember { mutableStateOf("") }
        var err by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) passwordModal = false },
            containerColor = c.card,
            title = { Text("Changer le mot de passe", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = cur,
                        onValueChange = { cur = it },
                        label = { Text("Mot de passe actuel") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = nxt,
                        onValueChange = { nxt = it },
                        label = { Text("Nouveau mot de passe (6+ car.)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = cfm,
                        onValueChange = { cfm = it },
                        label = { Text("Confirmer le mot de passe") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (cur.isBlank()) { err = "Mot de passe actuel requis."; return@Button }
                        if (nxt.length < 6) { err = "6 caractères minimum."; return@Button }
                        if (nxt != cfm) { err = "Les mots de passe ne correspondent pas."; return@Button }
                        busy = true
                        onChangePassword(cur, nxt) { e ->
                            busy = false
                            if (e == null) {
                                statusMsg = "Mot de passe mis à jour."
                                passwordModal = false
                            } else {
                                err = e
                            }
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "..." else "Mettre à jour") }
            },
            dismissButton = {
                TextButton(onClick = { passwordModal = false }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    if (estModal && establishment != null) {
        var eName by remember { mutableStateOf(establishment.name) }
        var eAddr by remember { mutableStateOf(establishment.address.orEmpty()) }
        var ePhone by remember { mutableStateOf(establishment.phone.orEmpty()) }
        var eType by remember { mutableStateOf(establishment.type ?: "maquis") }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { if (!busy) estModal = false },
            containerColor = c.card,
            title = { Text("Établissement", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = eName, onValueChange = { eName = it }, label = { Text("Nom") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = eAddr, onValueChange = { eAddr = it }, label = { Text("Adresse") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = ePhone, onValueChange = { ePhone = it }, label = { Text("Téléphone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Text("Type d'activité :", color = c.muted, fontSize = 11.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        BIZ_TYPES.forEach { (k, l) ->
                            FilterChip(
                                selected = eType == k,
                                onClick = { eType = k },
                                label = { Text(l, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        busy = true
                        onSaveEstablishment(eName, eAddr, ePhone, eType) { err ->
                            busy = false
                            statusMsg = err ?: "Établissement mis à jour"
                            estModal = false
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { estModal = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }

    if (newEstModal) {
        var name by remember { mutableStateOf("") }
        var addr by remember { mutableStateOf("") }
        var phone by remember { mutableStateOf("") }
        var bizType by remember { mutableStateOf("maquis") }
        var err by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) newEstModal = false },
            containerColor = c.card,
            title = { Text("Nouvel établissement", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom du site") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Text("Activité :", color = c.muted, fontSize = 11.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        BIZ_TYPES.forEach { (k, l) ->
                            FilterChip(
                                selected = bizType == k,
                                onClick = { bizType = k },
                                label = { Text(l, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                    OutlinedTextField(value = addr, onValueChange = { addr = it }, label = { Text("Adresse / Ville") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Téléphone") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!err.isNullOrBlank()) Text(err!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isBlank()) { err = "Nom requis."; return@Button }
                        busy = true
                        onCreateEstablishment(name, bizType, addr, phone) { e ->
                            busy = false
                            if (e == null) {
                                statusMsg = "Établissement « $name » créé et activé."
                                newEstModal = false
                            } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "..." else "Créer") }
            },
            dismissButton = {
                TextButton(onClick = { newEstModal = false }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // ABONNEMENT COMPLET ALIGNÉ 1:1 AVEC L'APP WEB (gesmak.vercel.app)
    if (subModal) {
        var selectedTier by remember {
            mutableStateOf(
                if (establishment != null) {
                    SubscriptionPlans.normalizeTier(establishment.planTier ?: activePlan.id)
                } else {
                    "starter"
                },
            )
        }
        var selectedMonths by remember { mutableIntStateOf(1) }
        var payerName by remember { mutableStateOf(member?.fullName.orEmpty()) }
        var copiedToast by remember { mutableStateOf(false) }
        var localRefCode by remember { mutableStateOf(pendingPaymentRequests.firstOrNull()?.referenceCode) }
        var payBusy by remember { mutableStateOf(false) }
        var payErr by remember { mutableStateOf<String?>(null) }

        val targetPlan = SubscriptionPlans.getPlan(selectedTier)
        val totalAmount = SubscriptionPlans.priceForMonths(selectedTier, selectedMonths)

        AlertDialog(
            onDismissRequest = { if (!payBusy) subModal = false },
            containerColor = c.card,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Wallet, contentDescription = null, tint = c.accent, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Abonnement GESMAK", color = c.text, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // Demande en attente
                    val codeBadge = localRefCode ?: pendingPaymentRequests.firstOrNull()?.referenceCode
                    if (!codeBadge.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = c.accentSoft,
                            border = BorderStroke(1.dp, c.accent.copy(alpha = 0.45f)),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                "Demande en attente · code $codeBadge",
                                color = c.accentDeep,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(10.dp),
                            )
                        }
                    }

                    // Carte forfait actuel (comme Web)
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = c.emerald.copy(alpha = 0.10f),
                        border = BorderStroke(1.5.dp, c.emerald.copy(alpha = 0.45f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                "VOTRE FORFAIT ACTUEL",
                                color = c.emerald,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                            )
                            Text(displayTitle, color = c.text, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                            Text(establishment?.name ?: "Aucun établissement", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            if (subState.message.isNotBlank()) {
                                Text(subState.message, color = c.muted, fontSize = 11.sp)
                            }
                            Text(
                                "Limites : ${activePlan.limitsLine()}${if (onTrial) " (Pro pendant l'essai)" else ""}",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                        }
                    }

                    // 1. Choisir un forfait
                    Text("1. Choisir un forfait", color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    SubscriptionPlans.PLANS.values.forEach { p ->
                        val isSelected = selectedTier == p.id
                        val isCurrentEffective = activePlan.id == p.id && !onTrial
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) c.accentSoft else c.bg,
                            border = BorderStroke(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) c.accent else c.border,
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedTier = p.id },
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(p.label, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        if (isCurrentEffective) {
                                            StatusPill(label = "Actuel", color = c.emerald)
                                        }
                                    }
                                    Text(
                                        "${SubscriptionPlans.formatSpaced(p.monthlyFcfa)} F/mois",
                                        color = c.accentDeep,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                    )
                                }
                                Spacer(Modifier.height(2.dp))
                                Text(p.limitsLine(), color = c.muted, fontSize = 11.sp)
                                val extras = p.extrasLine()
                                if (extras.isNotBlank()) {
                                    Text(extras, color = c.sky, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                }
                                Text(
                                    "Mise en place : ${SubscriptionPlans.formatSpaced(p.setupFcfa)} F",
                                    color = c.muted,
                                    fontSize = 10.sp,
                                )
                            }
                        }
                    }

                    // 2. Durée
                    Text("2. Durée", color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        SubscriptionPlans.PERIODS.forEach { (m, label) ->
                            FilterChip(
                                selected = selectedMonths == m,
                                onClick = { selectedMonths = m },
                                label = { Text(label, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.accent,
                                    selectedLabelColor = Color.White,
                                ),
                            )
                        }
                    }

                    // 3. Paiement Wave + WhatsApp
                    Text(
                        "3. Identité & paiement · ${targetPlan.label} · $selectedMonths mois",
                        color = c.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = payerName,
                        onValueChange = { payerName = it },
                        label = { Text("Nom complet du payeur *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = c.accentSoft,
                        border = BorderStroke(1.dp, c.accent.copy(alpha = 0.45f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Total à payer", color = c.accentDeep, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text(
                                    "${SubscriptionPlans.formatSpaced(totalAmount)} ${SubscriptionPlans.CURRENCY_LABEL}",
                                    color = c.accentDeep,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 17.sp,
                                )
                            }
                            HorizontalDivider(color = c.accent.copy(alpha = 0.25f), modifier = Modifier.padding(vertical = 4.dp))
                            Text("Paiement par Wave uniquement", color = c.text, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    SubscriptionPlans.WAVE_NUMBER_DISPLAY,
                                    color = c.text,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 18.sp,
                                )
                                IconButton(
                                    onClick = {
                                        clipboard.setText(AnnotatedString(SubscriptionPlans.WAVE_NUMBER_RAW))
                                        copiedToast = true
                                    },
                                ) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = "Copier Wave", tint = c.accentDeep, modifier = Modifier.size(18.dp))
                                }
                            }
                            if (copiedToast) {
                                Text("Numéro Wave copié (${SubscriptionPlans.WAVE_NUMBER_DISPLAY})", color = c.emerald, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Text(
                                "Envoyez le montant sur Wave puis confirmez sur WhatsApp — activation après vérification.",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                        }
                    }

                    if (!payErr.isNullOrBlank()) {
                        Text(payErr!!, color = c.rose, fontSize = 12.sp)
                    }

                    Button(
                        onClick = {
                            if (establishment == null) {
                                payErr = "Choisissez un établissement avant de continuer."
                                return@Button
                            }
                            if (payerName.isBlank()) {
                                payErr = "Indiquez votre nom complet."
                                return@Button
                            }
                            payErr = null
                            payBusy = true
                            val refCode = SubscriptionPlans.generateReferenceCode()
                            onCreatePaymentRequest(selectedTier, selectedMonths, totalAmount, refCode, payerName.trim()) { _ ->
                                payBusy = false
                                localRefCode = refCode
                                val waUrl = SubscriptionPlans.buildWhatsAppUrl(
                                    establishmentName = establishment.name,
                                    tier = selectedTier,
                                    months = selectedMonths,
                                    payerName = payerName.trim(),
                                    referenceCode = refCode,
                                )
                                try {
                                    context.startActivity(
                                        Intent(Intent.ACTION_VIEW, Uri.parse(waUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                                    )
                                } catch (_: Exception) {
                                    payErr = "WhatsApp introuvable. Envoyez le code $refCode au ${SubscriptionPlans.WAVE_NUMBER_DISPLAY}."
                                }
                            }
                        },
                        enabled = !payBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) {
                        if (payBusy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("J'ai payé sur Wave — WhatsApp", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { subModal = false }, enabled = !payBusy) {
                    Text("Fermer", color = c.muted)
                }
            },
        )
    }

    if (aboutModal) {
        AlertDialog(
            onDismissRequest = { aboutModal = false },
            containerColor = c.card,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(id = R.drawable.logo_circle),
                        contentDescription = "GESMAK",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(36.dp).clip(CircleShape),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text("GESMAK Native", color = c.text, fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Gestion Simplifiée, Business Maîtrisé", color = c.accent, fontWeight = FontWeight.SemiBold)
                    Text("Version : ${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})", color = c.text, fontSize = 13.sp)
                    Text("Développé par Kevin Akoh · Kevin Tech Pro", color = c.muted, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = { aboutModal = false }) { Text("Fermer", color = c.accent) }
            },
        )
    }
}

@Composable
private fun SettingNavRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    val c = LocalGesmakColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(c.accentSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = c.accent, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = c.text, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Text(subtitle, color = c.muted, fontSize = 11.sp)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = c.muted, modifier = Modifier.size(18.dp))
    }
}
