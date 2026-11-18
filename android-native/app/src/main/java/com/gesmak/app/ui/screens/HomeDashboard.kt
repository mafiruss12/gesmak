package com.gesmak.app.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.BizSpec
import com.gesmak.app.data.BusinessTypes
import com.gesmak.app.data.SubscriptionPlans
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.components.EstablishmentLogo
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr
import com.gesmak.app.ui.theme.roleLabelFr
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class EstChoice(val id: String, val name: String, val type: String? = null, val logoUrl: String? = null)

object AppRoute {
    const val HOME = 0
    const val POS = 1
    const val ORDERS = 2
    const val CLOTURE = 3
    const val INVENTORY = 4
    const val ARRIVAL = 5
    const val EXPENSES = 6
    const val TEAM = 7
    const val REPORTS = 8
    const val QR = 9
    const val SETTINGS = 10
    const val POWERS = 11
    const val TABLES = 12
    const val CRM = 13
    const val FINANCE = 14
    const val CHAT = 15
    const val NOTIFICATIONS = 16
    const val PLANNING = 17
    const val POINT_MANUEL = 18
    const val TRANSFERS = 19
    const val KITS = 20
    const val FINANCIAL_REPORTS = 21
}

@Composable
fun HomeDashboard(
    mod: Modifier = Modifier,
    member: SupabaseApi.Member?,
    memberEmail: String,
    establishment: SupabaseApi.Establishment?,
    products: List<SupabaseApi.Product>,
    orders: List<SupabaseApi.OrderRow>,
    serviceDay: SupabaseApi.ServiceDayRow?,
    serviceDayBusy: Boolean,
    caDay: Double,
    caMonth: Double,
    expensesDay: Double,
    offlinePending: Int,
    isOffline: Boolean = false,
    lastSyncedMs: Long = 0L,
    establishments: List<EstChoice>,
    currentEstId: String?,
    activePoleCode: String?,
    allowedTypes: List<BizSpec> = emptyList(),
    isPlatformAdmin: Boolean = false,
    loading: Boolean,
    error: String?,
    updateLabel: String?,
    updateBusy: Boolean,
    onSelectEst: (String) -> Unit,
    onSwitchBusinessType: (String) -> Unit = {},
    onRefresh: () -> Unit,
    onToggleServiceDay: () -> Unit,
    onNavigate: (Int) -> Unit,
    onUpdateClick: () -> Unit,
) {
    val c = LocalGesmakColors.current
    val bizSpec = BusinessTypes.spec(establishment?.type)
    val role = member?.role?.lowercase().orEmpty()
    val canSeeFinance = role in setOf("super_admin", "admin", "owner", "propriétaire", "proprietaire")
    val canManageTeam = canSeeFinance || role in setOf("manager", "gérant", "gerant")
    val lowStockProducts = products.filter { it.stock <= it.minStock }.sortedBy { it.stock }
    val pendingOrders = orders.filter { it.status == "pending" }
    val stockValue = products.sumOf { maxOf(0.0, it.stock) * maxOf(0.0, it.cost) }

    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!updateLabel.isNullOrBlank()) {
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFF065F46),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !updateBusy, onClick = onUpdateClick),
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null, tint = Color.White)
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(updateLabel, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(
                                if (updateBusy) "Téléchargement en cours..." else "Appuyer pour mettre à jour sans désinstaller",
                                color = Color(0xFFA7F3D0),
                                fontSize = 12.sp,
                            )
                        }
                        if (updateBusy) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp,
                            )
                        }
                    }
                }
            }
        }

        if (offlinePending > 0) {
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = c.accentSoft,
                    border = BorderStroke(1.dp, c.accent.copy(alpha = 0.35f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.CloudOff, contentDescription = null, tint = c.accentDeep, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "$offlinePending opération(s) en attente de synchronisation",
                            color = c.accentDeep,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "Sync",
                            color = c.accentDeep,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.clickable(onClick = onRefresh),
                        )
                    }
                }
            }
        }

        if (isOffline) {
            item {
                val syncTimeLabel = if (lastSyncedMs > 0L) {
                    " (Synchro ${SimpleDateFormat("HH:mm", Locale.FRANCE).format(Date(lastSyncedMs))})"
                } else {
                    ""
                }
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = c.accentSoft,
                    border = BorderStroke(1.dp, c.accent.copy(alpha = 0.4f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.CloudOff, contentDescription = null, tint = c.accentDeep, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Mode hors-ligne · Données locales$syncTimeLabel",
                            color = c.accentDeep,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Réessayer",
                            color = c.accentDeep,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.clickable(enabled = !loading, onClick = onRefresh),
                        )
                    }
                }
            }
        } else if (!error.isNullOrBlank()) {
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = c.rose.copy(alpha = 0.1f),
                    border = BorderStroke(1.dp, c.rose.copy(alpha = 0.3f)),
                ) {
                    Text(
                        error,
                        color = c.rose,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                    )
                }
            }
        }

        // En-tête utilisateur & site actif avec logo
        item {
            val cleanLogin = SupabaseAuth.displayLogin(memberEmail)
            GesmakCard(borderColor = c.accent.copy(alpha = 0.4f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    EstablishmentLogo(
                        name = establishment?.name ?: "GESMAK",
                        logoUrl = establishment?.logoUrl,
                        size = 50.dp,
                        cornerRadius = 14.dp,
                        accentColor = c.accent,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "ÉTABLISSEMENT ACTIF",
                            color = c.accentDeep,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                        )
                        Text(
                            text = establishment?.name ?: "Établissement",
                            color = c.text,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = "${member?.fullName?.ifBlank { cleanLogin } ?: cleanLogin} · ${roleLabelFr(member?.role)}",
                            color = c.muted,
                            fontSize = 12.sp,
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (establishment != null) {
                                StatusPill(
                                    label = bizSpec.label,
                                    color = c.accent,
                                )
                            }
                            if (!activePoleCode.isNullOrBlank()) {
                                StatusPill(
                                    label = poleLabelFr(activePoleCode),
                                    color = poleColorHex(activePoleCode),
                                )
                            }
                            if (establishment != null) {
                                val subLabel = SubscriptionPlans.getPlanDisplayTitle(establishment)
                                StatusPill(
                                    label = subLabel,
                                    color = if (SubscriptionPlans.isOnTrial(establishment)) c.sky else c.emerald,
                                )
                            }
                        }
                    }
                    IconButton(onClick = onRefresh, enabled = !loading) {
                        if (loading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = c.accent, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                        }
                    }
                }
            }
        }

        if (establishment == null && !loading && !isPlatformAdmin) {
            item {
                GesmakCard(borderColor = c.accent.copy(alpha = 0.45f)) {
                    Text(
                        "Établissement en attente d'attribution",
                        color = c.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Aucun établissement ni type d'activité ne vous a encore été attribué. Contactez l'administrateur GESMAK pour obtenir votre accès sur demande.",
                        color = c.muted,
                        fontSize = 12.sp,
                    )
                }
            }
        }

        // Bouton principal adapté au type d'activité
        item {
            Button(
                onClick = { onNavigate(AppRoute.POS) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = c.accent,
                    contentColor = Color.White,
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
            ) {
                Icon(Icons.Default.ShoppingCart, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    bizSpec.ctaText,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Sélecteur multi-sites (Propriétaire)
        if (establishments.size > 1) {
            item {
                Column {
                    Text("Mes Établissements", color = c.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        establishments.forEach { est ->
                            val selected = est.id == currentEstId
                            val spec = BusinessTypes.spec(est.type)
                            FilterChip(
                                selected = selected,
                                onClick = { onSelectEst(est.id) },
                                leadingIcon = {
                                    EstablishmentLogo(
                                        name = est.name,
                                        logoUrl = est.logoUrl,
                                        size = 20.dp,
                                        cornerRadius = 6.dp,
                                        accentColor = spec.accent(c.isLight),
                                    )
                                },
                                label = {
                                    Text(
                                        "${est.name} · ${spec.shortLabel}",
                                        maxLines = 1,
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = spec.accent(c.isLight),
                                    selectedLabelColor = Color.White,
                                    containerColor = c.card,
                                    labelColor = c.text,
                                ),
                            )
                        }
                    }
                }
            }
        }

        // Sélecteur de mode d'activité : uniquement si l'administrateur a attribué plusieurs types (+ admins)
        if (canSeeFinance && establishment != null) {
            val switchableSpecs = if (isPlatformAdmin) BusinessTypes.ALL else allowedTypes
            if (isPlatformAdmin || switchableSpecs.size > 1) {
                item {
                    Column {
                        Text(
                            "Mode d'activité attribué · ${bizSpec.label}",
                            color = c.muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            switchableSpecs.forEach { spec ->
                                val selected = spec.key == bizSpec.key
                                val chipColor = spec.accent(c.isLight)
                                FilterChip(
                                    selected = selected,
                                    onClick = { if (!selected) onSwitchBusinessType(spec.key) },
                                    label = {
                                        Text(
                                            spec.label,
                                            maxLines = 1,
                                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = chipColor,
                                        selectedLabelColor = Color.White,
                                        containerColor = c.card,
                                        labelColor = c.text,
                                    ),
                                )
                            }
                        }
                    }
                }
            } else {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = c.accentSoft,
                        border = BorderStroke(1.dp, c.accent.copy(alpha = 0.25f)),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "Activité attribuée : ${bizSpec.label}",
                                color = c.accentDeep,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = "Sur demande admin",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                        }
                    }
                }
            }
        }

        // Journée d'exploitation + 4 tuiles KPI (ExploitationDayCard)
        item {
            val isDayOpen = serviceDay?.status == "open"
            GesmakCard(
                borderColor = if (isDayOpen) c.emerald.copy(alpha = 0.35f) else c.border,
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Journée d'exploitation", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            text = if (isDayOpen) "Service ouvert aujourd'hui" else "Journée non ouverte ou clôturée",
                            color = if (isDayOpen) c.emerald else c.muted,
                            fontSize = 12.sp,
                        )
                    }
                    if (canManageTeam) {
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
                            Text(if (isDayOpen) "Clôturer" else "Ouvrir", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    KpiTile(
                        modifier = Modifier.weight(1f),
                        label = if (canSeeFinance) "Ventes du jour" else "Commandes actives",
                        value = if (canSeeFinance) formatFcfa(caDay) else "${orders.size}",
                        color = c.accent,
                    )
                    KpiTile(
                        modifier = Modifier.weight(1f),
                        label = if (canSeeFinance) "Dépenses jour" else "En attente",
                        value = if (canSeeFinance) formatFcfa(expensesDay) else "${pendingOrders.size}",
                        color = if (canSeeFinance) c.rose else c.sky,
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    KpiTile(
                        modifier = Modifier.weight(1f),
                        label = if (canSeeFinance) "CA 30 jours" else "Catalogue",
                        value = if (canSeeFinance) formatFcfa(caMonth) else "${products.size} articles",
                        color = c.emerald,
                    )
                    KpiTile(
                        modifier = Modifier.weight(1f),
                        label = if (canSeeFinance) "Valeur stock" else "Alertes stock",
                        value = if (canSeeFinance) formatFcfa(stockValue) else "${lowStockProducts.size}",
                        color = if (lowStockProducts.isNotEmpty()) c.rose else c.muted,
                    )
                }
            }
        }

        // Panneau Commandes en cours (DashboardOrdersPanel)
        item {
            GesmakCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = c.sky, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Commandes en cours", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    if (pendingOrders.isNotEmpty()) {
                        StatusPill(label = "${pendingOrders.size} nouvelle(s)", color = c.accent)
                        Spacer(Modifier.width(6.dp))
                    }
                    OutlinedButton(
                        onClick = { onNavigate(AppRoute.ORDERS) },
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Ouvrir", color = c.accent, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
                if (orders.isEmpty()) {
                    Text(
                        "Aucune commande active pour le moment.",
                        color = c.muted,
                        fontSize = 12.sp,
                    )
                } else {
                    orders.take(3).forEach { o ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigate(AppRoute.ORDERS) }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    o.tableNumber?.let { "Table $it · ${o.customerName ?: "Client"}" }
                                        ?: (o.customerName ?: "Commande #${o.id.take(6)}"),
                                    color = c.text,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                )
                                Text(
                                    when (o.status) {
                                        "pending" -> "En attente"
                                        "preparing" -> "En préparation"
                                        "ready" -> "Prête à servir"
                                        else -> o.status
                                    },
                                    color = c.muted,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(formatFcfa(o.total), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = c.muted, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }

        // Actions rapides (QuickActions)
        item {
            Column {
                Text("Actions rapides", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile(bizSpec.posLabel, bizSpec.shortLabel, Icons.Default.ShoppingCart, c.accent, Modifier.weight(1f)) {
                        onNavigate(AppRoute.POS)
                    }
                    QuickActionTile(bizSpec.ordersLabel, "${orders.size} active(s)", Icons.Default.ReceiptLong, Color(0xFF0284C7), Modifier.weight(1f)) {
                        onNavigate(AppRoute.ORDERS)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile(bizSpec.arrivalsLabel, "Entrées stock", Icons.Default.LocalShipping, Color(0xFF059669), Modifier.weight(1f)) {
                        onNavigate(AppRoute.ARRIVAL)
                    }
                    QuickActionTile("Dépenses", formatFcfa(expensesDay), Icons.Default.TrendingDown, Color(0xFFDC2626), Modifier.weight(1f)) {
                        onNavigate(AppRoute.EXPENSES)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile("Clôture Z", "Point caisse", Icons.Default.PointOfSale, Color(0xFFD97706), Modifier.weight(1f)) {
                        onNavigate(AppRoute.CLOTURE)
                    }
                    QuickActionTile(bizSpec.inventoryLabel, "${products.size} articles", Icons.Default.Inventory2, Color(0xFF0D9488), Modifier.weight(1f)) {
                        onNavigate(AppRoute.INVENTORY)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (canManageTeam) {
                        QuickActionTile("Équipe & Pôles", "Hiérarchie & PIN", Icons.Default.Groups, Color(0xFF7C3AED), Modifier.weight(1f)) {
                            onNavigate(AppRoute.TEAM)
                        }
                    } else {
                        QuickActionTile("QR Code Tables", "Menu client", Icons.Default.QrCode2, Color(0xFF4F46E5), Modifier.weight(1f)) {
                            onNavigate(AppRoute.QR)
                        }
                    }
                    if (canSeeFinance) {
                        QuickActionTile("Rapports CA", "Bilan 7j / 30j", Icons.Default.Assessment, Color(0xFF2563EB), Modifier.weight(1f)) {
                            onNavigate(AppRoute.REPORTS)
                        }
                    } else {
                        QuickActionTile("Paramètres", "Profil & MAJ", Icons.Default.Settings, Color(0xFF475569), Modifier.weight(1f)) {
                            onNavigate(AppRoute.SETTINGS)
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile("Rôles & Pouvoirs", "Mes droits & PIN", Icons.Default.Shield, Color(0xFFE11D48), Modifier.weight(1f)) {
                        onNavigate(AppRoute.POWERS)
                    }
                    QuickActionTile(bizSpec.tablesLabel, "Organisation", Icons.Default.TableRestaurant, Color(0xFF0EA5E9), Modifier.weight(1f)) {
                        onNavigate(AppRoute.TABLES)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile(
                        if (canManageTeam) "Clients & Achats" else "Clients & Fidélité",
                        if (canManageTeam) "CRM & Fournisseurs" else "Répertoire clients",
                        Icons.Default.Store,
                        Color(0xFF14B8A6),
                        Modifier.weight(1f),
                    ) {
                        onNavigate(AppRoute.CRM)
                    }
                    if (canSeeFinance) {
                        QuickActionTile("Compta & Patron", "Bilans & Audio TTS", Icons.Default.Analytics, Color(0xFF6366F1), Modifier.weight(1f)) {
                            onNavigate(AppRoute.FINANCE)
                        }
                    } else {
                        QuickActionTile("Planning & Service", "Shifts & mes tables", Icons.Default.CalendarMonth, Color(0xFF8B5CF6), Modifier.weight(1f)) {
                            onNavigate(AppRoute.PLANNING)
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickActionTile("Chat Équipe", "Groupe & Messages", Icons.Default.Chat, Color(0xFFEC4899), Modifier.weight(1f)) {
                        onNavigate(AppRoute.CHAT)
                    }
                    if (canManageTeam) {
                        QuickActionTile("Kits & Promos", "Packs & Réductions", Icons.Default.LocalOffer, Color(0xFFF59E0B), Modifier.weight(1f)) {
                            onNavigate(AppRoute.KITS)
                        }
                    } else {
                        QuickActionTile("Notifications", "Alertes & validations", Icons.Default.Notifications, Color(0xFFF59E0B), Modifier.weight(1f)) {
                            onNavigate(AppRoute.NOTIFICATIONS)
                        }
                    }
                }
                if (canSeeFinance) {
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionTile("Rapports Financiers", "Bénéfices nets & charges", Icons.Default.TrendingUp, Color(0xFF059669), Modifier.weight(1f)) {
                            onNavigate(AppRoute.FINANCIAL_REPORTS)
                        }
                        QuickActionTile("Paramètres", "Logo, Contacts & MAJ", Icons.Default.Settings, Color(0xFF475569), Modifier.weight(1f)) {
                            onNavigate(AppRoute.SETTINGS)
                        }
                    }
                }
            }
        }

        // Alertes rupture / stock bas
        if (lowStockProducts.isNotEmpty()) {
            item {
                GesmakCard(borderColor = c.rose.copy(alpha = 0.35f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.WarningAmber, contentDescription = null, tint = c.rose, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Alertes stock (${lowStockProducts.size})",
                            color = c.rose,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "Voir",
                            color = c.accent,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            modifier = Modifier.clickable { onNavigate(AppRoute.INVENTORY) },
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    lowStockProducts.take(5).forEach { p ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(p.name, color = c.text, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            Text(
                                "${p.stock.toInt()} / min ${p.minStock.toInt()}",
                                color = if (p.stock <= 0) c.rose else c.accentDeep,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun KpiTile(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    color: Color,
) {
    val c = LocalGesmakColors.current
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = c.cardAlt,
        border = BorderStroke(1.dp, c.border),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(label, color = c.muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 1)
        }
    }
}

@Composable
private fun QuickActionTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val c = LocalGesmakColors.current
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = c.card,
        border = BorderStroke(1.dp, c.border),
        shadowElevation = if (c.isLight) 1.dp else 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(tint.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = title, tint = tint, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1)
                Text(subtitle, color = c.muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
