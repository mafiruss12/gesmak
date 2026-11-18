package com.gesmak.app.data

import android.content.Context
import com.gesmak.app.ui.screens.EstChoice
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cache local persistant par utilisateur pour affichage instantané et continuité
 * complète en mode hors-ligne (sans perte d'établissement, de rôle ni du catalogue).
 */
class OfflineCache(context: Context) {
    private val prefs = context.getSharedPreferences("gesmak_offline_cache_v1", Context.MODE_PRIVATE)

    data class Snapshot(
        val lastSyncedMs: Long,
        val estId: String?,
        val member: SupabaseApi.Member?,
        val establishment: SupabaseApi.Establishment?,
        val estChoices: List<EstChoice>,
        val poles: List<SupabaseApi.EstablishmentPole>,
        val allPoles: List<SupabaseApi.EstablishmentPole>,
        val products: List<SupabaseApi.Product>,
        val orders: List<SupabaseApi.OrderRow>,
        val tables: List<SupabaseApi.RestaurantTableRow>,
        val serviceDay: SupabaseApi.ServiceDayRow?,
        val cashSession: SupabaseApi.CashSessionRow?,
        val caDay: Double,
        val cashSalesDay: Double,
        val caWeek: Double,
        val caMonth: Double,
        val expensesDay: Double,
        val expensesMonth: Double,
        val productImageDefaults: Map<String, String>,
    )

    fun save(userId: String, s: Snapshot) {
        if (userId.isBlank()) return
        try {
            val root = JSONObject()
                .put("last_synced_ms", s.lastSyncedMs)
                .put("est_id", s.estId ?: JSONObject.NULL)
                .put("ca_day", s.caDay)
                .put("cash_sales_day", s.cashSalesDay)
                .put("ca_week", s.caWeek)
                .put("ca_month", s.caMonth)
                .put("expenses_day", s.expensesDay)
                .put("expenses_month", s.expensesMonth)

            s.member?.let { m ->
                root.put(
                    "member",
                    JSONObject()
                        .put("id", m.id)
                        .put("user_id", m.userId)
                        .put("full_name", m.fullName)
                        .put("role", m.role)
                        .put("status", m.status)
                        .put("establishment_id", m.establishmentId ?: JSONObject.NULL)
                        .put("email", m.email ?: JSONObject.NULL)
                        .put("assigned_pole_code", m.assignedPoleCode ?: JSONObject.NULL)
                        .put("supervisor_user_id", m.supervisorUserId ?: JSONObject.NULL)
                        .put("can_edit_stock", m.canEditStock)
                        .put("allowed_types", JSONArray(m.allowedTypes))
                        .put("avatar_url", m.avatarUrl ?: JSONObject.NULL),
                )
            }

            s.establishment?.let { e ->
                root.put(
                    "establishment",
                    JSONObject()
                        .put("id", e.id)
                        .put("name", e.name)
                        .put("type", e.type ?: JSONObject.NULL)
                        .put("slug", e.slug ?: JSONObject.NULL)
                        .put("address", e.address ?: JSONObject.NULL)
                        .put("phone", e.phone ?: JSONObject.NULL)
                        .put("subscription_status", e.subscriptionStatus ?: JSONObject.NULL)
                        .put("trial_ends_at", e.trialEndsAt ?: JSONObject.NULL)
                        .put("plan_tier", e.planTier ?: JSONObject.NULL)
                        .put("latitude", e.latitude ?: JSONObject.NULL)
                        .put("longitude", e.longitude ?: JSONObject.NULL)
                        .put("location_updated_at", e.locationUpdatedAt ?: JSONObject.NULL)
                        .put("subscription_ends_at", e.subscriptionEndsAt ?: JSONObject.NULL)
                        .put("last_payment_at", e.lastPaymentAt ?: JSONObject.NULL)
                        .put("created_at", e.createdAt ?: JSONObject.NULL)
                        .put("allowed_types", JSONArray(e.allowedTypes))
                        .put("logo_url", e.logoUrl ?: JSONObject.NULL)
                        .put("owner_email", e.ownerEmail ?: JSONObject.NULL)
                        .put("owner_phone", e.ownerPhone ?: JSONObject.NULL)
                        .put("services", JSONArray(e.services))
                        .put("public_visible", e.publicVisible)
                        .put("public_zone", e.publicZone ?: JSONObject.NULL)
                        .put("public_phone", e.publicPhone ?: JSONObject.NULL),
                )
            }

            root.put(
                "est_choices",
                JSONArray().apply {
                    s.estChoices.forEach {
                        put(
                            JSONObject()
                                .put("id", it.id)
                                .put("name", it.name)
                                .put("type", it.type ?: JSONObject.NULL)
                                .put("logo_url", it.logoUrl ?: JSONObject.NULL),
                        )
                    }
                },
            )
            root.put("poles", polesToJson(s.poles))
            root.put("all_poles", polesToJson(s.allPoles))
            root.put(
                "products",
                JSONArray().apply {
                    s.products.forEach { p ->
                        put(
                            JSONObject()
                                .put("id", p.id)
                                .put("name", p.name)
                                .put("price", p.price)
                                .put("stock", p.stock)
                                .put("min_stock", p.minStock)
                                .put("category", p.category ?: JSONObject.NULL)
                                .put("cost", p.cost)
                                .put("unit", p.unit ?: JSONObject.NULL)
                                .put("units_per_package", p.unitsPerPackage)
                                .put("image_url", p.imageUrl ?: JSONObject.NULL),
                        )
                    }
                },
            )
            root.put(
                "orders",
                JSONArray().apply {
                    s.orders.forEach { o ->
                        put(
                            JSONObject()
                                .put("id", o.id)
                                .put("status", o.status)
                                .put("total", o.total)
                                .put("created_at", o.createdAt)
                                .put("customer_name", o.customerName ?: JSONObject.NULL)
                                .put("table_number", o.tableNumber ?: JSONObject.NULL)
                                .put("order_type", o.orderType ?: JSONObject.NULL)
                                .put("pole_code", o.poleCode ?: JSONObject.NULL)
                                .put("notes", o.notes ?: JSONObject.NULL)
                                .put("server_id", o.serverId ?: JSONObject.NULL)
                                .put("table_id", o.tableId ?: JSONObject.NULL)
                                .put("source", o.source ?: JSONObject.NULL)
                                .put("server_name", o.serverName ?: JSONObject.NULL)
                                .put("payment_method", o.paymentMethod ?: JSONObject.NULL)
                                .put("paid_at", o.paidAt ?: JSONObject.NULL)
                                .put("paid_amount", o.paidAmount ?: JSONObject.NULL)
                                .put("stock_deducted", o.stockDeducted)
                                .put("created_by", o.createdBy ?: JSONObject.NULL),
                        )
                    }
                },
            )
            root.put(
                "tables",
                JSONArray().apply {
                    s.tables.forEach { t ->
                        put(
                            JSONObject()
                                .put("id", t.id)
                                .put("number", t.number)
                                .put("status", t.status)
                                .put("seats", t.seats)
                                .put("location", t.location ?: JSONObject.NULL)
                                .put("server_id", t.serverId ?: JSONObject.NULL)
                                .put("server_name", t.serverName ?: JSONObject.NULL),
                        )
                    }
                },
            )
            s.serviceDay?.let { sd ->
                root.put(
                    "service_day",
                    JSONObject()
                        .put("id", sd.id)
                        .put("session_date", sd.sessionDate)
                        .put("status", sd.status)
                        .put("opened_at", sd.openedAt ?: JSONObject.NULL)
                        .put("closed_at", sd.closedAt ?: JSONObject.NULL),
                )
            }
            s.cashSession?.let { cs ->
                root.put(
                    "cash_session",
                    JSONObject()
                        .put("id", cs.id)
                        .put("establishment_id", cs.establishmentId)
                        .put("session_date", cs.sessionDate)
                        .put("status", cs.status)
                        .put("opened_at", cs.openedAt)
                        .put("closed_at", cs.closedAt ?: JSONObject.NULL)
                        .put("opening_float", cs.openingFloat)
                        .put("closing_cash_real", cs.closingCashReal ?: JSONObject.NULL)
                        .put("expected_cash", cs.expectedCash ?: JSONObject.NULL)
                        .put("cash_difference", cs.cashDifference ?: JSONObject.NULL)
                        .put("total_sales", cs.totalSales ?: JSONObject.NULL)
                        .put("total_expenses", cs.totalExpenses ?: JSONObject.NULL)
                        .put("notes", cs.notes ?: JSONObject.NULL)
                        .put("pole_code", cs.poleCode ?: JSONObject.NULL)
                        .put("cashier_name", cs.cashierName ?: JSONObject.NULL)
                        .put("approved_by_name", cs.approvedByName ?: JSONObject.NULL),
                )
            }
            val imgMap = JSONObject()
            s.productImageDefaults.forEach { (k, v) -> imgMap.put(k, v) }
            root.put("product_image_defaults", imgMap)

            prefs.edit().putString("snap_$userId", root.toString()).apply()
        } catch (_: Exception) {
        }
    }

    fun load(userId: String): Snapshot? {
        if (userId.isBlank()) return null
        val raw = prefs.getString("snap_$userId", null) ?: return null
        return try {
            val root = JSONObject(raw)
            val mObj = root.optJSONObject("member")
            val member = mObj?.let { o ->
                SupabaseApi.Member(
                    id = o.optString("id"),
                    userId = o.optString("user_id"),
                    fullName = o.optString("full_name"),
                    role = o.optString("role", "employee"),
                    status = o.optString("status", "active"),
                    establishmentId = o.optStr("establishment_id"),
                    email = o.optStr("email"),
                    assignedPoleCode = o.optStr("assigned_pole_code"),
                    supervisorUserId = o.optStr("supervisor_user_id"),
                    canEditStock = o.optBoolean("can_edit_stock", false),
                    allowedTypes = o.optStrList("allowed_types"),
                    avatarUrl = o.optStr("avatar_url"),
                )
            }
            val eObj = root.optJSONObject("establishment")
            val establishment = eObj?.let { o ->
                SupabaseApi.Establishment(
                    id = o.optString("id"),
                    name = o.optString("name"),
                    type = o.optStr("type"),
                    slug = o.optStr("slug"),
                    address = o.optStr("address"),
                    phone = o.optStr("phone"),
                    subscriptionStatus = o.optStr("subscription_status"),
                    trialEndsAt = o.optStr("trial_ends_at"),
                    planTier = o.optStr("plan_tier"),
                    latitude = if (o.isNull("latitude")) null else o.optDouble("latitude"),
                    longitude = if (o.isNull("longitude")) null else o.optDouble("longitude"),
                    locationUpdatedAt = o.optStr("location_updated_at"),
                    subscriptionEndsAt = o.optStr("subscription_ends_at"),
                    lastPaymentAt = o.optStr("last_payment_at"),
                    createdAt = o.optStr("created_at"),
                    allowedTypes = o.optStrList("allowed_types"),
                    logoUrl = o.optStr("logo_url"),
                    ownerEmail = o.optStr("owner_email"),
                    ownerPhone = o.optStr("owner_phone"),
                    services = o.optStrList("services"),
                    publicVisible = o.optBoolean("public_visible", false),
                    publicZone = o.optStr("public_zone"),
                    publicPhone = o.optStr("public_phone"),
                )
            }
            val choices = buildList {
                val arr = root.optJSONArray("est_choices") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(EstChoice(o.optString("id"), o.optString("name"), o.optStr("type"), o.optStr("logo_url")))
                }
            }
            val products = buildList {
                val arr = root.optJSONArray("products") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SupabaseApi.Product(
                            id = o.optString("id"),
                            name = o.optString("name"),
                            price = o.optDouble("price", 0.0),
                            stock = o.optDouble("stock", 0.0),
                            minStock = o.optDouble("min_stock", 5.0),
                            category = o.optStr("category"),
                            cost = o.optDouble("cost", 0.0),
                            unit = o.optStr("unit"),
                            unitsPerPackage = o.optInt("units_per_package", 24).coerceAtLeast(1),
                            imageUrl = o.optStr("image_url"),
                        ),
                    )
                }
            }
            val orders = buildList {
                val arr = root.optJSONArray("orders") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SupabaseApi.OrderRow(
                            id = o.optString("id"),
                            status = o.optString("status"),
                            total = o.optDouble("total", 0.0),
                            createdAt = o.optString("created_at"),
                            customerName = o.optStr("customer_name"),
                            tableNumber = o.optStr("table_number"),
                            orderType = o.optStr("order_type"),
                            poleCode = o.optStr("pole_code"),
                            notes = o.optStr("notes"),
                            serverId = o.optStr("server_id"),
                            tableId = o.optStr("table_id"),
                            source = o.optStr("source"),
                            serverName = o.optStr("server_name"),
                            paymentMethod = o.optStr("payment_method"),
                            paidAt = o.optStr("paid_at"),
                            paidAmount = if (o.isNull("paid_amount")) null else o.optDouble("paid_amount"),
                            stockDeducted = o.optBoolean("stock_deducted", false),
                            createdBy = o.optStr("created_by"),
                        ),
                    )
                }
            }
            val tables = buildList {
                val arr = root.optJSONArray("tables") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SupabaseApi.RestaurantTableRow(
                            id = o.optString("id"),
                            number = o.optString("number"),
                            status = o.optString("status", "free"),
                            seats = o.optInt("seats", 4),
                            location = o.optStr("location"),
                            serverId = o.optStr("server_id"),
                            serverName = o.optStr("server_name"),
                        ),
                    )
                }
            }
            val sdObj = root.optJSONObject("service_day")
            val serviceDay = sdObj?.let { o ->
                SupabaseApi.ServiceDayRow(
                    id = o.optString("id"),
                    sessionDate = o.optString("session_date"),
                    status = o.optString("status", "closed"),
                    openedAt = o.optStr("opened_at"),
                    closedAt = o.optStr("closed_at"),
                )
            }
            val csObj = root.optJSONObject("cash_session")
            val cashSession = csObj?.let { o ->
                SupabaseApi.CashSessionRow(
                    id = o.optString("id"),
                    establishmentId = o.optString("establishment_id"),
                    sessionDate = o.optString("session_date"),
                    status = o.optString("status"),
                    openedAt = o.optString("opened_at"),
                    closedAt = o.optStr("closed_at"),
                    openingFloat = o.optDouble("opening_float", 0.0),
                    closingCashReal = if (o.isNull("closing_cash_real")) null else o.optDouble("closing_cash_real"),
                    expectedCash = if (o.isNull("expected_cash")) null else o.optDouble("expected_cash"),
                    cashDifference = if (o.isNull("cash_difference")) null else o.optDouble("cash_difference"),
                    totalSales = if (o.isNull("total_sales")) null else o.optDouble("total_sales"),
                    totalExpenses = if (o.isNull("total_expenses")) null else o.optDouble("total_expenses"),
                    notes = o.optStr("notes"),
                    poleCode = o.optStr("pole_code"),
                    cashierName = o.optStr("cashier_name"),
                    approvedByName = o.optStr("approved_by_name"),
                )
            }
            val imgMap = mutableMapOf<String, String>()
            root.optJSONObject("product_image_defaults")?.let { m ->
                val keys = m.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val v = m.optString(k)
                    if (v.isNotBlank()) imgMap[k] = v
                }
            }
            Snapshot(
                lastSyncedMs = root.optLong("last_synced_ms", 0L),
                estId = root.optStr("est_id"),
                member = member,
                establishment = establishment,
                estChoices = choices,
                poles = polesFromJson(root.optJSONArray("poles")),
                allPoles = polesFromJson(root.optJSONArray("all_poles")),
                products = products,
                orders = orders,
                tables = tables,
                serviceDay = serviceDay,
                cashSession = cashSession,
                caDay = root.optDouble("ca_day", 0.0),
                cashSalesDay = root.optDouble("cash_sales_day", 0.0),
                caWeek = root.optDouble("ca_week", 0.0),
                caMonth = root.optDouble("ca_month", 0.0),
                expensesDay = root.optDouble("expenses_day", 0.0),
                expensesMonth = root.optDouble("expenses_month", 0.0),
                productImageDefaults = imgMap,
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun polesToJson(list: List<SupabaseApi.EstablishmentPole>): JSONArray = JSONArray().apply {
        list.forEach { p ->
            put(
                JSONObject()
                    .put("id", p.id)
                    .put("establishment_id", p.establishmentId)
                    .put("code", p.code)
                    .put("name", p.name)
                    .put("color", p.color ?: JSONObject.NULL)
                    .put("is_active", p.isActive)
                    .put("sort_order", p.sortOrder),
            )
        }
    }

    private fun polesFromJson(arr: JSONArray?): List<SupabaseApi.EstablishmentPole> {
        if (arr == null) return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    SupabaseApi.EstablishmentPole(
                        id = o.optString("id"),
                        establishmentId = o.optString("establishment_id"),
                        code = o.optString("code"),
                        name = o.optString("name"),
                        color = o.optStr("color"),
                        isActive = o.optBoolean("is_active", true),
                        sortOrder = o.optInt("sort_order", 0),
                    ),
                )
            }
        }
    }

    private fun JSONObject.optStr(key: String): String? =
        if (isNull(key)) null else optString(key).ifBlank { null }

    private fun JSONObject.optStrList(key: String): List<String> {
        val arr = optJSONArray(key) ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val s = arr.optString(i).trim()
                if (s.isNotBlank() && s != "null") add(s)
            }
        }
    }
}
