package com.gesmak.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr
import com.gesmak.app.ui.theme.roleLabelFr

private data class PowerRuleRow(
    val title: String,
    val ownerDesc: String,
    val managerDesc: String,
    val cashierDesc: String,
)

private val ROLE_RULES = listOf(
    PowerRuleRow(
        title = "Périmètre des pôles",
        ownerDesc = "Tous pôles + multi-établissements",
        managerDesc = "Limité à son pôle affecté",
        cashierDesc = "Verrouillé sur sa caisse / pôle nominal",
    ),
    PowerRuleRow(
        title = "Pôles & Rôles équipe",
        ownerDesc = "Crée les pôles, nomme managers & caissières",
        managerDesc = "Affecte les caissières de son propre pôle",
        cashierDesc = "Aucun accès administration",
    ),
    PowerRuleRow(
        title = "Code PIN Manager",
        ownerDesc = "Définit et réinitialise les PINs managers",
        managerDesc = "Définit son PIN personnel et valide sur le terrain",
        cashierDesc = "Saisit le PIN manager pour débloquer une exception",
    ),
    PowerRuleRow(
        title = "Stock & Inventaire",
        ownerDesc = "Lecture & écriture complètes",
        managerDesc = "Lecture & écriture autorisées",
        cashierDesc = "Verrouillé sauf autorisation propriétaire (can_edit_stock)",
    ),
    PowerRuleRow(
        title = "Remises & Clôture Z",
        ownerDesc = "Direct sans restriction",
        managerDesc = "Direct sur son pôle + valide les écarts",
        cashierDesc = "Validation Code PIN Manager requise en cas de remise/écart",
    ),
    PowerRuleRow(
        title = "Finances, CA & Rapports",
        ownerDesc = "Accès complet (CA, marges, bilans 7j/30j)",
        managerDesc = "Dépenses et suivi opérationnel du pôle",
        cashierDesc = "Masqué (confidentialité financière)",
    ),
)

