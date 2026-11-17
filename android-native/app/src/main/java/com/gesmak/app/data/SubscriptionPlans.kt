package com.gesmak.app.data

import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ceil
import kotlin.math.max

/**
 * Offre commerciale GESMAK CI — alignée 1:1 avec src/lib/subscription.ts et src/lib/payments.ts.
 */
object SubscriptionPlans {
    const val TRIAL_DAYS = 30
    const val GRACE_DAYS = 3
    const val CURRENCY_LABEL = "F CFA"
    const val WAVE_NUMBER_DISPLAY = "05 02 01 20 11"
    const val WAVE_NUMBER_RAW = "0502012011"
    const val WHATSAPP_NUMBER_E164 = "+2250502012011"

    data class PlanInfo(
        val id: String,
        val label: String,
        val setupFcfa: Int,
        val monthlyFcfa: Int,
        val maxEstablishments: Int,
        val maxEmployees: Int,
        val maxProducts: Int,
        val qrOrdering: Boolean,
        val kitchen: Boolean,
        val multiSite: Boolean,
        val ocrAi: Boolean,
        val advancedReports: Boolean,
        val prioritySupport: Boolean,
    ) {
        fun limitsLine(): String {
            val estTxt = if (maxEstablishments <= 1) "1 site" else "$maxEstablishments sites"
            val empTxt = if (maxEmployees <= 1) "1 employé" else "$maxEmployees employés"
            val prodTxt = if (maxProducts <= 1) "1 produit max" else "$maxProducts produits max"
            return "$estTxt · $empTxt · $prodTxt"
        }

        fun extrasLine(): String = buildList {
            if (qrOrdering) add("QR")
            if (kitchen) add("Cuisine")
            if (multiSite) add("Multi-sites")
            if (ocrAi) add("IA OCR")
            if (advancedReports) add("Rapports avancés")
            if (prioritySupport) add("Support prioritaire")
        }.joinToString(" · ")
    }

    val PLANS: Map<String, PlanInfo> = linkedMapOf(
        "starter" to PlanInfo(
            id = "starter",
            label = "Essentiel",
            setupFcfa = 12_000,
            monthlyFcfa = 7_000,
            maxEstablishments = 1,
            maxEmployees = 3,
            maxProducts = 80,
            qrOrdering = false,
            kitchen = false,
            multiSite = false,
            ocrAi = false,
            advancedReports = false,
            prioritySupport = false,
        ),
        "pro" to PlanInfo(
            id = "pro",
            label = "Pro",
            setupFcfa = 30_000,
            monthlyFcfa = 15_000,
            maxEstablishments = 3,
            maxEmployees = 8,
            maxProducts = 500,
            qrOrdering = true,
            kitchen = true,
            multiSite = true,
            ocrAi = true,
            advancedReports = true,
            prioritySupport = true,
        ),
        "business" to PlanInfo(
            id = "business",
            label = "Business",
            setupFcfa = 100_000,
            monthlyFcfa = 35_000,
            maxEstablishments = 20,
            maxEmployees = 100,
            maxProducts = 5_000,
            qrOrdering = true,
            kitchen = true,
            multiSite = true,
            ocrAi = true,
            advancedReports = true,
            prioritySupport = true,
        ),
    )

    val PERIODS: List<Pair<Int, String>> = listOf(
        1 to "1 mois",
        3 to "3 mois",
        6 to "6 mois",
        12 to "1 an",
        24 to "2 ans",
        60 to "5 ans",
    )

    fun normalizeTier(raw: String?): String {
        val v = raw?.trim()?.lowercase().orEmpty()
        return when (v) {
            "pro", "professional" -> "pro"
            "business", "entreprise" -> "business"
            else -> "starter"
        }
    }

    fun getPlan(tier: String?): PlanInfo = PLANS[normalizeTier(tier)] ?: PLANS.getValue("starter")

    fun isOnTrial(est: SupabaseApi.Establishment?): Boolean {
        val s = est?.subscriptionStatus?.trim()?.lowercase().orEmpty()
        return s == "trial" || s.isBlank()
    }

    fun getEffectivePlan(est: SupabaseApi.Establishment?): PlanInfo {
        return if (isOnTrial(est)) PLANS.getValue("pro") else getPlan(est?.planTier)
    }

    fun getPlanDisplayTitle(est: SupabaseApi.Establishment?): String {
        if (est == null) return "—"
        return if (isOnTrial(est)) "Essai Pro" else getEffectivePlan(est).label
    }

    fun priceForMonths(tier: String, months: Int): Int {
        val m = months.coerceAtLeast(1)
        return getPlan(tier).monthlyFcfa * m
    }

    fun formatSpaced(amount: Int): String {
        val s = amount.toString()
        val sb = StringBuilder()
        var cnt = 0
        for (i in s.length - 1 downTo 0) {
            sb.append(s[i])
            cnt++
            if (cnt % 3 == 0 && i > 0) sb.append(' ')
        }
        return sb.reverse().toString()
    }

    data class SubState(
        val status: String,
        val blocked: Boolean,
        val label: String,
        val daysLeft: Int?,
        val message: String,
    )

