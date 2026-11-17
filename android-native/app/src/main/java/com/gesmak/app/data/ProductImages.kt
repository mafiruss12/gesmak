package com.gesmak.app.data

import java.text.Normalizer

/**
 * Photos officielles vérifiées par boisson & format (Solibra CI, Brassivoire CI, GIG CI, Sokaf, OpenFoodFacts).
 * Aligné 1:1 avec src/lib/productImages.ts sur gesmak.vercel.app.
 */
object ProductImages {
    private object V {
        // Beaufort
        const val BEAUFORT_25 = "https://solibrachezvous.com/wp-content/uploads/2020/04/carton-beaufort-430x430.jpg"
        const val BEAUFORT_33 = "https://solibrachezvous.com/wp-content/uploads/2020/04/c33beaufort50cl_vc-430x430.jpg"
        const val BEAUFORT_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/c50beaufort50cl_vc-430x430.jpg"
        const val BEAUFORT_CAN = "https://solibrachezvous.com/wp-content/uploads/2023/01/beaufort-33-canette-430x430.jpg"
        // Bock
        const val BOCK_25 = "https://solibrachezvous.com/wp-content/uploads/2020/04/bock33cl-430x430.jpg"
        const val BOCK_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/bock50cl-430x430.jpg"
        const val BOCK_65 = "https://solibrachezvous.com/wp-content/uploads/2020/04/bock65cl-430x430.jpg"
        const val BOCK_100 = "https://solibrachezvous.com/wp-content/uploads/2020/04/bock100cl-430x430.jpg"
        const val BOCK_CAN = "https://solibrachezvous.com/wp-content/uploads/2020/04/bock50cl-24-430x430.jpg"
        // Castel
        const val CASTEL_33 = "https://solibrachezvous.com/wp-content/uploads/2020/04/castell33-430x430.jpg"
        const val CASTEL_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/castel50cl-nouveau1-430x430.jpg"
        // Flag, Booster Tequila, Racine, Dopel
        const val FLAG = "https://images.openfoodfacts.org/images/products/611/104/500/0222/front_fr.15.200.jpg"
        const val BOOSTER_TEQUILA = "https://solibrachezvous.com/wp-content/uploads/2020/04/tequila-30cl-cassier-1-768x768-1-430x430.jpg"
        const val RACINE_33 = "https://solibrachezvous.com/wp-content/uploads/2022/04/racine33cl-430x430.jpg"
        const val RACINE_50 = "https://solibrachezvous.com/wp-content/uploads/2021/05/booster-racine-430x430.jpg"
        const val RACINE_CAN = "https://solibrachezvous.com/wp-content/uploads/2023/01/racine33canette-430x430.jpg"
        const val RACINE_FORT = "https://solibrachezvous.com/wp-content/uploads/2023/07/racines-fort-430x430.jpg"
        const val DOPEL_33 = "https://solibrachezvous.com/wp-content/uploads/2021/03/doppel33cl_vc-430x430.jpg"
        const val DOPEL_50 = "https://solibrachezvous.com/wp-content/uploads/2021/03/doppel65cl_vc-430x430.jpg"
        const val DOPEL_ENERGIE = "https://solibrachezvous.com/wp-content/uploads/2020/04/canettedem-1-430x430.jpg"
        // Brassivoire / Import bières
        const val GUINNESS_33 = "https://solibrachezvous.com/wp-content/uploads/2021/03/guinness33cl_vc-430x430.jpg"
        const val GUINNESS_65 = "https://solibrachezvous.com/wp-content/uploads/2021/03/guinness65cl_vc-1-430x430.jpg"
        const val GUINNESS_CAN = "https://solibrachezvous.com/wp-content/uploads/2024/09/canetteGuiness-430x430.jpg"
        const val MALTA_GUINNESS = "https://solibrachezvous.com/wp-content/uploads/2020/04/malta-guinnessa-430x430.jpg"
        const val HEINEKEN = "https://brassivoire.ci/wp-content/uploads/2024/05/heineken-4-201x300.png"
        const val DESPERADOS = "https://brassivoire.ci/wp-content/uploads/2024/05/desperados-2-201x300.png"
        const val IVOIRE = "https://brassivoire.ci/wp-content/uploads/2024/09/60cl-Classic-New-1-160x300.png"
        const val BUDWEISER = "https://solibrachezvous.com/wp-content/uploads/2020/04/budweiser-carton2-430x430.jpg"
        const val CORONA = "https://solibrachezvous.com/wp-content/uploads/2024/08/vente-430x430.jpg"
        const val BAVARIA = "https://images.openfoodfacts.org/images/products/871/480/001/1426/front_en.6.200.jpg"
        // Sodas & Gazeuses
        const val YOUZOU_30 = "https://solibrachezvous.com/wp-content/uploads/2022/03/YOUZOU30CL-430x430.jpg"
        const val YOUZOU_50 = "https://solibrachezvous.com/wp-content/uploads/2022/03/YOUZOU50CL-430x430.jpg"
        const val YOUZOU_CAN = "https://solibrachezvous.com/wp-content/uploads/2022/06/youzoucanette-1-430x430.jpg"
        const val YOUZOU_PET30 = "https://solibrachezvous.com/wp-content/uploads/2022/03/YOUKI-30CL-PET-430x430.jpg"
        const val YOUZOU_PET15 = "https://solibrachezvous.com/wp-content/uploads/2026/03/YOUZOU-1L-430x430.jpg"
        const val YOUKI_30 = "https://solibrachezvous.com/wp-content/uploads/2020/04/YOUKI-30CL-430x430.jpg"
        const val YOUKI_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/YOUKI50CL-430x430.jpg"
        const val YOUKI_PET30 = "https://solibrachezvous.com/wp-content/uploads/2020/04/youki-430x430.jpg"
        const val YOUKI_PET15 = "https://solibrachezvous.com/wp-content/uploads/2020/04/youki-orange-430x430.jpg"
        const val ORANGINA_30 = "https://solibrachezvous.com/wp-content/uploads/2020/04/ORANGINA-30-CL-430x430.jpg"
        const val ORANGINA_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/ORANGINA50-430x430.jpg"
        const val ORANGINA_CAN = "https://solibrachezvous.com/wp-content/uploads/2020/04/orangina33cl-430x430.jpg"
        const val WORLD_COLA_30 = "https://solibrachezvous.com/wp-content/uploads/2022/02/WCO-430x430.jpg"
        const val WORLD_COLA_50 = "https://solibrachezvous.com/wp-content/uploads/2022/01/worldcola50cl-VC-430x430.jpg"
        const val WORLD_COLA_CAN = "https://solibrachezvous.com/wp-content/uploads/2022/02/worldcolacanette33cl-430x430.jpg"
        const val CHILL_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/CHILL50-NOUVEAU-430x430.jpg"
        const val CHILL_CAN = "https://solibrachezvous.com/wp-content/uploads/2026/03/CANETTE-CHILL-430x430.jpg"
        const val COCA = "https://images.openfoodfacts.org/images/products/544/900/005/4227/front_en.563.200.jpg"
        const val FANTA = "https://images.openfoodfacts.org/images/products/544/900/001/1527/front_en.376.200.jpg"
        const val SPRITE = "https://images.openfoodfacts.org/images/products/544/900/000/6295/front_fr.11.200.jpg"
        const val KUNJA = "https://brassivoire.ci/wp-content/uploads/2024/10/autre-categ-300x188.jpg"
        // Énergie
        const val RINOH = "https://brassivoire.ci/wp-content/uploads/2024/05/rhino-1-201x300.png"
        const val ENERGY_3X = "https://sokafafrique.com/wp-content/uploads/2023/04/500ml-3x-energy-drink.jpg"
        const val XXL_ENERGY = "https://solibrachezvous.com/wp-content/uploads/2020/04/xxl24-1-430x430.jpg"
        const val FEROX_ENERGY = "https://solibrachezvous.com/wp-content/uploads/2026/09/FEROX-CANETTE-1-430x430.jpg"
        const val ENERGY_GENERIC = "https://brassivoire.ci/wp-content/uploads/2024/10/Boissons-energisantes-300x188.jpg"
        // Eaux minérales
        const val AWA = "https://images.openfoodfacts.org/images/products/618/110/036/0035/front_fr.24.200.jpg"
        const val AKWABA = "https://gig.ci/wp-content/uploads/2025/01/AkwabaO_1-768x767.png"
        // Vins & Spiritueux
        const val VALPIERRE_50 = "https://solibrachezvous.com/wp-content/uploads/2020/04/valpierre50cl-430x430.jpg"
        const val VALPIERRE_100 = "https://solibrachezvous.com/wp-content/uploads/2020/04/VALPIERRE-430x430.jpg"
        const val BARON_ARIGNAC = "https://images.openfoodfacts.org/images/products/326/328/634/2593/front_fr.11.200.jpg"
        const val BAILEYS = "https://images.openfoodfacts.org/images/products/501/101/310/0156/front_en.155.200.jpg"
        const val BALLANTINES = "https://images.openfoodfacts.org/images/products/501/010/611/1956/front_fr.38.200.jpg"
        const val ABSOLUT_VODKA = "https://images.openfoodfacts.org/images/products/731/204/001/7683/front_en.31.200.jpg"
        const val SOMBREROS_50 = "https://solibrachezvous.com/wp-content/uploads/2023/10/sombreros-casier-50cl-430x430.jpg"
        const val SOMBREROS_33 = "https://solibrachezvous.com/wp-content/uploads/2023/10/sombreros-casier-33cl-430x430.jpg"
    }