@Composable
fun PowersScreen(
    mod: Modifier = Modifier,
    currentUser: SupabaseApi.Member?,
    memberEmail: String,
    establishment: SupabaseApi.Establishment?,
    poles: List<SupabaseApi.EstablishmentPole>,
    team: List<SupabaseApi.Member>,
    audits: List<SupabaseApi.AuditRow>,
    serviceDay: SupabaseApi.ServiceDayRow?,
    serviceDayBusy: Boolean,
    cashSession: SupabaseApi.CashSessionRow?,
    activePoleCode: String?,
    onRefresh: () -> Unit,
    onToggleServiceDay: () -> Unit,
    onOpenCashSession: (openingFloat: Double, poleCode: String?, cb: (String?) -> Unit) -> Unit,
    onInitPoles: (codes: List<String>?, cb: (String?) -> Unit) -> Unit,
    onSaveSelfPin: (pin: String, cb: (String?) -> Unit) -> Unit,
    onUpdateMemberPowers: (
        memberId: String,
        targetUserId: String,
        newRole: String?,
        poleCode: String?,
        supervisorUserId: String?,
        pin: String?,
        cb: (String?) -> Unit,
    ) -> Unit,
    onToggleStatus: (memberId: String, nextStatus: String, cb: (String?) -> Unit) -> Unit,
    onToggleStockEdit: (memberId: String, allowed: Boolean, cb: (String?) -> Unit) -> Unit,
    onVerifyPin: (
        poleCode: String?,
        pin: String,
        action: String,
        reason: String,
        cb: (SupabaseApi.PinVerifyResult) -> Unit,
    ) -> Unit,
    onNavigate: (Int) -> Unit,
) {
    val c = LocalGesmakColors.current
    val roleLower = currentUser?.role?.lowercase().orEmpty()
    val isOwner = roleLower in setOf("owner", "propriétaire", "proprietaire", "admin", "super_admin")
    val isManager = roleLower in setOf("manager", "gérant", "gerant")
    val isCashierOnly = !isOwner && !isManager
    val lockedPole = if (isCashierOnly || isManager) currentUser?.assignedPoleCode else null
    val canModifyStock = isOwner || isManager || (currentUser?.canEditStock == true)

    var notice by remember { mutableStateOf<String?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    // Ouverture session caisse
    var floatInput by remember { mutableStateOf("0") }
    var sessionPoleInput by remember(lockedPole, activePoleCode) {
        mutableStateOf(lockedPole ?: activePoleCode)
    }

    // Code PIN personnel Manager/Owner
    var selfPin by remember { mutableStateOf("") }

    // Validation PIN terrain
    var pinAction by remember { mutableStateOf("pos.discount") }
    var pinPole by remember(lockedPole, activePoleCode) {
        mutableStateOf(lockedPole ?: activePoleCode)
    }
    var pinReason by remember { mutableStateOf("") }
    var pinCodeInput by remember { mutableStateOf("") }
    var pinApprovalText by remember { mutableStateOf<String?>(null) }

    // Sélection membre à configurer
    var editingMember by remember { mutableStateOf<SupabaseApi.Member?>(null) }

    val supervisorName = remember(currentUser?.supervisorUserId, team) {
        val supId = currentUser?.supervisorUserId ?: return@remember null
        val sup = team.find { it.userId == supId }
        sup?.fullName?.ifBlank { null }
            ?: sup?.email?.let { SupabaseAuth.displayLogin(it) }?.ifBlank { null }
            ?: supId.take(8)
    }

    val manageableMembers = remember(team, currentUser, isOwner, isManager, lockedPole) {
        if (isOwner) {
            team.filter { it.userId != currentUser?.userId }
        } else if (isManager) {
            team.filter { m ->
                m.userId != currentUser?.userId &&
                    m.role.lowercase() in setOf("cashier", "caissier", "caissière", "caissiere", "employee") &&
                    (lockedPole == null || m.assignedPoleCode == null || m.assignedPoleCode == lockedPole)
            }
        } else {
            emptyList()
        }
    }

    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // En-tête
        item {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Rôles & Pouvoirs", color = c.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Text(
                        "${establishment?.name ?: "Établissement"} · ${roleLabelFr(currentUser?.role)}",
                        color = c.muted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                }
            }
        }

        // Carte identité & périmètre actif
        item {
            GesmakCard(borderColor = c.accent.copy(alpha = 0.35f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = c.accent, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        val cleanMe = SupabaseAuth.displayLogin(memberEmail)
                        Text(
                            currentUser?.fullName?.ifBlank { cleanMe } ?: cleanMe,
                            color = c.text,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                        )
                        Text(
                            if (lockedPole != null) {
                                "Périmètre verrouillé : ${poleLabelFr(lockedPole)}"
                            } else {
                                "Périmètre global : Tous pôles (${poles.size})"
                            },
                            color = c.muted,
                            fontSize = 12.sp,
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    StatusPill(label = roleLabelFr(currentUser?.role), color = c.accent)
                    StatusPill(
                        label = poleLabelFr(lockedPole ?: activePoleCode),
                        color = poleColorHex(lockedPole ?: activePoleCode),
                    )
                    StatusPill(
                        label = if (canModifyStock) "Stock autorisé" else "Stock verrouillé",
                        color = if (canModifyStock) c.emerald else c.rose,
                    )
                    if (!supervisorName.isNullOrBlank()) {
                        StatusPill(label = "Sup. $supervisorName", color = c.sky)
                    }
                }
            }
        }

        if (!notice.isNullOrBlank()) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = c.emerald.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, c.emerald.copy(alpha = 0.35f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = c.emerald, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(notice!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        if (!err.isNullOrBlank()) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = c.rose.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, c.rose.copy(alpha = 0.35f)),
                ) {
                    Text(
                        err!!,
                        color = c.rose,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                    )
                }
            }
        }

        // BLOC 1 : Exécution directe (Journée, Session caisse, Raccourcis habilités)
        item {
            val isDayOpen = serviceDay?.status == "open"
            GesmakCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Exercer mes pouvoirs", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            if (isDayOpen) "Journée d'exploitation ouverte" else "Journée fermée",
                            color = if (isDayOpen) c.emerald else c.muted,
                            fontSize = 12.sp,
                        )
                    }
                    if (isOwner || isManager) {
                        Button(
                            onClick = onToggleServiceDay,
                            enabled = !serviceDayBusy,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isDayOpen) c.rose else c.emerald,
                                contentColor = Color.White,
                            ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Icon(Icons.Default.LockOpen, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(if (isDayOpen) "Clôturer jour" else "Ouvrir jour", fontSize = 12.sp)
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))
                HorizontalDivider(color = c.border)
                Spacer(Modifier.height(10.dp))

                Text(
                    if (cashSession?.status == "open") {
                        "Session caisse active : ${poleLabelFr(cashSession.poleCode)} · Fond ${formatFcfa(cashSession.openingFloat)}"
                    } else {
                        "Ouvrir ma session de caisse"
                    },
                    color = c.text,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )

                if (lockedPole == null && poles.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        FilterChip(
                            selected = sessionPoleInput == null,
                            onClick = { sessionPoleInput = null },
                            label = { Text("Général", fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = c.accent,
                                selectedLabelColor = Color.White,
                            ),
                        )
                        poles.forEach { p ->
                            FilterChip(
                                selected = sessionPoleInput == p.code,
                                onClick = { sessionPoleInput = p.code },
                                label = { Text(p.name, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = c.accent,
                                    selectedLabelColor = Color.White,
                                ),
                            )
                        }
                    }
                }

                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = floatInput,
                        onValueChange = { floatInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Fond initial (F)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            busy = true
                            notice = null
                            err = null
                            val f = floatInput.toDoubleOrNull() ?: 0.0
                            onOpenCashSession(f, lockedPole ?: sessionPoleInput) { e ->
                                busy = false
                                if (e == null) notice = "Session caisse ouverte (${formatFcfa(f)})"
                                else err = e
                            }
                        },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Icon(Icons.Default.Wallet, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Ouvrir caisse", fontSize = 12.sp)
                    }
                }

                Spacer(Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onNavigate(AppRoute.POS) }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Ma Caisse", color = c.text, fontSize = 12.sp)
                    }
                    OutlinedButton(onClick = { onNavigate(AppRoute.CLOTURE) }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.PointOfSale, contentDescription = null, tint = c.emerald, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Clôture Z", color = c.text, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { if (canModifyStock) onNavigate(AppRoute.INVENTORY) },
                        enabled = canModifyStock,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(
                            if (canModifyStock) Icons.Default.Inventory2 else Icons.Default.Lock,
                            contentDescription = null,
                            tint = if (canModifyStock) c.sky else c.muted,
                            modifier = Modifier.size(15.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(if (canModifyStock) "Gérer stock" else "Stock bloqué", color = c.text, fontSize = 12.sp)
                    }
                    if (isOwner) {
                        OutlinedButton(onClick = { onNavigate(AppRoute.REPORTS) }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.Assessment, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Rapports CA", color = c.text, fontSize = 12.sp)
                        }
                    } else if (isManager) {
                        OutlinedButton(onClick = { onNavigate(AppRoute.TEAM) }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.Groups, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Équipe", color = c.text, fontSize = 12.sp)
                        }
                    } else {
                        OutlinedButton(onClick = { onNavigate(AppRoute.ORDERS) }, modifier = Modifier.weight(1f)) {
                            Text("Commandes", color = c.text, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // BLOC 2 : Pouvoirs Propriétaire / Manager (Pôles + Mon PIN + Équipe)
        if (isOwner || isManager) {
            item {
                GesmakCard {
                    Text(
                        if (isOwner) "Pouvoirs Propriétaire : Pôles & Code PIN" else "Mon Code PIN Manager",
                        color = c.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                    Spacer(Modifier.height(6.dp))

                    if (isOwner) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text("${poles.size} pôle(s) actif(s)", color = c.muted, fontSize = 12.sp)
                            OutlinedButton(
                                onClick = {
                                    busy = true
                                    notice = null
                                    err = null
                                    onInitPoles(null) { e ->
                                        busy = false
                                        if (e == null) notice = "Pôles standards activés"
                                        else err = e
                                    }
                                },
                                enabled = !busy,
                            ) {
                                Icon(Icons.Default.Store, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Activer pôles standards", color = c.accent, fontSize = 12.sp)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedTextField(
                            value = selfPin,
                            onValueChange = { selfPin = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Mon PIN Manager (4+ ch.)") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.weight(1f),
                        )
                        Button(
                            onClick = {
                                busy = true
                                notice = null
                                err = null
                                onSaveSelfPin(selfPin) { e ->
                                    busy = false
                                    if (e == null) {
                                        selfPin = ""
                                        notice = "Code PIN personnel enregistré."
                                    } else err = e
                                }
                            },
                            enabled = !busy && selfPin.length >= 4,
                            colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Sauver PIN", fontSize = 12.sp)
                        }
                    }
                }
            }

            if (manageableMembers.isNotEmpty()) {
                item {
                    Text(
                        "Membres sous votre autorité (${manageableMembers.size})",
                        color = c.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
                items(manageableMembers, key = { it.id }) { m ->
                    GesmakCard {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    m.fullName.ifBlank { SupabaseAuth.displayLogin(m.email).ifBlank { "Membre" } },
                                    color = c.text,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                )
                                Spacer(Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    StatusPill(label = roleLabelFr(m.role), color = c.sky)
                                    StatusPill(label = poleLabelFr(m.assignedPoleCode), color = poleColorHex(m.assignedPoleCode))
                                    StatusPill(
                                        label = if (m.status == "active") "Actif" else "Suspendu",
                                        color = if (m.status == "active") c.emerald else c.rose,
                                    )
                                }
                            }
                            IconButton(onClick = { editingMember = m }) {
                                Icon(Icons.Default.Key, contentDescription = "Configurer", tint = c.accent)
                            }
                        }

                        if (isOwner) {
                            Spacer(Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Droit modifier stock (can_edit_stock)", color = c.muted, fontSize = 12.sp)
                                Switch(
                                    checked = m.canEditStock,
                                    onCheckedChange = { checked ->
                                        onToggleStockEdit(m.id, checked) { e ->
                                            if (e == null) notice = "Droit stock mis à jour" else err = e
                                        }
                                    },
                                )
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { editingMember = m }, modifier = Modifier.weight(1f)) {
                                Text("Rôle / Pôle / PIN", color = c.accent, fontSize = 12.sp)
                            }
                            OutlinedButton(
                                onClick = {
                                    val next = if (m.status == "active") "suspended" else "active"
                                    onToggleStatus(m.id, next) { e ->
                                        if (e == null) notice = "Statut modifié" else err = e
                                    }
                                },
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(
                                    if (m.status == "active") "Suspendre" else "Réactiver",
                                    color = if (m.status == "active") c.rose else c.emerald,
                                    fontSize = 12.sp,
                                )
                            }
                        }
                    }
                }
            }
        }

        // BLOC 3 : Validation par Code PIN Manager (tous rôles)
        item {
            GesmakCard {
                Text(
                    if (isCashierOnly) "Demander une validation Manager par PIN" else "Validation terrain par Code PIN",
                    color = c.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Text(
                    "Autorise une remise, une clôture avec écart ou une exception et enregistre l'opération dans l'audit.",
                    color = c.muted,
                    fontSize = 12.sp,
                )
                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "pos.discount" to "Remise caisse",
                        "cloture.z" to "Clôture Z écart",
                        "pos.approval" to "Autorisation",
                    ).forEach { (code, lbl) ->
                        FilterChip(
                            selected = pinAction == code,
                            onClick = { pinAction = code },
                            label = { Text(lbl, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = c.accent,
                                selectedLabelColor = Color.White,
                            ),
                        )
                    }
                }

                if (lockedPole == null && poles.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        FilterChip(
                            selected = pinPole == null,
                            onClick = { pinPole = null },
                            label = { Text("Tous pôles", fontSize = 11.sp) },
                        )
                        poles.forEach { p ->
                            FilterChip(
                                selected = pinPole == p.code,
                                onClick = { pinPole = p.code },
                                label = { Text(p.name, fontSize = 11.sp) },
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = pinReason,
                    onValueChange = { pinReason = it },
                    label = { Text("Motif de l'opération") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = pinCodeInput,
                        onValueChange = { pinCodeInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Code PIN Manager") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            busy = true
                            pinApprovalText = null
                            err = null
                            onVerifyPin(
                                lockedPole ?: pinPole,
                                pinCodeInput,
                                pinAction,
                                pinReason.ifBlank { "Validation depuis Rôles & Pouvoirs" },
                            ) { res ->
                                busy = false
                                if (res.ok) {
                                    pinCodeInput = ""
                                    pinReason = ""
                                    pinApprovalText = "Approuvé par ${res.approvedByName ?: "Manager"} (${roleLabelFr(res.approvedByRole)})"
                                    notice = pinApprovalText
                                } else {
                                    err = res.error ?: "PIN incorrect"
                                }
                            }
                        },
                        enabled = !busy && pinCodeInput.length >= 4,
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Valider", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (!pinApprovalText.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(pinApprovalText!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Journal d'audit (Owner / Manager)
        if ((isOwner || isManager) && audits.isNotEmpty()) {
            item {
                GesmakCard {
                    Text("Journal des validations & audits (${audits.size})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    audits.take(6).forEach { a ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${a.actorName ?: "Équipe"} · ${a.action}", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                if (!a.reason.isNullOrBlank()) {
                                    Text(a.reason, color = c.muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            Text(a.entityLabel ?: a.entityType, color = c.accent, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }

        // BLOC 4 : Règles officielles des droits par rôle
        item {
            Text("Règles officielles des droits par rôle", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
        items(ROLE_RULES) { rule ->
            GesmakCard {
                Text(rule.title, color = c.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(Modifier.height(6.dp))
                Text(
                    "• Propriétaire : ${rule.ownerDesc}",
                    color = if (isOwner) c.accent else c.muted,
                    fontWeight = if (isOwner) FontWeight.SemiBold else FontWeight.Normal,
                    fontSize = 12.sp,
                )
                Text(
                    "• Manager : ${rule.managerDesc}",
                    color = if (isManager) c.accent else c.muted,
                    fontWeight = if (isManager) FontWeight.SemiBold else FontWeight.Normal,
                    fontSize = 12.sp,
                )
                Text(
                    "• Caissière : ${rule.cashierDesc}",
                    color = if (isCashierOnly) c.accent else c.muted,
                    fontWeight = if (isCashierOnly) FontWeight.SemiBold else FontWeight.Normal,
                    fontSize = 12.sp,
                )
            }
        }

        item { Spacer(Modifier.height(12.dp)) }
    }

    // Modal configuration membre (Rôle / Pôle / Superviseur / PIN)
    editingMember?.let { target ->
        var chosenRole by remember(target.id) { mutableStateOf(target.role) }
        var chosenPole by remember(target.id) { mutableStateOf(target.assignedPoleCode ?: lockedPole) }
        var chosenSupervisor by remember(target.id) {
            mutableStateOf(target.supervisorUserId ?: currentUser?.userId)
        }
        var pinInput by remember(target.id) { mutableStateOf("") }
        val supervisors = team.filter {
            it.status == "active" && it.userId != target.userId &&
                it.role.lowercase() in setOf("owner", "propriétaire", "proprietaire", "manager", "gérant", "gerant", "admin", "super_admin")
        }

        AlertDialog(
            onDismissRequest = { editingMember = null },
            title = { Text("Pouvoirs de ${target.fullName.ifBlank { SupabaseAuth.displayLogin(target.email).ifBlank { "Membre" } }}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (isOwner) {
                        Text("Rôle :", color = c.muted, fontSize = 12.sp)
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            listOf("manager" to "Manager", "cashier" to "Caissière", "employee" to "Employé").forEach { (rCode, rLabel) ->
                                FilterChip(
                                    selected = chosenRole == rCode,
                                    onClick = { chosenRole = rCode },
                                    label = { Text(rLabel, fontSize = 11.sp) },
                                )
                            }
                        }
                    }

                    Text("Pôle affecté :", color = c.muted, fontSize = 12.sp)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (isOwner) {
                            FilterChip(
                                selected = chosenPole == null,
                                onClick = { chosenPole = null },
                                label = { Text("Tous", fontSize = 11.sp) },
                            )
                        }
                        poles.forEach { p ->
                            val allowed = isOwner || lockedPole == null || lockedPole == p.code
                            if (allowed) {
                                FilterChip(
                                    selected = chosenPole == p.code,
                                    onClick = { chosenPole = p.code },
                                    label = { Text(p.name, fontSize = 11.sp) },
                                )
                            }
                        }
                    }

                    if (isOwner && supervisors.isNotEmpty()) {
                        Text("Manager superviseur :", color = c.muted, fontSize = 12.sp)
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            supervisors.forEach { sup ->
                                FilterChip(
                                    selected = chosenSupervisor == sup.userId,
                                    onClick = { chosenSupervisor = sup.userId },
                                    label = { Text(sup.fullName.ifBlank { SupabaseAuth.displayLogin(sup.email).ifBlank { "Manager" } }, fontSize = 11.sp) },
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = { pinInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Code PIN Manager (4+ chiffres, optionnel)") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateMemberPowers(
                            target.id,
                            target.userId,
                            if (isOwner && chosenRole != target.role) chosenRole else null,
                            chosenPole,
                            chosenSupervisor,
                            pinInput.ifBlank { null },
                        ) { e ->
                            if (e == null) {
                                notice = "Pouvoirs mis à jour"
                                editingMember = null
                            } else {
                                err = e
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) {
                    Text("Enregistrer")
                }
            },
            dismissButton = {
                TextButton(onClick = { editingMember = null }) {
                    Text("Annuler")
                }
            },
        )
    }
}