    private fun parseIsoMillis(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd",
        )
        for (p in patterns) {
            try {
                val fmt = SimpleDateFormat(p, Locale.US)
                if (!p.contains("X")) fmt.timeZone = TimeZone.getTimeZone("UTC")
                val d = fmt.parse(iso.replace("+00:00", "Z").take(29))
                if (d != null) return d.time
            } catch (_: Exception) { }
        }
        return null
    }

    private fun formatDateFr(ms: Long): String =
        SimpleDateFormat("dd/MM/yyyy", Locale.FRANCE).format(Date(ms))

    fun getSubscriptionState(est: SupabaseApi.Establishment?): SubState {
        if (est == null) return SubState("trial", false, "—", null, "")
        val status = est.subscriptionStatus?.trim()?.lowercase()?.ifBlank { "trial" } ?: "trial"
        val now = System.currentTimeMillis()
        val essentialMonthly = formatSpaced(PLANS.getValue("starter").monthlyFcfa)
        val proMonthly = formatSpaced(PLANS.getValue("pro").monthlyFcfa)

        if (status == "suspended") {
            return SubState(
                status = "suspended",
                blocked = true,
                label = "Suspendu",
                daysLeft = 0,
                message = "Abonnement impayé (dès $essentialMonthly $CURRENCY_LABEL/mois). Confirmez via Wave & WhatsApp.",
            )
        }

        if (status == "active") {
            val endMs = parseIsoMillis(est.subscriptionEndsAt)
            if (endMs != null && endMs < now) {
                val graceEnd = endMs + GRACE_DAYS * 86_400_000L
                if (now <= graceEnd) {
                    val left = max(0, ceil((graceEnd - now) / 86_400_000.0).toInt())
                    return SubState(
                        status = "past_due",
                        blocked = false,
                        label = "En retard",
                        daysLeft = left,
                        message = "Paiement en retard. Régularisez sous $GRACE_DAYS jours via Wave ($WAVE_NUMBER_DISPLAY).",
                    )
                }
                return SubState(
                    status = "suspended",
                    blocked = true,
                    label = "Suspendu",
                    daysLeft = 0,
                    message = "Accès suspendu. Réglez votre forfait sur Wave $WAVE_NUMBER_DISPLAY puis confirmez sur WhatsApp.",
                )
            }
            val daysLeft = endMs?.let { max(0, ceil((it - now) / 86_400_000.0).toInt()) }
            val planLabel = getPlan(est.planTier).label
            val msg = if (daysLeft != null && endMs != null) {
                "Abonnement actif jusqu'au ${formatDateFr(endMs)} ($daysLeft j)"
            } else {
                "Abonnement actif · $planLabel"
            }
            return SubState("active", false, "Actif · $planLabel", daysLeft, msg)
        }

        if (status == "past_due") {
            return SubState(
                status = "past_due",
                blocked = false,
                label = "Paiement requis",
                daysLeft = GRACE_DAYS,
                message = "Régularisez via Wave $WAVE_NUMBER_DISPLAY (dès $essentialMonthly F/mois).",
            )
        }

        // Trial
        val trialEndMs = parseIsoMillis(est.trialEndsAt)
        if (trialEndMs != null && trialEndMs < now) {
            val graceEnd = trialEndMs + GRACE_DAYS * 86_400_000L
            if (now <= graceEnd) {
                val left = max(0, ceil((graceEnd - now) / 86_400_000.0).toInt())
                return SubState(
                    status = "past_due",
                    blocked = false,
                    label = "Essai terminé",
                    daysLeft = left,
                    message = "Essai d'1 mois terminé. Payez via Wave $WAVE_NUMBER_DISPLAY (dès $essentialMonthly F/mois).",
                )
            }
            return SubState(
                status = "suspended",
                blocked = true,
                label = "Suspendu",
                daysLeft = 0,
                message = "Essai terminé. Activez un forfait (dès $essentialMonthly F/mois) via Wave & WhatsApp.",
            )
        }

        val daysLeft = trialEndMs?.let { max(0, ceil((it - now) / 86_400_000.0).toInt()) } ?: TRIAL_DAYS
        return SubState(
            status = "trial",
            blocked = false,
            label = "Essai Pro",
            daysLeft = daysLeft,
            message = "Essai Pro — $daysLeft j restant${if (daysLeft == 1) "" else "s"}. Ensuite forfait Essentiel à $essentialMonthly F/mois (ou Pro à $proMonthly F/mois).",
        )
    }

    fun generateReferenceCode(): String {
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val sb = StringBuilder("SM-")
        repeat(6) { sb.append(alphabet.random()) }
        return sb.toString()
    }

    fun buildWhatsAppUrl(
        establishmentName: String,
        tier: String,
        months: Int,
        payerName: String?,
        referenceCode: String?,
    ): String {
        val plan = getPlan(tier)
        val amount = priceForMonths(tier, months)
        val lines = buildList {
            add("*GESMAK — Demande d'activation*")
            if (!referenceCode.isNullOrBlank()) add("Code : $referenceCode")
            add("Établissement : $establishmentName")
            add("Forfait : ${plan.label}")
            add("Durée : $months mois")
            add("Montant : ${formatSpaced(amount)} $CURRENCY_LABEL")
            if (!payerName.isNullOrBlank()) add("Payé par : $payerName")
            add("")
            add("J'ai effectué le paiement Wave sur le $WAVE_NUMBER_DISPLAY.")
            add("Merci de vérifier et d'activer mon abonnement.")
        }
        val msg = lines.joinToString("\n")
        return "https://wa.me/$WHATSAPP_NUMBER_E164?text=${URLEncoder.encode(msg, "UTF-8")}"
    }
}
