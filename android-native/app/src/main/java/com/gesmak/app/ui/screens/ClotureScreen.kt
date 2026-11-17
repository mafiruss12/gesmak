package com.gesmak.app.ui.screens

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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.ui.components.GesmakCard
import com.gesmak.app.ui.components.ManagerPinModal
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.formatFcfa
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr
import kotlin.math.abs

@Composable
fun ClotureScreen(
    mod: Modifier = Modifier,
    poles: List<SupabaseApi.EstablishmentPole>,
    lockedPole: String?,
    activePole: String?,
    isCashierOnly: Boolean,
    session: SupabaseApi.CashSessionRow?,
    history: List<SupabaseApi.CashSessionRow>,
    salesToday: Double,
    cashSalesToday: Double,
    expensesToday: Double,
    loading: Boolean,
    saving: Boolean,
    notice: String?,
    error: String?,
    onSelectPole: (String?) -> Unit,
    onRefresh: () -> Unit,
    onOpenSession: (openingFloat: Double, poleCode: String?) -> Unit,
    onVerifyPin: (pin: String, reason: String, cb: (Boolean, String?, String?) -> Unit) -> Unit,
    onCloseSession: (
        sessionId: String,
        realCash: Double,
        expectedCash: Double,
        notes: String?,
        approvedBy: String?,
        approvedByName: String?,
    ) -> Unit,
) {
    val c = LocalGesmakColors.current
    var floatInput by remember(session?.id) {
        mutableStateOf((session?.openingFloat?.toLong() ?: 20000L).toString())
    }
    var closingCashInput by remember(session?.id) {
        mutableStateOf(session?.closingCashReal?.toLong()?.toString().orEmpty())
    }
    var notesInput by remember(session?.id) { mutableStateOf(session?.notes.orEmpty()) }
    var pinModalOpen by remember { mutableStateOf(false) }
    var pinBusy by remember { mutableStateOf(false) }
    var pinErr by remember { mutableStateOf<String?>(null) }

    val openingFloat = session?.openingFloat ?: (floatInput.toDoubleOrNull() ?: 0.0)
    val expectedCash = openingFloat + cashSalesToday - expensesToday
    val realCash = closingCashInput.toDoubleOrNull()
    val diff = if (realCash != null) realCash - expectedCash else null
    val effectivePole = lockedPole ?: activePole

    LazyColumn(
        modifier = mod
            .fillMaxSize()
            .background(c.bg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Clôture Z & Session", color = c.text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                    Text("Fond de caisse, espèces attendues & écart", color = c.muted, fontSize = 12.sp)
                }
                IconButton(onClick = onRefresh, enabled = !loading) {
                    if (loading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = c.accent, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = c.accent)
                    }
                }
            }
        }

        if (lockedPole.isNullOrBlank() && poles.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    FilterChip(
                        selected = activePole.isNullOrBlank(),
                        onClick = { onSelectPole(null) },
                        label = { Text("Générale") },
                    )
                    poles.forEach { pole ->
                        FilterChip(
                            selected = activePole == pole.code,
                            onClick = { onSelectPole(pole.code) },
                            label = { Text(pole.name) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = poleColorHex(pole.code),
                                selectedLabelColor = Color.White,
                            ),
                        )
                    }
                }
            }
        } else if (!effectivePole.isNullOrBlank()) {
            item {
                StatusPill(label = "Caisse verrouillée : ${poleLabelFr(effectivePole)}", color = poleColorHex(effectivePole))
            }
        }

        if (!notice.isNullOrBlank()) {
            item {
                Surface(shape = RoundedCornerShape(12.dp), color = c.emerald.copy(alpha = 0.12f), modifier = Modifier.fillMaxWidth()) {
                    Text(notice, color = c.emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(12.dp))
                }
            }
        }
        if (!error.isNullOrBlank()) {
            item {
                Surface(shape = RoundedCornerShape(12.dp), color = c.rose.copy(alpha = 0.12f), modifier = Modifier.fillMaxWidth()) {
                    Text(error, color = c.rose, fontSize = 12.sp, modifier = Modifier.padding(12.dp))
                }
            }
        }

        // Récapitulatif calculs du jour
        item {
            GesmakCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.PointOfSale, contentDescription = null, tint = c.accent, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Calcul de caisse du jour", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    StatusPill(
                        label = when (session?.status) {
                            "open" -> "Ouverte"
                            "closed" -> "Clôturée"
                            else -> "Non ouverte"
                        },
                        color = when (session?.status) {
                            "open" -> c.emerald
                            "closed" -> c.muted
                            else -> c.accent
                        },
                    )
                }
                Spacer(Modifier.height(10.dp))
                RowLine("Fond de caisse", formatFcfa(openingFloat), c.text)
                RowLine("Ventes totales du jour", formatFcfa(salesToday), c.sky)
                RowLine("+ Ventes espèces", formatFcfa(cashSalesToday), c.emerald)
                RowLine("− Dépenses du jour", formatFcfa(expensesToday), c.rose)
                Spacer(Modifier.height(6.dp))
                RowLine("= Espèces attendues", formatFcfa(expectedCash), c.accent, bold = true)
            }
        }

        // Action Ouvrir ou Clôturer
        item {
            GesmakCard {
                if (session == null) {
                    Text("Ouvrir la session de caisse", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = floatInput,
                        onValueChange = { floatInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Fond de caisse d'ouverture (FCFA)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { onOpenSession(floatInput.toDoubleOrNull() ?: 0.0, effectivePole) },
                        enabled = !saving,
                        colors = ButtonDefaults.buttonColors(containerColor = c.emerald, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) {
                        Icon(Icons.Default.LockOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Ouvrir ma session", fontWeight = FontWeight.Bold)
                    }
                } else if (session.status == "open") {
                    Text("Clôture Z (Comptage réel)", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = closingCashInput,
                        onValueChange = { closingCashInput = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Espèces réellement comptées (FCFA)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (diff != null) {
                        Spacer(Modifier.height(6.dp))
                        val diffColor = when {
                            abs(diff) < 1.0 -> c.emerald
                            diff > 0 -> c.sky
                            else -> c.rose
                        }
                        Text(
                            "Écart constaté : ${if (diff >= 0) "+" else ""}${formatFcfa(diff)}",
                            color = diffColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                        if (isCashierOnly && abs(diff) >= 1.0) {
                            Text(
                                "Un écart sur caisse caissière nécessite la validation par code PIN Manager.",
                                color = c.accentDeep,
                                fontSize = 11.sp,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = notesInput,
                        onValueChange = { notesInput = it },
                        label = { Text("Commentaire / Justification") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = {
                            val r = closingCashInput.toDoubleOrNull() ?: return@Button
                            val d = r - expectedCash
                            if (isCashierOnly && abs(d) >= 1.0) {
                                pinErr = null
                                pinModalOpen = true
                            } else {
                                onCloseSession(session.id, r, expectedCash, notesInput.ifBlank { null }, null, null)
                            }
                        },
                        enabled = !saving && realCash != null,
                        colors = ButtonDefaults.buttonColors(containerColor = c.accent, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Enregistrer la Clôture Z", fontWeight = FontWeight.Bold)
                    }
                } else {
                    Text("Session du jour déjà clôturée", color = c.emerald, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.height(6.dp))
                    RowLine("Espèces comptées", formatFcfa(session.closingCashReal ?: 0.0), c.text)
                    RowLine("Écart", formatFcfa(session.cashDifference ?: 0.0), if ((session.cashDifference ?: 0.0) < 0) c.rose else c.emerald)
                    if (!session.approvedByName.isNullOrBlank()) {
                        Text("Approuvé par : ${session.approvedByName}", color = c.muted, fontSize = 12.sp)
                    }
                }
            }
        }

        if (history.isNotEmpty()) {
            item {
                Text("Historique des clôtures Z", color = c.text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
            items(history.take(10), key = { it.id }) { h ->
                GesmakCard {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "${h.sessionDate} · ${poleLabelFr(h.poleCode)}",
                                color = c.text,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                            )
                            Text(
                                "${h.cashierName ?: "Caissière"} · Ventes: ${formatFcfa(h.totalSales ?: 0.0)}",
                                color = c.muted,
                                fontSize = 11.sp,
                            )
                        }
                        val d = h.cashDifference ?: 0.0
                        StatusPill(
                            label = if (h.status == "open") "Ouverte" else "Écart ${formatFcfa(d)}",
                            color = if (h.status == "open") c.sky else if (abs(d) < 1.0) c.emerald else c.rose,
                        )
                    }
                }
            }
        }
    }

    if (pinModalOpen && session != null && realCash != null) {
        ManagerPinModal(
            title = "Validation Clôture Z",
            subtitle = "Écart de ${formatFcfa(realCash - expectedCash)}. Saisissez le code PIN du manager de pôle.",
            busy = pinBusy,
            error = pinErr,
            onDismiss = { pinModalOpen = false },
            onConfirm = { pin ->
                pinBusy = true
                pinErr = null
                onVerifyPin(pin, "Clôture Z avec écart ${formatFcfa(realCash - expectedCash)}") { ok, mgrId, err ->
                    pinBusy = false
                    if (ok) {
                        pinModalOpen = false
                        onCloseSession(session.id, realCash, expectedCash, notesInput.ifBlank { null }, mgrId, "Manager PIN")
                    } else {
                        pinErr = err ?: "PIN incorrect"
                    }
                }
            },
        )
    }
}

@Composable
private fun RowLine(label: String, value: String, valueColor: Color, bold: Boolean = false) {
    val c = LocalGesmakColors.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = if (bold) c.text else c.muted, fontSize = if (bold) 14.sp else 13.sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
        Text(value, color = valueColor, fontSize = if (bold) 15.sp else 13.sp, fontWeight = FontWeight.Bold)
    }
}