    private fun stripAccentsLower(s: String?): String {
        val norm = Normalizer.normalize(s.orEmpty(), Normalizer.Form.NFD)
        return norm.replace(Regex("[\\p{InCombiningDiacriticalMarks}]"), "").lowercase()
    }

    fun normalizeKey(name: String?): String =
        stripAccentsLower(name).replace(Regex("[^a-z0-9]"), "")

    fun isValidImageUrl(url: String?): Boolean {
        if (url.isNullOrBlank() || url.length < 8) return false
        if (url.contains("images.unsplash.com", ignoreCase = true)) return false
        return url.startsWith("http://", ignoreCase = true) ||
            url.startsWith("https://", ignoreCase = true) ||
            url.startsWith("data:image", ignoreCase = true)
    }

    fun matchDrinkPhoto(nameRaw: String?, categoryRaw: String?): String? {
        val n = stripAccentsLower(nameRaw)
        val cat = stripAccentsLower(categoryRaw)
        val isCan = Regex("canette|can\\b|boite").containsMatchIn(n)
        val isPet = Regex("\\bpet\\b|plastique").containsMatchIn(n)

        if (Regex("beaufort|beauford").containsMatchIn(n)) {
            if (isCan) return V.BEAUFORT_CAN
            if (n.contains("25")) return V.BEAUFORT_25
            if (n.contains("33")) return V.BEAUFORT_33
            return V.BEAUFORT_50
        }
        if (Regex("\\bbock\\b").containsMatchIn(n)) {
            if (isCan) return V.BOCK_CAN
            if (Regex("100|1\\s*l\\b").containsMatchIn(n)) return V.BOCK_100
            if (Regex("65|66").containsMatchIn(n)) return V.BOCK_65
            if (n.contains("50")) return V.BOCK_50
            return V.BOCK_25
        }
        if (n.contains("castel")) {
            return if (Regex("50|65").containsMatchIn(n)) V.CASTEL_50 else V.CASTEL_33
        }
        if (Regex("\\bflag\\b").containsMatchIn(n)) return V.FLAG
        if (n.contains("booster")) return V.BOOSTER_TEQUILA
        if (n.contains("racine")) {
            if (n.contains("fort")) return V.RACINE_FORT
            if (isCan) return V.RACINE_CAN
            if (Regex("33|30").containsMatchIn(n)) return V.RACINE_33
            return V.RACINE_50
        }
        if (Regex("dopel|doppel").containsMatchIn(n)) {
            if (Regex("energie|energy|malt").containsMatchIn(n)) return V.DOPEL_ENERGIE
            return if (n.contains("33")) V.DOPEL_33 else V.DOPEL_50
        }
        if (n.contains("malta")) return V.MALTA_GUINNESS
        if (Regex("guinness|guiness").containsMatchIn(n)) {
            if (isCan) return V.GUINNESS_CAN
            if (Regex("65|60").containsMatchIn(n)) return V.GUINNESS_65
            return V.GUINNESS_33
        }
        if (n.contains("heineken")) return V.HEINEKEN
        if (Regex("desperados|despe").containsMatchIn(n)) return V.DESPERADOS
        if (n.contains("budweiser")) return V.BUDWEISER
        if (n.contains("corona")) return V.CORONA
        if (n.contains("bavaria")) return V.BAVARIA
        if (n.contains("ivoire")) return V.IVOIRE

        if (n.contains("youzou")) {
            if (isCan) return V.YOUZOU_CAN
            if (isPet || Regex("1[.,]5|1l").containsMatchIn(n)) {
                return if (Regex("1[.,]5|1\\s*l|100").containsMatchIn(n)) V.YOUZOU_PET15 else V.YOUZOU_PET30
            }
            return if (Regex("50|60").containsMatchIn(n)) V.YOUZOU_50 else V.YOUZOU_30
        }
        if (n.contains("youki")) {
            if (isPet || Regex("1[.,]5|1l").containsMatchIn(n)) {
                return if (Regex("1[.,]5|1\\s*l|100").containsMatchIn(n)) V.YOUKI_PET15 else V.YOUKI_PET30
            }
            return if (Regex("50|60").containsMatchIn(n)) V.YOUKI_50 else V.YOUKI_30
        }
        if (n.contains("orangina")) {
            if (isCan) return V.ORANGINA_CAN
            return if (Regex("50|60|1[.,]25|1[.,]5").containsMatchIn(n)) V.ORANGINA_50 else V.ORANGINA_30
        }
        if (Regex("sucrerie|world\\s*cola|wordcola").containsMatchIn(n)) {
            if (isCan) return V.WORLD_COLA_CAN
            return if (Regex("50|60").containsMatchIn(n)) V.WORLD_COLA_50 else V.WORLD_COLA_30
        }
        if (Regex("\\bchill\\b").containsMatchIn(n)) return if (isCan) V.CHILL_CAN else V.CHILL_50
        if (Regex("coca|coke").containsMatchIn(n)) return V.COCA
        if (n.contains("fanta")) return V.FANTA
        if (n.contains("sprite")) return V.SPRITE
        if (n.contains("kunja")) return V.KUNJA

        if (Regex("rinoh|rhino").containsMatchIn(n)) return V.RINOH
        if (n.contains("3x")) return V.ENERGY_3X
        if (Regex("\\bxxl\\b").containsMatchIn(n)) return V.XXL_ENERGY
        if (n.contains("ferox")) return V.FEROX_ENERGY
        if (Regex("\\bbbl\\b|energie|energy|boom").containsMatchIn(n)) return V.ENERGY_GENERIC

        if (n.contains("akwaba")) return V.AKWABA
        if (Regex("\\bawa\\b|eau|water|mineral").containsMatchIn(n)) return V.AWA

        if (Regex("baron|arignac").containsMatchIn(n)) return V.BARON_ARIGNAC
        if (n.contains("bailey")) return V.BAILEYS
        if (Regex("ballantine|whisky|whiskey").containsMatchIn(n)) return V.BALLANTINES
        if (Regex("absolut|vodka").containsMatchIn(n)) return V.ABSOLUT_VODKA
        if (Regex("tequilla|tequila|sombreros").containsMatchIn(n)) {
            return if (Regex("33|30").containsMatchIn(n)) V.SOMBREROS_33 else V.SOMBREROS_50
        }
        if (Regex("valpierre|\\bvin\\b|wine").containsMatchIn(n)) {
            return if (Regex("100|75|1\\s*l").containsMatchIn(n)) V.VALPIERRE_100 else V.VALPIERRE_50
        }

        if (cat.contains("biere") || cat.contains("beer")) return V.BOCK_50
        if (cat.contains("soda") || cat.contains("boisson") || cat.contains("gazeuse")) return V.YOUZOU_30
        if (cat.contains("eau")) return V.AWA
        if (cat.contains("energie") || cat.contains("energy")) return V.ENERGY_3X
        if (cat.contains("vin")) return V.VALPIERRE_50
        if (cat.contains("spiritueux") || cat.contains("alcool")) return V.BALLANTINES
        return null
    }

