package com.gesmak.app.data

import androidx.compose.ui.graphics.Color

data class BizSpec(
    val key: String,
    val label: String,
    val shortLabel: String,
    val ctaText: String,
    val posLabel: String,
    val ordersLabel: String,
    val inventoryLabel: String,
    val tablesLabel: String,
    val arrivalsLabel: String,
    val lightAccent: Color,
    val lightDeep: Color,
    val lightSoft: Color,
    val darkAccent: Color,
    val darkDeep: Color,
    val darkSoft: Color,
) {
    fun accent(isLight: Boolean): Color = if (isLight) lightAccent else darkAccent
    fun deep(isLight: Boolean): Color = if (isLight) lightDeep else darkDeep
    fun soft(isLight: Boolean): Color = if (isLight) lightSoft else darkSoft
}

object BusinessTypes {
    val ALL: List<BizSpec> = listOf(
        BizSpec(
            key = "maquis",
            label = "Maquis / Bar",
            shortLabel = "Maquis",
            ctaText = "Nouvelle vente · Caisse Maquis",
            posLabel = "Ma Caisse",
            ordersLabel = "Commandes & Grill",
            inventoryLabel = "Boissons & Stock",
            tablesLabel = "Espaces & Tables",
            arrivalsLabel = "Arrivages Casiers",
            lightAccent = Color(0xFFE89B2D),
            lightDeep = Color(0xFFC47A12),
            lightSoft = Color(0xFFFFF3E6),
            darkAccent = Color(0xFFF59E0B),
            darkDeep = Color(0xFFD97706),
            darkSoft = Color(0xFF2D2114),
        ),
        BizSpec(
            key = "restaurant",
            label = "Restaurant",
            shortLabel = "Restaurant",
            ctaText = "Nouvelle commande · Salle & Cuisine",
            posLabel = "Caisse Resto",
            ordersLabel = "Cuisine & Salle",
            inventoryLabel = "Stock Cuisine",
            tablesLabel = "Tables & Carte",
            arrivalsLabel = "Approvisionnement",
            lightAccent = Color(0xFFEF4444),
            lightDeep = Color(0xFFB91C1C),
            lightSoft = Color(0xFFFEE2E2),
            darkAccent = Color(0xFFF87171),
            darkDeep = Color(0xFFDC2626),
            darkSoft = Color(0xFF3B1515),
        ),
        BizSpec(
            key = "complexe",
            label = "Hôtel & Complexe",
            shortLabel = "Hôtel",
            ctaText = "Réception · Caisse & Services",
            posLabel = "Caisse Complexe",
            ordersLabel = "Services & Cuisine",
            inventoryLabel = "Stock & Chambres",
            tablesLabel = "Chambres & Pôles",
            arrivalsLabel = "Réception Stock",
            lightAccent = Color(0xFF6D28D9),
            lightDeep = Color(0xFF5B21B6),
            lightSoft = Color(0xFFEDE9FE),
            darkAccent = Color(0xFFA78BFA),
            darkDeep = Color(0xFF7C3AED),
            darkSoft = Color(0xFF261A3E),
        ),
        BizSpec(
            key = "depot",
            label = "Grossiste / Dépôt",
            shortLabel = "Dépôt",
            ctaText = "Nouvelle sortie · Dépôt Gros",
            posLabel = "Caisse Dépôt",
            ordersLabel = "Livraisons & Bons",
            inventoryLabel = "Stock Gros",
            tablesLabel = "Clients & Tournées",
            arrivalsLabel = "Entrées Palettes",
            lightAccent = Color(0xFF0EA5E9),
            lightDeep = Color(0xFF0369A1),
            lightSoft = Color(0xFFE0F2FE),
            darkAccent = Color(0xFF38BDF8),
            darkDeep = Color(0xFF0284C7),
            darkSoft = Color(0xFF0F293A),
        ),
        BizSpec(
            key = "location_event",
            label = "Location Event",
            shortLabel = "Location",
            ctaText = "Nouvelle location · Événement",
            posLabel = "Devis & Location",
            ordersLabel = "Locations en cours",
            inventoryLabel = "Parc Matériel",
            tablesLabel = "Calendrier & Packs",
            arrivalsLabel = "Retours Matériel",
            lightAccent = Color(0xFF8B5CF6),
            lightDeep = Color(0xFF6D28D9),
            lightSoft = Color(0xFFF3E8FF),
            darkAccent = Color(0xFFC084FC),
            darkDeep = Color(0xFF9333EA),
            darkSoft = Color(0xFF2B1840),
        ),
    )

    private val BY_KEY = ALL.associateBy { it.key }

    fun normalize(raw: String?): String {
        val v = raw?.trim()?.lowercase().orEmpty()
        return when (v) {
            "maquis", "bar", "cafe", "café", "pharmacie" -> "maquis"
            "restaurant", "resto", "restauration" -> "restaurant"
            "depot", "grossiste", "grossiste_depot", "grossiste_depot_de_boisson" -> "depot"
            "location_event", "location", "event", "rental" -> "location_event"
            "complexe", "complexe_hotelier", "etablissement", "établissement",
            "hotel", "hôtel", "hotelier", "hotellerie", "hôtelier",
            "residence", "résidence", "magasin", "boutique", "superette",
            "quincaillerie", "commerce", "store", "shop", "supermarche",
            "btp", "batidevis", "construction", "chantier", "devis" -> "complexe"
            else -> if (BY_KEY.containsKey(v)) v else "maquis"
        }
    }

    fun spec(raw: String?): BizSpec = BY_KEY[normalize(raw)] ?: ALL.first()

    /**
     * Retourne uniquement les types d'activité attribués par l'administrateur (+ tous pour admin/super_admin).
     * Si aucun type supplémentaire n'a été accordé sur un établissement existant, retourne uniquement son type actuel.
     */
    fun allowedSpecs(
        role: String?,
        memberAllowed: List<String> = emptyList(),
        estAllowed: List<String> = emptyList(),
        currentType: String? = null,
    ): List<BizSpec> {
        val r = role?.trim()?.lowercase().orEmpty()
        if (r == "super_admin" || r == "admin") return ALL

        val keys = linkedSetOf<String>()
        estAllowed.forEach { raw ->
            if (raw.isNotBlank()) keys.add(normalize(raw))
        }
        memberAllowed.forEach { raw ->
            if (raw.isNotBlank()) keys.add(normalize(raw))
        }
        if (!currentType.isNullOrBlank()) {
            val cur = normalize(currentType)
            if (keys.isEmpty()) return listOf(spec(cur))
            keys.add(cur)
        }
        return ALL.filter { it.key in keys }
    }
}
