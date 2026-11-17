package com.gesmak.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.SupervisorAccount
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
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

private val STANDARD_POLE_CODES = listOf(
    "maquis" to "Maquis",
    "bar" to "Bar & Lounge",
    "restaurant" to "Restaurant",
    "piscine" to "Piscine",
    "hotel" to "Hôtel",
    "jeux" to "Jeux",
)

private val EMPLOYEE_ROLES = listOf(
    "serveur" to "Serveur",
    "cuisinier" to "Cuisinier",
    "barman" to "Barman",
    "caissier" to "Caissier",
    "videur" to "Videur",
    "manager" to "Manager",
    "autre" to "Autre",
)

@Composable
fun TeamScreen(
    mod: Modifier = Modifier,
    currentUser: SupabaseApi.Member?,
    team: List<SupabaseApi.Member>,
    poles: List<SupabaseApi.EstablishmentPole>,
    allPoles: List<SupabaseApi.EstablishmentPole>,
    employees: List<SupabaseApi.EmployeeRow>,
    todaySales: List<SupabaseApi.SaleSummaryRow>,
    todaySessions: List<SupabaseApi.CashSessionRow>,
    products: List<SupabaseApi.Product>,
    audits: List<SupabaseApi.AuditRow>,
    onRefresh: () -> Unit,
    onInitPoles: (codes: List<String>?, cb: (String?) -> Unit) -> Unit,
    onTogglePoleActive: (code: String, active: Boolean, cb: (String?) -> Unit) -> Unit,
    onCreateAccess: (
        fullName: String,
        login: String,
        password: String,
        role: String,
        poleCode: String?,
        supervisorUserId: String?,
        managerPin: String?,
        cb: (String?) -> Unit,
    ) -> Unit,
    onEditMemberFull: (
        memberId: String,
        targetUserId: String,
        fullName: String,
        newRole: String?,
        poleCode: String?,
        supervisorUserId: String?,
        managerPin: String?,
        canEditStock: Boolean,
        status: String,
        cb: (String?) -> Unit,
    ) -> Unit,
    onRemoveMember: (memberId: String, targetUserId: String, cb: (String?) -> Unit) -> Unit,
    onToggleStatus: (memberId: String, nextStatus: String) -> Unit,
    onToggleStockEdit: (memberId: String, allowed: Boolean) -> Unit,
    onSaveEmployee: (
        existingId: String?,
        name: String,
        role: String,
        phone: String?,
        salary: Double,
        status: String,
        cb: (String?) -> Unit,
    ) -> Unit,
    onDeleteEmployee: (employeeId: String, cb: (String?) -> Unit) -> Unit,
    onQuickAdjustStock: (
        product: SupabaseApi.Product,
        newStock: Double,
        newMinStock: Double,
        reason: String,
        cb: (String?) -> Unit,
    ) -> Unit,
) {
    val c = LocalGesmakColors.current
    val context = LocalContext.current
    val myRole = currentUser?.role?.lowercase().orEmpty()
    val isOwner = myRole in setOf("owner", "propriétaire", "proprietaire", "admin", "super_admin")
    val isManager = myRole in setOf("manager", "gérant", "gerant")

    var tabIndex by remember { mutableIntStateOf(0) }
    var createModalOpen by remember { mutableStateOf(false) }
    var createdCredentials by remember { mutableStateOf<List<String>?>(null) }
    var editMemberTarget by remember { mutableStateOf<SupabaseApi.Member?>(null) }
    var polesModalOpen by remember { mutableStateOf(false) }
    var confirmRemoveMember by remember { mutableStateOf<SupabaseApi.Member?>(null) }

    var empModalOpen by remember { mutableStateOf(false) }
    var editingEmp by remember { mutableStateOf<SupabaseApi.EmployeeRow?>(null) }
    var stockAdjProduct by remember { mutableStateOf<SupabaseApi.Product?>(null) }

    var notice by remember { mutableStateOf<String?>(null) }
    var err by remember { mutableStateOf<String?>(null) }

    val visibleTeam = remember(team, currentUser, isManager) {
        team.filter { m ->
            m.userId != currentUser?.userId &&
                if (isManager) m.role.lowercase() in setOf("cashier", "caissier", "caissière", "employee") else true
        }
    }
    val activeManagers = remember(team) {
        team.filter { it.role.lowercase() in setOf("manager", "gérant", "gerant") && it.status == "active" }
    }
    val managerNames = remember(team, currentUser) {
        buildMap {
            currentUser?.let { put(it.userId, it.fullName.ifBlank { SupabaseAuth.displayLogin(it.email) }) }
            team.forEach { if (it.role.lowercase() == "manager") put(it.userId, it.fullName.ifBlank { SupabaseAuth.displayLogin(it.email) }) }
        }
    }

    Column(
        modifier = mod
            .fillMaxSize()
            .background(c.bg),
    ) {
        // En-tête + boutons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Équipe, Accès & RH", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text("Comptes, rôles, fiches employés & suivi gérant", color = c.muted, fontSize = 12.sp)
            }
            if (tabIndex == 0) {
                Button(
                    onClick = { createModalOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Créer accès", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            } else if (tabIndex == 1) {
                Button(
                    onClick = { editingEmp = null; empModalOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Employé", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
            }
        }

        TabRow(selectedTabIndex = tabIndex, containerColor = c.card, contentColor = c.accent) {
            Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("Accès (${visibleTeam.size})", fontSize = 12.sp) })
            Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Fiches RH (${employees.size})", fontSize = 12.sp) })
            Tab(selected = tabIndex == 2, onClick = { tabIndex = 2 }, text = { Text("Suivi Gérant", fontSize = 12.sp) })
        }

        if (!notice.isNullOrBlank()) {
            Surface(color = c.emerald.copy(alpha = 0.14f), modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp), shape = RoundedCornerShape(10.dp)) {
                Text(notice!!, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(10.dp))
            }
        }
        if (!err.isNullOrBlank()) {
            Surface(color = c.rose.copy(alpha = 0.12f), modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp), shape = RoundedCornerShape(10.dp)) {
                Text(err!!, color = c.rose, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
            }
        }

        when (tabIndex) {
            // ================= ONGLET 1 : ACCÈS & PÔLES =================
            0 -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Shield, contentDescription = null, tint = c.accent)
                                Spacer(Modifier.width(8.dp))
                                Text("Pôles & Caisses (${poles.size})", color = c.text, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                if (isOwner) {
                                    OutlinedButton(onClick = { polesModalOpen = true }) {
                                        Icon(Icons.Default.Store, contentDescription = null, tint = c.accent, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Gérer pôles", color = c.accent, fontSize = 12.sp)
                                    }
                                }
                            }
                            if (poles.isNotEmpty()) {
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    poles.forEach { p ->
                                        StatusPill(label = p.name, color = poleColorHex(p.code))
                                    }
                                }
                            } else if (isOwner) {
                                Spacer(Modifier.height(6.dp))
                                Text("Aucun pôle activé. Touchez « Gérer pôles » pour activer Maquis, Bar, Restaurant, Piscine...", color = c.muted, fontSize = 11.sp)
                            }
                        }
                    }

                    if (visibleTeam.isEmpty()) {
                        item {
                            GesmakCard {
                                Text(
                                    if (isManager) "Aucune caissière rattachée. Appuyez sur « Créer accès » en haut."
                                    else "Aucun compte créé. Appuyez sur « Créer accès » pour ajouter un manager ou une caissière.",
                                    color = c.muted,
                                    fontSize = 13.sp,
                                )
                            }
                        }
                    }

                    items(visibleTeam, key = { it.id }) { m ->
                        val supName = m.supervisorUserId?.let { managerNames[it] }
                        val displayLogin = SupabaseAuth.displayLogin(m.email)
                        GesmakCard {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        m.fullName.ifBlank { displayLogin.ifBlank { "Membre" } },
                                        color = c.text,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                    )
                                    if (displayLogin.isNotBlank()) {
                                        Text(
                                            "ID: $displayLogin${if (supName != null) " · Sup: $supName" else ""}",
                                            color = c.muted,
                                            fontSize = 11.sp,
                                        )
                                    }
                                    Spacer(Modifier.height(5.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        StatusPill(label = roleLabelFr(m.role), color = c.sky)
                                        StatusPill(label = poleLabelFr(m.assignedPoleCode), color = poleColorHex(m.assignedPoleCode))
                                        StatusPill(
                                            label = if (m.status == "active") "Actif" else "Suspendu",
                                            color = if (m.status == "active") c.emerald else c.rose,
                                        )
                                    }
                                }
                                IconButton(onClick = { editMemberTarget = m }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier l'accès", tint = c.accent)
                                }
                            }

                            if (isOwner) {
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text("Droit modifier stock", color = c.muted, fontSize = 12.sp)
                                    Switch(
                                        checked = m.canEditStock,
                                        onCheckedChange = { checked -> onToggleStockEdit(m.id, checked) },
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    OutlinedButton(onClick = { editMemberTarget = m }, modifier = Modifier.weight(1f)) {
                                        Icon(Icons.Default.Key, contentDescription = null, tint = c.accent, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Modifier", color = c.accent, fontSize = 12.sp)
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            val next = if (m.status == "active") "suspended" else "active"
                                            onToggleStatus(m.id, next)
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Icon(
                                            if (m.status == "active") Icons.Default.Block else Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = if (m.status == "active") c.rose else c.emerald,
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Spacer(Modifier.width(4.dp))
                                        Text(
                                            if (m.status == "active") "Suspendre" else "Activer",
                                            color = if (m.status == "active") c.rose else c.emerald,
                                            fontSize = 12.sp,
                                        )
                                    }
                                    IconButton(onClick = { confirmRemoveMember = m }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Retirer", tint = c.rose)
                                    }
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }

            // ================= ONGLET 2 : FICHES EMPLOYÉS RH =================
            1 -> {
                val activeCount = employees.count { it.status == "active" }
                val totalSalaries = employees.filter { it.status == "active" }.sumOf { it.salary }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Employés actifs", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text("$activeCount / ${employees.size}", color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                            GesmakCard(modifier = Modifier.weight(1f)) {
                                Text("Masse salariale", color = c.muted, fontSize = 11.sp)
                                Spacer(Modifier.height(4.dp))
                                Text(formatFcfa(totalSalaries), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                    if (employees.isEmpty()) {
                        item {
                            GesmakCard {
                                Text("Aucune fiche employé RH. Ajoutez vos serveurs, cuisiniers, barmans ou videurs.", color = c.muted, fontSize = 13.sp)
                            }
                        }
                    }
                    items(employees, key = { it.id }) { e ->
                        GesmakCard {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(e.name, color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text("Poste : ${e.role.replaceFirstChar { ch -> ch.uppercase() }} · Salaire : ${formatFcfa(e.salary)}", color = c.muted, fontSize = 12.sp)
                                    if (!e.phone.isNullOrBlank()) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Phone, contentDescription = null, tint = c.muted, modifier = Modifier.size(12.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text(e.phone, color = c.muted, fontSize = 11.sp)
                                        }
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    StatusPill(
                                        label = if (e.status == "active") "Actif" else "Inactif",
                                        color = if (e.status == "active") c.emerald else c.rose,
                                    )
                                }
                                IconButton(onClick = { editingEmp = e; empModalOpen = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifier", tint = c.accent)
                                }
                                IconButton(onClick = {
                                    onDeleteEmployee(e.id) { er ->
                                        if (er != null) err = er else notice = "${e.name} supprimé."
                                    }
                                }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = c.rose)
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }

            // ================= ONGLET 3 : SUIVI GÉRANT =================
            else -> {
                val staffNames = remember(team, currentUser) {
                    buildMap {
                        currentUser?.let { put(it.userId, it.fullName.ifBlank { SupabaseAuth.displayLogin(it.email) }) }
                        team.forEach { put(it.userId, it.fullName.ifBlank { SupabaseAuth.displayLogin(it.email) }) }
                    }
                }
                val byPole = remember(todaySales) {
                    todaySales.groupBy { it.poleCode ?: "general" }
                }
                val byStaff = remember(todaySales) {
                    todaySales.groupBy { it.createdBy ?: "inconnu" }
                }
                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Text("Consolidation multi-caisses (Aujourd'hui)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                    if (byPole.isEmpty()) {
                        item {
                            GesmakCard { Text("Aucune vente enregistrée aujourd'hui.", color = c.muted, fontSize = 13.sp) }
                        }
                    } else {
                        byPole.entries.forEach { (pCode, list) ->
                            item(key = "pole_$pCode") {
                                val total = list.sumOf { it.total }
                                val openSess = todaySessions.firstOrNull { (it.poleCode ?: "general") == pCode }
                                GesmakCard {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        StatusPill(label = poleLabelFr(if (pCode == "general") null else pCode), color = poleColorHex(pCode))
                                        Spacer(Modifier.weight(1f))
                                        Text(formatFcfa(total), color = c.accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        "${list.size} ticket(s) · Session: ${openSess?.status ?: "aucune"}${openSess?.cashierName?.let { " · Caissière: $it" } ?: ""}",
                                        color = c.muted,
                                        fontSize = 12.sp,
                                    )
                                    if (openSess?.cashDifference != null && openSess.cashDifference != 0.0) {
                                        Text("Écart caisse : ${formatFcfa(openSess.cashDifference)}", color = c.rose, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Text("Ventes par vendeur / caissière", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                    byStaff.entries.forEach { (uid, list) ->
                        item(key = "staff_$uid") {
                            GesmakCard {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.SupervisorAccount, contentDescription = null, tint = c.sky)
                                    Spacer(Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(staffNames[uid] ?: "Caissier(ère)", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                        Text("${list.size} vente(s) aujourd'hui", color = c.muted, fontSize = 11.sp)
                                    }
                                    Text(formatFcfa(list.sumOf { it.total }), color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                        }
                    }

                    item {
                        Text("Ajustement rapide du stock", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                    items(products.take(25), key = { "adj_${it.id}" }) { p ->
                        GesmakCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(p.name, color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    Text("Stock : ${p.stock.toInt()} · Seuil min : ${p.minStock.toInt()}", color = c.muted, fontSize = 11.sp)
                                }
                                OutlinedButton(onClick = { stockAdjProduct = p }) {
                                    Text("Ajuster", color = c.accent, fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    if (audits.isNotEmpty()) {
                        item { Text("Audit des opérations (${audits.size})", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp) }
                        items(audits.take(15), key = { it.id }) { a ->
                            GesmakCard {
                                Text("${a.actorName ?: "Système"} · ${a.action}", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text("${a.entityLabel ?: a.entityType} — ${a.reason ?: "—"} (${a.createdAt.take(16).replace("T", " ")})", color = c.muted, fontSize = 11.sp)
                            }
                        }
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }

    // ============ MODAL : CRÉER UN ACCÈS (COMPLET) ============
    if (createModalOpen) {
        val assignable = if (isManager) listOf("cashier") else listOf("manager", "cashier", "employee")
        var fullName by remember { mutableStateOf("") }
        var login by remember { mutableStateOf("") }
        var password by remember { mutableStateOf(SupabaseAuth.generatePassword()) }
        var role by remember { mutableStateOf(if (isManager) "cashier" else "cashier") }
        var poleCode by remember { mutableStateOf(if (isManager) currentUser?.assignedPoleCode.orEmpty() else poles.firstOrNull()?.code.orEmpty()) }
        var supervisorId by remember { mutableStateOf(if (isManager) currentUser?.userId.orEmpty() else "") }
        var managerPin by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var formErr by remember { mutableStateOf<String?>(null) }

        val poleOpts = if (poles.isNotEmpty()) poles.map { it.code to it.name } else STANDARD_POLE_CODES

        AlertDialog(
            onDismissRequest = { if (!busy) createModalOpen = false },
            containerColor = c.card,
            title = { Text("Créer un accès équipe", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Nom complet") },
                        placeholder = { Text("Ex: Awa Koné") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(
                            value = login,
                            onValueChange = { login = it },
                            label = { Text("Identifiant / Tél") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedButton(onClick = {
                            login = SupabaseAuth.generateLogin(fullName.ifBlank { role }, role)
                            password = SupabaseAuth.generatePassword()
                        }) {
                            Text("Générer", color = c.accent, fontSize = 11.sp)
                        }
                    }
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Mot de passe (6+ car.)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("Rôle hiérarchique :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        assignable.forEach { r ->
                            FilterChip(
                                selected = role == r,
                                onClick = { role = r },
                                label = { Text(roleLabelFr(r), fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                    Text("Pôle / Caisse assignée :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (!(isManager && !currentUser?.assignedPoleCode.isNullOrBlank())) {
                            FilterChip(selected = poleCode.isBlank(), onClick = { poleCode = "" }, label = { Text("Général") })
                        }
                        poleOpts.forEach { (code, name) ->
                            val enabledChoice = !(isManager && !currentUser?.assignedPoleCode.isNullOrBlank() && currentUser?.assignedPoleCode != code)
                            if (enabledChoice) {
                                FilterChip(
                                    selected = poleCode == code,
                                    onClick = { poleCode = code },
                                    label = { Text(name, fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = poleColorHex(code), selectedLabelColor = Color.White),
                                )
                            }
                        }
                    }
                    if (role == "cashier" && !isManager && activeManagers.isNotEmpty()) {
                        Text("Manager superviseur :", color = c.muted, fontSize = 12.sp)
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = supervisorId.isBlank(), onClick = { supervisorId = "" }, label = { Text("Propriétaire") })
                            activeManagers.forEach { mgr ->
                                FilterChip(
                                    selected = supervisorId == mgr.userId,
                                    onClick = { supervisorId = mgr.userId },
                                    label = { Text(mgr.fullName.ifBlank { SupabaseAuth.displayLogin(mgr.email) }, fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.sky, selectedLabelColor = Color.White),
                                )
                            }
                        }
                    }
                    if (role == "manager") {
                        OutlinedTextField(
                            value = managerPin,
                            onValueChange = { if (it.length <= 6) managerPin = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Code PIN Manager (4-6 chiffres)") },
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (!formErr.isNullOrBlank()) Text(formErr!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (login.isBlank() || password.length < 6) {
                            formErr = "Identifiant et mot de passe (6+ caractères) requis."
                            return@Button
                        }
                        if (role == "manager" && managerPin.isNotBlank() && managerPin.length < 4) {
                            formErr = "Le PIN Manager doit contenir au moins 4 chiffres."
                            return@Button
                        }
                        busy = true
                        formErr = null
                        onCreateAccess(
                            fullName,
                            login.trim(),
                            password,
                            role,
                            poleCode.ifBlank { null },
                            if (role == "cashier") supervisorId.ifBlank { null } else null,
                            if (role == "manager") managerPin.ifBlank { null } else null,
                        ) { e ->
                            busy = false
                            if (e == null) {
                                createModalOpen = false
                                createdCredentials = listOf(
                                    roleLabelFr(role),
                                    poleLabelFr(poleCode.ifBlank { null }),
                                    login.trim(),
                                    password,
                                )
                            } else {
                                formErr = e
                            }
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "Création..." else "Créer le compte") }
            },
            dismissButton = {
                TextButton(onClick = { createModalOpen = false }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // ============ MODAL : IDENTIFIANTS CRÉÉS ============
    if (createdCredentials != null) {
        val creds = createdCredentials!!
        val summaryText = "Rôle: ${creds[0]}\nPôle: ${creds[1]}\nIdentifiant: ${creds[2]}\nMot de passe: ${creds[3]}"
        AlertDialog(
            onDismissRequest = { createdCredentials = null },
            containerColor = c.card,
            title = { Text("Accès créé avec succès", color = c.emerald, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Transmettez ces identifiants à votre collaborateur :", color = c.muted, fontSize = 12.sp)
                    GesmakCard {
                        Text("Rôle : ${creds[0]} (${creds[1]})", color = c.text, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("Identifiant : ${creds[2]}", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("Mot de passe : ${creds[3]}", color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { createdCredentials = null },
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Terminer") }
            },
            dismissButton = {
                OutlinedButton(onClick = {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("Accès GESMAK", summaryText))
                    notice = "Identifiants copiés dans le presse-papier."
                }) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Copier")
                }
            },
        )
    }

    // ============ MODAL : MODIFIER COMPLET UN MEMBRE ============
    if (editMemberTarget != null) {
        val m = editMemberTarget!!
        var fullName by remember(m.id) { mutableStateOf(m.fullName) }
        var role by remember(m.id) { mutableStateOf(m.role) }
        var pole by remember(m.id) { mutableStateOf(m.assignedPoleCode.orEmpty()) }
        var supId by remember(m.id) { mutableStateOf(m.supervisorUserId.orEmpty()) }
        var pin by remember(m.id) { mutableStateOf("") }
        var canStock by remember(m.id) { mutableStateOf(m.canEditStock) }
        var status by remember(m.id) { mutableStateOf(m.status) }
        var busy by remember { mutableStateOf(false) }
        var formErr by remember { mutableStateOf<String?>(null) }

        val poleCodes = if (poles.isNotEmpty()) poles.map { it.code to it.name } else STANDARD_POLE_CODES
        val allowedRoles = if (isOwner) listOf("manager", "cashier", "employee") else listOf(m.role)

        AlertDialog(
            onDismissRequest = { if (!busy) editMemberTarget = null },
            containerColor = c.card,
            title = { Text("Modifier · ${m.fullName.ifBlank { SupabaseAuth.displayLogin(m.email) }}", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Nom complet") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (isOwner) {
                        Text("Rôle :", color = c.muted, fontSize = 12.sp)
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            allowedRoles.forEach { r ->
                                FilterChip(
                                    selected = role.lowercase() == r,
                                    onClick = { role = r },
                                    label = { Text(roleLabelFr(r), fontSize = 12.sp) },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.sky, selectedLabelColor = Color.White),
                                )
                            }
                        }
                    }
                    Text("Pôle / Caisse :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = pole.isBlank(), onClick = { pole = "" }, label = { Text("Général") })
                        poleCodes.forEach { (code, name) ->
                            FilterChip(
                                selected = pole == code,
                                onClick = { pole = code },
                                label = { Text(name, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = poleColorHex(code), selectedLabelColor = Color.White),
                            )
                        }
                    }
                    if (isOwner && role.lowercase() == "cashier" && activeManagers.isNotEmpty()) {
                        Text("Superviseur :", color = c.muted, fontSize = 12.sp)
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = supId.isBlank(), onClick = { supId = "" }, label = { Text("Propriétaire") })
                            activeManagers.forEach { mgr ->
                                FilterChip(
                                    selected = supId == mgr.userId,
                                    onClick = { supId = mgr.userId },
                                    label = { Text(mgr.fullName.ifBlank { SupabaseAuth.displayLogin(mgr.email) }, fontSize = 11.sp) },
                                )
                            }
                        }
                    }
                    if (role.lowercase() in setOf("owner", "manager", "admin")) {
                        OutlinedTextField(
                            value = pin,
                            onValueChange = { if (it.length <= 6) pin = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Nouveau PIN Manager (laisser vide = inchangé)") },
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (isOwner) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Peut modifier le stock", color = c.text, fontSize = 13.sp)
                            Switch(checked = canStock, onCheckedChange = { canStock = it })
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Compte actif", color = c.text, fontSize = 13.sp)
                            Switch(checked = status == "active", onCheckedChange = { status = if (it) "active" else "suspended" })
                        }
                    }
                    if (!formErr.isNullOrBlank()) Text(formErr!!, color = c.rose, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (pin.isNotBlank() && pin.length < 4) {
                            formErr = "Le PIN doit faire au moins 4 chiffres."
                            return@Button
                        }
                        busy = true
                        onEditMemberFull(
                            m.id,
                            m.userId,
                            fullName.trim(),
                            if (isOwner && role != m.role) role else null,
                            pole.ifBlank { null },
                            supId.ifBlank { null },
                            pin.ifBlank { null },
                            canStock,
                            status,
                        ) { e ->
                            busy = false
                            if (e == null) {
                                notice = "Accès mis à jour pour ${fullName.ifBlank { m.fullName }}"
                                editMemberTarget = null
                            } else {
                                formErr = e
                            }
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text(if (busy) "..." else "Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { editMemberTarget = null }, enabled = !busy) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // ============ MODAL : CONFIRMER RETRAIT ============
    if (confirmRemoveMember != null) {
        val m = confirmRemoveMember!!
        AlertDialog(
            onDismissRequest = { confirmRemoveMember = null },
            containerColor = c.card,
            title = { Text("Retirer de l'établissement", color = c.rose, fontWeight = FontWeight.Bold) },
            text = { Text("Voulez-vous retirer ${m.fullName.ifBlank { SupabaseAuth.displayLogin(m.email) }} de cet établissement ?", color = c.text) },
            confirmButton = {
                Button(
                    onClick = {
                        onRemoveMember(m.id, m.userId) { e ->
                            confirmRemoveMember = null
                            if (e != null) err = e else notice = "Membre retiré."
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = c.rose, contentColor = Color.White),
                ) { Text("Retirer") }
            },
            dismissButton = {
                TextButton(onClick = { confirmRemoveMember = null }) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // ============ MODAL : GÉRER LES PÔLES INDIVIDUELLEMENT ============
    if (polesModalOpen) {
        AlertDialog(
            onDismissRequest = { polesModalOpen = false },
            containerColor = c.card,
            title = { Text("Caisses & Pôles de l'établissement", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    STANDARD_POLE_CODES.forEach { (code, label) ->
                        val existing = allPoles.find { it.code == code }
                        val isActive = existing?.isActive == true
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(label, color = c.text, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                            Switch(
                                checked = isActive,
                                onCheckedChange = { checked ->
                                    if (existing == null && checked) {
                                        onInitPoles(listOf(code)) { e -> if (e != null) err = e }
                                    } else {
                                        onTogglePoleActive(code, checked) { e -> if (e != null) err = e }
                                    }
                                },
                            )
                        }
                    }
                    HorizontalDivider(color = c.border)
                    OutlinedButton(
                        onClick = {
                            onInitPoles(STANDARD_POLE_CODES.map { it.first }) { e ->
                                if (e == null) notice = "Tous les pôles standards initialisés" else err = e
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Activer tous les pôles standards", color = c.accent, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { polesModalOpen = false }) { Text("Fermer", color = c.accent) }
            },
        )
    }

    // ============ MODAL : AJOUT / MODIF EMPLOYÉ RH ============
    if (empModalOpen) {
        var name by remember(editingEmp) { mutableStateOf(editingEmp?.name.orEmpty()) }
        var role by remember(editingEmp) { mutableStateOf(editingEmp?.role ?: "serveur") }
        var phone by remember(editingEmp) { mutableStateOf(editingEmp?.phone.orEmpty()) }
        var salary by remember(editingEmp) { mutableStateOf(editingEmp?.salary?.toLong()?.toString().orEmpty()) }
        var status by remember(editingEmp) { mutableStateOf(editingEmp?.status ?: "active") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) empModalOpen = false },
            containerColor = c.card,
            title = { Text(if (editingEmp == null) "Nouvel employé RH" else "Modifier ${editingEmp!!.name}", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom complet") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Text("Poste :", color = c.muted, fontSize = 12.sp)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        EMPLOYEE_ROLES.forEach { (k, l) ->
                            FilterChip(
                                selected = role == k,
                                onClick = { role = k },
                                label = { Text(l, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.accent, selectedLabelColor = Color.White),
                            )
                        }
                    }
                    OutlinedTextField(
                        value = salary,
                        onValueChange = { salary = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Salaire mensuel (FCFA)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Téléphone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Statut actif", color = c.text, fontSize = 13.sp)
                        Switch(checked = status == "active", onCheckedChange = { status = if (it) "active" else "inactive" })
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isBlank()) return@Button
                        busy = true
                        onSaveEmployee(editingEmp?.id, name, role, phone.ifBlank { null }, salary.toDoubleOrNull() ?: 0.0, status) { e ->
                            busy = false
                            if (e == null) {
                                empModalOpen = false
                                notice = "Fiche employé enregistrée."
                            } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { empModalOpen = false }) { Text("Annuler", color = c.muted) }
            },
        )
    }

    // ============ MODAL : AJUSTEMENT RAPIDE STOCK (SUIVI GÉRANT) ============
    if (stockAdjProduct != null) {
        val p = stockAdjProduct!!
        var newStock by remember(p.id) { mutableStateOf(p.stock.toInt().toString()) }
        var newMin by remember(p.id) { mutableStateOf(p.minStock.toInt().toString()) }
        var reason by remember(p.id) { mutableStateOf("Correction inventaire") }
        var busy by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { if (!busy) stockAdjProduct = null },
            containerColor = c.card,
            title = { Text("Ajuster · ${p.name}", color = c.text, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = newStock,
                            onValueChange = { newStock = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Nouveau stock") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = newMin,
                            onValueChange = { newMin = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Seuil min") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("Motif d'audit") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        busy = true
                        onQuickAdjustStock(p, newStock.toDoubleOrNull() ?: p.stock, newMin.toDoubleOrNull() ?: p.minStock, reason.ifBlank { "Correction" }) { e ->
                            busy = false
                            if (e == null) {
                                stockAdjProduct = null
                                notice = "Stock ajusté et audité."
                            } else err = e
                        }
                    },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                ) { Text("Valider") }
            },
            dismissButton = {
                TextButton(onClick = { stockAdjProduct = null }) { Text("Annuler", color = c.muted) }
            },
        )
    }
}