    fun categoryFallback(category: String?): String {
        val cat = stripAccentsLower(category)
        return when {
            cat.contains("biere") || cat.contains("beer") -> V.BOCK_50
            cat.contains("soda") || cat.contains("boisson") -> V.YOUZOU_30
            cat.contains("eau") -> V.AWA
            cat.contains("energie") -> V.ENERGY_3X
            cat.contains("vin") -> V.VALPIERRE_50
            cat.contains("spiritueux") || cat.contains("alcool") -> V.BALLANTINES
            else -> V.BOCK_50
        }
    }

    fun resolve(
        name: String?,
        category: String?,
        imageUrl: String?,
        remoteDefaults: Map<String, String> = emptyMap(),
    ): String {
        if (isValidImageUrl(imageUrl)) return imageUrl!!
        matchDrinkPhoto(name, category)?.let { return it }

        val key = normalizeKey(name)
        if (key.length >= 2 && remoteDefaults.isNotEmpty()) {
            remoteDefaults[key]?.takeIf { isValidImageUrl(it) }?.let { return it }
            var bestScore = 0
            var bestUrl: String? = null
            for ((k, u) in remoteDefaults) {
                if (!isValidImageUrl(u)) continue
                if (k.contains(key) || key.contains(k)) {
                    val sc = minOf(k.length, key.length)
                    if (sc >= 4 && sc > bestScore) {
                        bestScore = sc
                        bestUrl = u
                    }
                }
            }
            if (bestUrl != null) return bestUrl
        }

        return categoryFallback(category)
    }
}
