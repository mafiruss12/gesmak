package com.gesmak.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.BusinessTypes
import com.gesmak.app.data.SubscriptionPlans
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors

@Composable
fun SubscriptionLockScreen(
    establishment: SupabaseApi.Establishment,
    subState: SubscriptionPlans.SubState,
    isOwner: Boolean,
    memberName: String,
    establishments: List<EstChoice>,
    pendingPaymentRequests: List<SupabaseApi.PaymentRequestRow>,
    loading: Boolean,
    onSelectEst: (String) -> Unit,
    onCreatePaymentRequest: (
        planTier: String,
        months: Int,
        amountFcfa: Int,
        referenceCode: String,
        payerName: String,
        waveTxRef: String,
        cb: (String?) -> Unit,
    ) -> Unit,
    onRefreshStatus: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenChat: () -> Unit,
    onLogout: () -> Unit,
) {
    val c = LocalGesmakColors.current
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    var selectedTier by remember(establishment.id) {
        mutableStateOf(SubscriptionPlans.normalizeTier(establishment.planTier ?: "starter"))
    }
    var selectedMonths by remember { mutableIntStateOf(1) }
    var payerName by remember { mutableStateOf(memberName) }
    var waveTxRef by remember { mutableStateOf("") }
    var copiedToast by remember { mutableStateOf(false) }
    var localRefCode by remember { mutableStateOf(pendingPaymentRequests.firstOrNull()?.referenceCode) }
    var payBusy by remember { mutableStateOf(false) }
    var payErr by remember { mutableStateOf<String?>(null) }

    val targetPlan = SubscriptionPlans.getPlan(selectedTier)
    val totalAmount = SubscriptionPlans.priceForMonths(selectedTier, selectedMonths)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bg)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Bannière verrouillage stricte
        GesmakCard(borderColor = c.rose.copy(alpha = 0.55f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(c.rose.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = c.rose)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    StatusPill(label = subState.label.uppercase(), color = c.rose)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Abonnement requis",
                        color = c.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                    )
                    Text(
                        establishment.name,
                        color = c.muted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(subState.message, color = c.text, fontSize = 13.sp)
        }

        // Changement rapide si le propriétaire a d'autres établissements actifs
        if (isOwner && establishments.size > 1) {
            GesmakCard {
                Text(
                    "Changer d'établissement",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    establishments.forEach { est ->
                        val selected = est.id == establishment.id
                        val spec = BusinessTypes.spec(est.type)
                        FilterChip(
                            selected = selected,
                            onClick = { if (!selected) onSelectEst(est.id) },
                            label = { Text("${est.name} · ${spec.shortLabel}", maxLines = 1) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = spec.accent(c.isLight),
                                selectedLabelColor = Color.White,
                            ),
                        )
                    }
                }
            }
        }

        if (!isOwner) {
            GesmakCard {
                Text(
                    "Accès équipe suspendu",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "La période d'essai ou l'abonnement de ${establishment.name} est arrivé à expiration. " +
                        "Seul le propriétaire peut régler l'abonnement via Wave (${SubscriptionPlans.WAVE_NUMBER_DISPLAY}) " +
                        "et confirmer sur WhatsApp pour réactiver immédiatement toute l'équipe.",
                    color = c.muted,
                    fontSize = 13.sp,
                )
            }
        } else {
            val codeBadge = localRefCode ?: pendingPaymentRequests.firstOrNull()?.referenceCode
            if (!codeBadge.isNullOrBlank()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = c.accentSoft,
                    border = BorderStroke(1.dp, c.accent.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Demande enregistrée · code $codeBadge · Vérification admin en cours",
                        color = c.accentDeep,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            GesmakCard {
                Text("1. Choisir un forfait", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SubscriptionPlans.PLANS.values.forEach { p ->
                        val isSelected = selectedTier == p.id
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) c.accentSoft else c.bg,
                            border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) c.accent else c.border),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedTier = p.id },
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(p.label, color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text(
                                        "${SubscriptionPlans.formatSpaced(p.monthlyFcfa)} F/mois",
                                        color = c.accentDeep,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                    )
                                }
                                Text(p.limitsLine(), color = c.muted, fontSize = 11.sp)
                                val extras = p.extrasLine()
                                if (extras.isNotBlank()) {
                                    Text(extras, color = c.sky, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text("2. Durée", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(Modifier.height(6.dp))
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

                Spacer(Modifier.height(12.dp))
                Text(
                    "3. Paiement Wave · ${targetPlan.label} ($selectedMonths mois)",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = payerName,
                    onValueChange = { payerName = it },
                    label = { Text("Nom complet du payeur *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = waveTxRef,
                    onValueChange = { waveTxRef = it },
                    label = { Text("ID / Référence transaction Wave (optionnel)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Spacer(Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = c.accentSoft,
                    border = BorderStroke(1.dp, c.accent.copy(alpha = 0.45f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Total à régler", color = c.accentDeep, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            Text(
                                "${SubscriptionPlans.formatSpaced(totalAmount)} ${SubscriptionPlans.CURRENCY_LABEL}",
                                color = c.accentDeep,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 17.sp,
                            )
                        }
                        HorizontalDivider(color = c.accent.copy(alpha = 0.25f), modifier = Modifier.padding(vertical = 4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text("Wave uniquement", color = c.muted, fontSize = 11.sp)
                                Text(
                                    SubscriptionPlans.WAVE_NUMBER_DISPLAY,
                                    color = c.text,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 19.sp,
                                )
                            }
                            IconButton(
                                onClick = {
                                    clipboard.setText(AnnotatedString(SubscriptionPlans.WAVE_NUMBER_RAW))
                                    copiedToast = true
                                },
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copier Wave", tint = c.accentDeep)
                            }
                        }
                        if (copiedToast) {
                            Text("Numéro Wave copié !", color = c.emerald, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                if (!payErr.isNullOrBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(payErr!!, color = c.rose, fontSize = 12.sp)
                }

                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        if (payerName.isBlank()) {
                            payErr = "Indiquez votre nom complet."
                            return@Button
                        }
                        payErr = null
                        payBusy = true
                        val refCode = SubscriptionPlans.generateReferenceCode()
                        onCreatePaymentRequest(
                            selectedTier,
                            selectedMonths,
                            totalAmount,
                            refCode,
                            payerName.trim(),
                            waveTxRef.trim(),
                        ) { err ->
                            payBusy = false
                            if (err != null) {
                                payErr = err
                            }
                            localRefCode = refCode
                            val waUrl = SubscriptionPlans.buildWhatsAppUrl(
                                establishmentName = establishment.name,
                                tier = selectedTier,
                                months = selectedMonths,
                                payerName = payerName.trim(),
                                referenceCode = refCode,
                                proofNote = waveTxRef.trim().ifBlank { null },
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
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    if (payBusy) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("J'ai payé sur Wave — WhatsApp", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }

        // Bouton vérification activation + actions secondaires
        Button(
            onClick = onRefreshStatus,
            enabled = !loading,
            colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(46.dp),
        ) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                if (loading) "Vérification..." else "Vérifier l'activation",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onOpenChat,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp), tint = c.text)
                Spacer(Modifier.width(4.dp))
                Text("Chat", color = c.text, fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = onOpenNotifications,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.Default.Notifications, contentDescription = null, modifier = Modifier.size(16.dp), tint = c.text)
                Spacer(Modifier.width(4.dp))
                Text("Notifs", color = c.text, fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(16.dp), tint = c.rose)
                Spacer(Modifier.width(4.dp))
                Text("Quitter", color = c.rose, fontSize = 12.sp)
            }
        }
    }
}
