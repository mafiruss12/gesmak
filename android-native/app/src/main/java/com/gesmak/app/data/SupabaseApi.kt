package com.gesmak.app.data

import com.gesmak.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class SupabaseApi(
    private val baseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/'),
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY,
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(25, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    data class Member(
        val id: String,
        val userId: String,
        val fullName: String,
        val role: String,
        val status: String,
        val establishmentId: String?,
        val email: String?,
        val assignedPoleCode: String?,
        val supervisorUserId: String?,
        val canEditStock: Boolean,
        val allowedTypes: List<String> = emptyList(),
        val avatarUrl: String? = null,
    )

    data class Establishment(
        val id: String,
        val name: String,
        val type: String?,
        val slug: String?,
        val address: String?,
        val phone: String?,
        val subscriptionStatus: String?,
        val trialEndsAt: String?,
        val planTier: String? = null,
        val latitude: Double?,
        val longitude: Double?,
        val locationUpdatedAt: String?,
        val subscriptionEndsAt: String? = null,
        val lastPaymentAt: String? = null,
        val createdAt: String? = null,
        val allowedTypes: List<String> = emptyList(),
        val logoUrl: String? = null,
        val ownerEmail: String? = null,
        val ownerPhone: String? = null,
        val ownerUserId: String? = null,
        val createdBy: String? = null,
        val services: List<String> = emptyList(),
        val publicVisible: Boolean = false,
        val publicZone: String? = null,
        val publicPhone: String? = null,
    )

    data class PaymentRequestRow(
        val id: String,
        val establishmentId: String,
        val planTier: String,
        val months: Int,
        val amountFcfa: Int,
        val paymentMethod: String,
        val referenceCode: String,
        val status: String,
        val createdAt: String,
    )

    data class EstablishmentPole(
        val id: String,
        val establishmentId: String,
        val code: String,
        val name: String,
        val color: String?,
        val isActive: Boolean,
        val sortOrder: Int,
    )

    data class Product(
        val id: String,
        val name: String,
        val price: Double,
        val stock: Double,
        val minStock: Double,
        val category: String?,
        val cost: Double,
        val unit: String?,
        val unitsPerPackage: Int,
        val imageUrl: String? = null,
    )

    data class OrderRow(
        val id: String,
        val status: String,
        val total: Double,
        val createdAt: String,
        val customerName: String?,
        val tableNumber: String?,
        val orderType: String?,
        val poleCode: String?,
        val notes: String?,
        val serverId: String? = null,
        val tableId: String? = null,
        val source: String? = null,
        val serverName: String? = null,
        val paymentMethod: String? = null,
        val paidAt: String? = null,
        val paidAmount: Double? = null,
        val stockDeducted: Boolean = false,
        val createdBy: String? = null,
    )

    data class OrderItemRow(
        val id: String,
        val orderId: String = "",
        val productId: String? = null,
        val productName: String,
        val quantity: Int,
        val unitPrice: Double,
        val status: String? = null,
        val notes: String? = null,
    )

    data class ExpenseRow(
        val id: String,
        val category: String,
        val description: String?,
        val amount: Double,
        val paymentMethod: String?,
        val poleCode: String?,
        val createdAt: String,
    )

    data class CashSessionRow(
        val id: String,
        val establishmentId: String,
        val sessionDate: String,
        val status: String,
        val openedAt: String,
        val closedAt: String?,
        val openingFloat: Double,
        val closingCashReal: Double?,
        val expectedCash: Double?,
        val cashDifference: Double?,
        val totalSales: Double?,
        val totalExpenses: Double?,
        val notes: String?,
        val poleCode: String?,
        val cashierName: String?,
        val approvedByName: String?,
    )

    data class ServiceDayRow(
        val id: String,
        val sessionDate: String,
        val status: String,
        val openedAt: String?,
        val closedAt: String?,
    )

    data class RestaurantTableRow(
        val id: String,
        val number: String,
        val status: String,
        val seats: Int,
        val location: String? = null,
        val serverId: String? = null,
        val serverName: String? = null,
    )

    data class SaleSummaryRow(
        val id: String,
        val total: Double,
        val qty: Int,
        val paymentMethod: String,
        val createdAt: String,
        val poleCode: String?,
        val productId: String? = null,
        val createdBy: String? = null,
    )

    data class EstLink(
        val establishmentId: String,
        val role: String,
        val assignedPoleCode: String? = null,
    )

    data class AuditRow(
        val id: String,
        val actorName: String?,
        val action: String,
        val entityType: String,
        val entityLabel: String?,
        val reason: String?,
        val createdAt: String,
    )

    data class EmployeeRow(
        val id: String,
        val establishmentId: String,
        val name: String,
        val role: String,
        val phone: String?,
        val salary: Double,
        val status: String,
    )

    data class CustomerRow(
        val id: String,
        val establishmentId: String,
        val name: String,
        val phone: String?,
        val email: String?,
        val notes: String?,
        val totalVisits: Int,
        val totalSpent: Double,
        val loyaltyPoints: Int,
    )

    data class SupplierRow(
        val id: String,
        val establishmentId: String,
        val name: String,
        val contactPerson: String?,
        val phone: String?,
        val email: String?,
        val address: String?,
        val notes: String?,
    )

    data class PurchaseRow(
        val id: String,
        val establishmentId: String,
        val supplierId: String?,
        val productId: String?,
        val qty: Double,
        val unitCost: Double,
        val total: Double,
        val status: String,
        val notes: String?,
        val createdAt: String,
    )

    data class DailyReportRow(
        val id: String,
        val date: String,
        val totalSales: Double,
        val totalExpenses: Double,
        val cash: Double,
        val mobileMoney: Double,
        val notes: String?,
        val sentAt: String?,
        val losses: Double = 0.0,
        val broken: Double = 0.0,
    )

    data class MenuCategoryRow(
        val id: String,
        val name: String,
        val sortOrder: Int,
    )

    data class MenuItemRow(
        val id: String,
        val name: String,
        val price: Double,
        val categoryId: String?,
        val description: String?,
        val linkedProductId: String?,
        val isAvailable: Boolean,
        val imageUrl: String? = null,
        val isDailyMenu: Boolean = false,
        val isWeekendPromo: Boolean = false,
        val promoPrice: Double? = null,
    )

    data class HotelRoomRow(
        val id: String,
        val number: String,
        val name: String? = null,
        val description: String? = null,
        val imageUrl: String? = null,
        val floor: String? = null,
        val roomTypeId: String? = null,
        val typeName: String? = null,
        val pricePerNight: Double = 0.0,
        val capacity: Int = 2,
        val status: String = "available",
        val notes: String? = null,
    )

    data class HotelReservationRow(
        val id: String,
        val guestName: String,
        val guestPhone: String? = null,
        val roomNumber: String? = null,
        val roomId: String? = null,
        val checkIn: String,
        val checkOut: String,
        val rate: Double = 0.0,
        val total: Double = 0.0,
        val amountPaid: Double = 0.0,
        val status: String = "pending",
        val paymentMethod: String? = null,
        val notes: String? = null,
    )

    data class ReservationRow(
        val id: String,
        val tableId: String?,
        val customerName: String,
        val phone: String?,
        val partySize: Int,
        val reservationTime: String,
        val status: String,
        val notes: String?,
    )

    data class ChatMessageRow(
        val id: String,
        val senderId: String,
        val senderName: String?,
        val recipientId: String? = null,
        val message: String,
        val createdAt: String,
    )

    data class NotificationRow(
        val id: String,
        val title: String,
        val message: String?,
        val type: String?,
        val read: Boolean,
        val link: String?,
        val createdAt: String,
    )

    data class ShiftRow(
        val id: String,
        val employeeId: String,
        val startTime: String,
        val endTime: String,
        val status: String,
        val notes: String?,
    )

    data class ProductKitItemRow(
        val id: String,
        val kitId: String,
        val productId: String?,
        val productName: String,
        val qty: Int,
        val unitPrice: Double,
    )

    data class ProductKitRow(
        val id: String,
        val name: String,
        val description: String?,
        val price: Double,
        val active: Boolean,
        val items: List<ProductKitItemRow> = emptyList(),
    )

    data class PromotionRow(
        val id: String,
        val name: String,
        val description: String?,
        val promoType: String,
        val value: Double,
        val productId: String?,
        val buyQty: Int?,
        val getQty: Int?,
        val active: Boolean,
    )

    data class PinVerifyResult(
        val ok: Boolean,
        val approvedBy: String? = null,
        val approvedByName: String? = null,
        val approvedByRole: String? = null,
        val error: String? = null,
    )

    private fun get(pathAndQuery: String, accessToken: String): Request =
        Request.Builder()
            .url("$baseUrl$pathAndQuery")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .get()
            .build()

    private fun post(
        pathAndQuery: String,
        accessToken: String,
        jsonBody: String,
        prefer: String = "return=minimal",
    ): Request =
        Request.Builder()
            .url("$baseUrl$pathAndQuery")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", prefer)
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

    private fun patch(pathAndQuery: String, accessToken: String, jsonBody: String): Request =
        Request.Builder()
            .url("$baseUrl$pathAndQuery")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .patch(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

    private fun delete(pathAndQuery: String, accessToken: String): Request =
        Request.Builder()
            .url("$baseUrl$pathAndQuery")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .delete()
            .build()

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun parseStringList(o: JSONObject, key: String): List<String> {
        val arr = o.optJSONArray(key) ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val s = arr.optString(i).trim()
                if (s.isNotBlank() && s != "null") add(s)
            }
        }
    }

    private fun parseMember(o: JSONObject): Member = Member(
        id = o.optString("id"),
        userId = o.optString("user_id"),
        fullName = o.optString("full_name"),
        role = o.optString("role", "owner"),
        status = o.optString("status", "active"),
        establishmentId = o.optString("establishment_id").ifBlank { null },
        email = o.optString("email").ifBlank { null },
        assignedPoleCode = o.optString("assigned_pole_code").ifBlank { null },
        supervisorUserId = o.optString("supervisor_user_id").ifBlank { null },
        canEditStock = o.optBoolean("can_edit_stock", false),
        allowedTypes = parseStringList(o, "allowed_types"),
        avatarUrl = if (o.isNull("avatar_url")) null else o.optString("avatar_url").ifBlank { null },
    )

    fun fetchMember(accessToken: String, userId: String): Member? {
        val url = "/rest/v1/members?user_id=eq.$userId&select=*&limit=1"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            return parseMember(arr.getJSONObject(0))
        }
    }

    fun updateMemberProfile(
        accessToken: String,
        memberId: String,
        fullName: String,
        avatarUrl: String? = null,
        updateAvatar: Boolean = false,
    ): String? {
        val obj = JSONObject().put("full_name", fullName.trim())
        if (updateAvatar) {
            obj.put("avatar_url", avatarUrl?.trim()?.ifBlank { null } ?: JSONObject.NULL)
        }
        client.newCall(patch("/rest/v1/members?id=eq.$memberId", accessToken, obj.toString())).execute().use { resp ->
            return if (resp.isSuccessful) null else "Profil non mis à jour (${resp.code})"
        }
    }

    fun fetchAllEstablishmentLinks(accessToken: String, userId: String): List<EstLink> {
        val url =
            "/rest/v1/member_establishments?user_id=eq.$userId&select=establishment_id,role,assigned_pole_code&limit=50"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val id = o.optString("establishment_id")
                    if (id.isNotBlank()) {
                        add(
                            EstLink(
                                establishmentId = id,
                                role = o.optString("role", "employee"),
                                assignedPoleCode = o.optString("assigned_pole_code").ifBlank { null },
                            ),
                        )
                    }
                }
            }
        }
    }

    fun fetchLinkedEstablishmentId(accessToken: String, userId: String): String? =
        fetchAllEstablishmentLinks(accessToken, userId).firstOrNull()?.establishmentId

    fun fetchOwnedEstablishmentIds(accessToken: String, userId: String): List<String> {
        val url =
            "/rest/v1/establishments?or=(owner_user_id.eq.$userId,created_by.eq.$userId)&select=id&limit=50"
        return try {
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return emptyList()
                val arr = JSONArray(resp.body?.string().orEmpty())
                buildList {
                    for (i in 0 until arr.length()) {
                        val id = arr.getJSONObject(i).optString("id")
                        if (id.isNotBlank()) add(id)
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun fetchEstablishment(accessToken: String, id: String): Establishment? {
        val url = "/rest/v1/establishments?id=eq.$id&select=*&limit=1"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            val o = arr.getJSONObject(0)
            val lat = if (o.isNull("latitude") || !o.has("latitude")) null else o.optDouble("latitude")
            val lng = if (o.isNull("longitude") || !o.has("longitude")) null else o.optDouble("longitude")
            return Establishment(
                id = o.getString("id"),
                name = o.optString("name"),
                type = o.optString("type").ifBlank { o.optString("business_type") }.ifBlank { null },
                slug = o.optString("slug").ifBlank { null },
                address = o.optString("address").ifBlank { null },
                phone = o.optString("phone").ifBlank { null },
                subscriptionStatus = o.optString("subscription_status").ifBlank { null },
                trialEndsAt = o.optString("trial_ends_at").ifBlank { null },
                planTier = o.optString("plan_tier").ifBlank { null },
                latitude = lat,
                longitude = lng,
                locationUpdatedAt = o.optString("location_updated_at").ifBlank { null },
                subscriptionEndsAt = o.optString("subscription_ends_at").ifBlank { null },
                lastPaymentAt = o.optString("last_payment_at").ifBlank { null },
                createdAt = o.optString("created_at").ifBlank { null },
                allowedTypes = parseStringList(o, "allowed_types"),
                logoUrl = if (o.isNull("logo_url") || !o.has("logo_url")) null else o.optString("logo_url").ifBlank { null },
                ownerEmail = if (o.isNull("owner_email") || !o.has("owner_email")) null else o.optString("owner_email").ifBlank { null },
                ownerPhone = if (o.isNull("owner_phone") || !o.has("owner_phone")) null else o.optString("owner_phone").ifBlank { null },
                ownerUserId = if (o.isNull("owner_user_id") || !o.has("owner_user_id")) null else o.optString("owner_user_id").ifBlank { null },
                createdBy = if (o.isNull("created_by") || !o.has("created_by")) null else o.optString("created_by").ifBlank { null },
                services = parseStringList(o, "services"),
                publicVisible = o.optBoolean("public_visible", false),
                publicZone = if (o.isNull("public_zone") || !o.has("public_zone")) null else o.optString("public_zone").ifBlank { null },
                publicPhone = if (o.isNull("public_phone") || !o.has("public_phone")) null else o.optString("public_phone").ifBlank { null },
            )
        }
    }

    fun updateEstablishmentDetails(
        accessToken: String,
        estId: String,
        name: String,
        address: String,
        phone: String,
        type: String? = null,
    ): String? = updateEstablishmentExtended(
        accessToken = accessToken,
        estId = estId,
        name = name,
        address = address,
        phone = phone,
        type = type,
    )

    fun updateEstablishmentExtended(
        accessToken: String,
        estId: String,
        name: String,
        address: String,
        phone: String,
        type: String? = null,
        logoUrl: String? = null,
        updateLogo: Boolean = false,
        ownerEmail: String? = null,
        ownerPhone: String? = null,
        updateOwnerContacts: Boolean = false,
        services: List<String>? = null,
    ): String? {
        val obj = JSONObject()
            .put("name", name.trim())
            .put("address", address.trim().ifBlank { JSONObject.NULL })
            .put("phone", phone.trim().ifBlank { JSONObject.NULL })
        if (!type.isNullOrBlank()) {
            obj.put("type", type.trim())
        }
        if (updateLogo) {
            obj.put("logo_url", logoUrl?.trim()?.ifBlank { null } ?: JSONObject.NULL)
        }
        if (updateOwnerContacts) {
            obj.put("owner_email", ownerEmail?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            obj.put("owner_phone", ownerPhone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
        }
        client.newCall(patch("/rest/v1/establishments?id=eq.$estId", accessToken, obj.toString())).execute().use { resp ->
            if (resp.isSuccessful) return null
            // Fallback sans owner_email/owner_phone/logo_url si une colonne est absente sur un environnement
            val fallback = JSONObject()
                .put("name", name.trim())
                .put("address", address.trim().ifBlank { JSONObject.NULL })
                .put("phone", phone.trim().ifBlank { JSONObject.NULL })
            if (!type.isNullOrBlank()) fallback.put("type", type.trim())
            if (updateLogo) fallback.put("logo_url", logoUrl?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            client.newCall(patch("/rest/v1/establishments?id=eq.$estId", accessToken, fallback.toString())).execute().use { r2 ->
                return if (r2.isSuccessful) null else "Mise à jour refusée (${resp.code})"
            }
        }
    }

    fun updateEstablishmentPublicDepot(
        accessToken: String,
        estId: String,
        visible: Boolean,
        zone: String?,
        publicPhone: String?,
    ): String? {
        val obj = JSONObject()
            .put("public_visible", visible)
            .put("public_zone", zone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("public_phone", publicPhone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
        client.newCall(patch("/rest/v1/establishments?id=eq.$estId", accessToken, obj.toString())).execute().use { resp ->
            return if (resp.isSuccessful) null else "Annuaire dépôt non mis à jour (${resp.code})"
        }
    }

    fun uploadImageToVitrine(
        accessToken: String,
        folderId: String,
        prefix: String,
        jpegBytes: ByteArray,
    ): String {
        val cleanFolder = folderId.trim().ifBlank { "misc" }
        val filePath = "$cleanFolder/$prefix-${System.currentTimeMillis()}.jpg"
        try {
            val req = Request.Builder()
                .url("$baseUrl/storage/v1/object/public-vitrine/$filePath")
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("x-upsert", "true")
                .addHeader("Content-Type", "image/jpeg")
                .post(jpegBytes.toRequestBody("image/jpeg".toMediaType()))
                .build()
            client.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    return "$baseUrl/storage/v1/object/public/public-vitrine/$filePath"
                }
            }
        } catch (_: Exception) {
        }
        return "data:image/jpeg;base64," + android.util.Base64.encodeToString(jpegBytes, android.util.Base64.NO_WRAP)
    }

    fun updateEstablishmentType(
        accessToken: String,
        estId: String,
        type: String,
    ): String? {
        val clean = type.trim().ifBlank { return "Type invalide" }
        val obj = JSONObject().put("type", clean)
        client.newCall(patch("/rest/v1/establishments?id=eq.$estId", accessToken, obj.toString())).execute().use { resp ->
            return if (resp.isSuccessful) null else "Changement d'activité refusé (${resp.code})"
        }
    }

    fun createEstablishment(
        accessToken: String,
        userId: String,
        memberId: String?,
        name: String,
        type: String,
        address: String,
        phone: String,
    ): Pair<String?, String?> {
        if (name.isBlank()) return null to "Nom d'établissement requis."
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        cal.add(java.util.Calendar.DAY_OF_YEAR, 30)
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val trialEnd = fmt.format(cal.time)
        val body = JSONObject()
            .put("name", name.trim())
            .put("type", type.ifBlank { "maquis" })
            .put("address", address.trim().ifBlank { JSONObject.NULL })
            .put("phone", phone.trim().ifBlank { JSONObject.NULL })
            .put("created_by", userId)
            .put("owner_user_id", userId)
            .put("subscription_status", "trial")
            .put("trial_ends_at", trialEnd)
            .toString()
        client.newCall(post("/rest/v1/establishments", accessToken, body, "return=representation")).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) return null to "Création refusée (${resp.code})"
            val arr = JSONArray(raw)
            val newId = arr.optJSONObject(0)?.optString("id").orEmpty()
            if (newId.isBlank()) return null to "Établissement créé mais ID manquant."
            // Rattacher member_establishments + members
            val linkBody = JSONObject()
                .put("user_id", userId)
                .put("establishment_id", newId)
                .put("role", "owner")
                .put("status", "active")
                .toString()
            try {
                client.newCall(post("/rest/v1/member_establishments", accessToken, linkBody)).execute().use { }
            } catch (_: Exception) { }
            if (!memberId.isNullOrBlank()) {
                try {
                    client.newCall(
                        patch(
                            "/rest/v1/members?id=eq.$memberId",
                            accessToken,
                            JSONObject().put("establishment_id", newId).toString(),
                        ),
                    ).execute().use { }
                } catch (_: Exception) { }
            }
            return newId to null
        }
    }

    fun updateEstablishmentGps(
        accessToken: String,
        estId: String,
        lat: Double?,
        lng: Double?,
        consent: Boolean,
    ): String? {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        val body = JSONObject()
            .put("latitude", lat ?: JSONObject.NULL)
            .put("longitude", lng ?: JSONObject.NULL)
            .put("location_updated_at", if (consent) nowIso else JSONObject.NULL)
            .put("location_consent", consent)
            .toString()
        client.newCall(patch("/rest/v1/establishments?id=eq.$estId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Position GPS non enregistrée (${resp.code})"
        }
    }

    // ---------- Pôles & Hiérarchie ----------

    fun fetchPoles(accessToken: String, estId: String, includeInactive: Boolean = false): List<EstablishmentPole> {
        val activeClause = if (includeInactive) "" else "&is_active=eq.true"
        val url =
            "/rest/v1/establishment_poles?establishment_id=eq.$estId$activeClause&select=id,establishment_id,code,name,color,is_active,sort_order&order=sort_order.asc"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        EstablishmentPole(
                            id = o.optString("id"),
                            establishmentId = o.optString("establishment_id"),
                            code = o.optString("code"),
                            name = o.optString("name"),
                            color = o.optString("color").ifBlank { null },
                            isActive = o.optBoolean("is_active", true),
                            sortOrder = o.optInt("sort_order", 0),
                        ),
                    )
                }
            }
        }
    }

    fun ensureDefaultPolesRpc(accessToken: String, estId: String, codes: List<String>? = null): String? {
        val payload = JSONObject().put("p_establishment_id", estId)
        if (codes != null) {
            payload.put("p_codes", JSONArray(codes))
        }
        client.newCall(post("/rest/v1/rpc/ensure_default_poles", accessToken, payload.toString(), "return=representation"))
            .execute().use { resp ->
                return if (resp.isSuccessful) null else "Initialisation pôles refusée (${resp.code})"
            }
    }

    fun setPoleActive(accessToken: String, estId: String, code: String, isActive: Boolean): String? {
        val body = JSONObject().put("is_active", isActive).toString()
        client.newCall(
            patch("/rest/v1/establishment_poles?establishment_id=eq.$estId&code=eq.${enc(code)}", accessToken, body),
        ).execute().use { resp ->
            return if (resp.isSuccessful) null else "Modification pôle refusée (${resp.code})"
        }
    }

    fun assignTeamMemberRpc(
        accessToken: String,
        userId: String,
        estId: String,
        role: String,
        fullName: String?,
        email: String,
    ): String? {
        val payload = JSONObject()
            .put("p_user_id", userId)
            .put("p_establishment_id", estId)
            .put("p_role", role)
            .put("p_full_name", fullName?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("p_email", email)
        client.newCall(post("/rest/v1/rpc/assign_team_member", accessToken, payload.toString(), "return=representation"))
            .execute().use { resp ->
                if (resp.isSuccessful) return null
                val raw = resp.body?.string().orEmpty()
                return try {
                    JSONObject(raw).optString("message").ifBlank { "Liaison équipe échouée (${resp.code})" }
                } catch (_: Exception) {
                    "Liaison équipe échouée (${resp.code})"
                }
            }
    }

    fun setMemberPoleAndPinRpc(
        accessToken: String,
        targetUserId: String,
        estId: String,
        poleCode: String?,
        supervisorUserId: String? = null,
        managerPin: String? = null,
    ): String? {
        val payload = JSONObject()
            .put("p_user_id", targetUserId)
            .put("p_establishment_id", estId)
            .put("p_pole_code", poleCode ?: JSONObject.NULL)
            .put("p_supervisor_user_id", supervisorUserId ?: JSONObject.NULL)
            .put("p_manager_pin", managerPin?.trim()?.ifBlank { null } ?: JSONObject.NULL)
        client.newCall(post("/rest/v1/rpc/set_member_pole_and_pin", accessToken, payload.toString(), "return=representation"))
            .execute().use { resp ->
                if (resp.isSuccessful) return null
                val raw = resp.body?.string().orEmpty()
                return try {
                    JSONObject(raw).optString("message").ifBlank { "Erreur (${resp.code})" }
                } catch (_: Exception) {
                    "Opération refusée (${resp.code})"
                }
            }
    }

    fun verifyManagerPinRpc(
        accessToken: String,
        estId: String,
        poleCode: String?,
        pin: String,
        action: String,
        reason: String,
    ): PinVerifyResult {
        val payload = JSONObject()
            .put("p_establishment_id", estId)
            .put("p_pole_code", poleCode ?: JSONObject.NULL)
            .put("p_pin", pin.trim())
            .put("p_action", action)
            .put("p_reason", reason)
        return try {
            client.newCall(post("/rest/v1/rpc/verify_manager_pin", accessToken, payload.toString(), "return=representation"))
                .execute().use { resp ->
                    val text = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return PinVerifyResult(false, error = "Vérification impossible (${resp.code})")
                    }
                    val o = JSONObject(text)
                    val ok = o.optBoolean("ok", false)
                    PinVerifyResult(
                        ok = ok,
                        approvedBy = o.optString("approved_by").ifBlank { null },
                        approvedByName = o.optString("approved_by_name").ifBlank { null },
                        approvedByRole = o.optString("approved_by_role").ifBlank { null },
                        error = if (ok) null else o.optString("error").ifBlank { "PIN incorrect" },
                    )
                }
        } catch (e: Exception) {
            PinVerifyResult(false, error = e.message ?: "Erreur réseau")
        }
    }

    fun fetchOperationAudit(accessToken: String, estId: String, limit: Int = 15): List<AuditRow> {
        val url =
            "/rest/v1/operation_audit?establishment_id=eq.$estId&select=id,actor_name,action,entity_type,entity_label,reason,created_at&order=created_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        AuditRow(
                            id = o.optString("id"),
                            actorName = o.optString("actor_name").ifBlank { null },
                            action = o.optString("action"),
                            entityType = o.optString("entity_type"),
                            entityLabel = o.optString("entity_label").ifBlank { null },
                            reason = o.optString("reason").ifBlank { null },
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    // ---------- Équipe ----------

    fun fetchTeamMembers(accessToken: String, estId: String): List<Member> {
        val url = "/rest/v1/members?establishment_id=eq.$estId&select=*&order=created_at.desc&limit=100"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    add(parseMember(arr.getJSONObject(i)))
                }
            }
        }
    }

    fun updateMemberStatus(accessToken: String, memberId: String, status: String): String? {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/members?id=eq.$memberId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Statut non modifié (${resp.code})"
        }
    }

    fun updateMemberRole(
        accessToken: String,
        memberId: String,
        role: String,
        userId: String? = null,
        estId: String? = null,
    ): String? {
        val body = JSONObject().put("role", role).toString()
        client.newCall(patch("/rest/v1/members?id=eq.$memberId", accessToken, body)).execute().use { resp ->
            if (!resp.isSuccessful) return "Rôle non modifié (${resp.code})"
        }
        if (!userId.isNullOrBlank() && !estId.isNullOrBlank()) {
            try {
                client.newCall(
                    patch(
                        "/rest/v1/member_establishments?user_id=eq.$userId&establishment_id=eq.$estId",
                        accessToken,
                        body,
                    ),
                ).execute().use { }
            } catch (_: Exception) { }
        }
        return null
    }

    fun toggleCanEditStock(accessToken: String, memberId: String, allowed: Boolean): String? {
        val body = JSONObject().put("can_edit_stock", allowed).toString()
        client.newCall(patch("/rest/v1/members?id=eq.$memberId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Droit stock non modifié (${resp.code})"
        }
    }

    fun removeMemberFromEstablishment(
        accessToken: String,
        memberId: String,
        targetUserId: String,
        estId: String,
    ): String? {
        val unlink = JSONObject()
            .put("establishment_id", JSONObject.NULL)
            .put("role", "employee")
            .put("assigned_pole_code", JSONObject.NULL)
            .put("supervisor_user_id", JSONObject.NULL)
            .toString()
        client.newCall(patch("/rest/v1/members?id=eq.$memberId", accessToken, unlink)).execute().use { resp ->
            if (!resp.isSuccessful) return "Retrait impossible (${resp.code})"
        }
        try {
            client.newCall(
                delete("/rest/v1/member_establishments?user_id=eq.$targetUserId&establishment_id=eq.$estId", accessToken),
            ).execute().use { }
        } catch (_: Exception) { }
        return null
    }

    // ---------- Fiches Employés RH (employees) ----------

    fun fetchEmployees(accessToken: String, estId: String): List<EmployeeRow> {
        val url = "/rest/v1/employees?establishment_id=eq.$estId&select=id,establishment_id,name,role,phone,salary,status&order=name.asc&limit=200"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        EmployeeRow(
                            id = o.optString("id"),
                            establishmentId = o.optString("establishment_id"),
                            name = o.optString("name"),
                            role = o.optString("role", "serveur"),
                            phone = o.optString("phone").ifBlank { null },
                            salary = o.optDouble("salary", 0.0),
                            status = o.optString("status", "active"),
                        ),
                    )
                }
            }
        }
    }

    fun upsertEmployee(
        accessToken: String,
        estId: String,
        existingId: String?,
        name: String,
        role: String,
        phone: String?,
        salary: Double,
        status: String,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("role", role)
            .put("phone", phone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("salary", salary)
            .put("status", status)
            .toString()
        val req = if (existingId == null) {
            post("/rest/v1/employees", accessToken, body)
        } else {
            patch("/rest/v1/employees?id=eq.$existingId", accessToken, body)
        }
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Employé non enregistré (${resp.code})"
        }
    }

    fun deleteEmployee(accessToken: String, employeeId: String): String? {
        client.newCall(delete("/rest/v1/employees?id=eq.$employeeId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    // ---------- Produits & Arrivages ----------

    fun fetchProductImageDefaults(accessToken: String): Map<String, String> {
        val map = mutableMapOf<String, String>()
        return try {
            val url = "/rest/v1/product_image_defaults?select=name_key,name,image_url&limit=400"
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return map
                val arr = JSONArray(resp.body?.string().orEmpty())
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val img = if (o.isNull("image_url")) "" else o.optString("image_url")
                    if (!ProductImages.isValidImageUrl(img)) continue
                    val nk = o.optString("name_key").ifBlank { "" }.lowercase().replace(Regex("[^a-z0-9]"), "")
                    val n = ProductImages.normalizeKey(o.optString("name"))
                    if (nk.length >= 3) map[nk] = img
                    if (n.length >= 3) map[n] = img
                }
            }
            map
        } catch (_: Exception) {
            map
        }
    }

    fun fetchProducts(accessToken: String, estId: String): List<Product> {
        val url =
            "/rest/v1/products?establishment_id=eq.$estId&select=id,name,price,stock,min_stock,category,cost,unit,units_per_package,image_url&order=name.asc&limit=400"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        Product(
                            id = o.getString("id"),
                            name = o.optString("name"),
                            price = o.optDouble("price", 0.0),
                            stock = o.optDouble("stock", 0.0),
                            minStock = o.optDouble("min_stock", 5.0),
                            category = o.optString("category").ifBlank { null },
                            cost = o.optDouble("cost", 0.0),
                            unit = o.optString("unit").ifBlank { null },
                            unitsPerPackage = o.optInt("units_per_package", 24).coerceAtLeast(1),
                            imageUrl = if (o.isNull("image_url")) null else o.optString("image_url").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun upsertProduct(
        accessToken: String,
        estId: String,
        existingId: String?,
        name: String,
        category: String?,
        price: Double,
        cost: Double,
        stock: Double,
        minStock: Double,
        unit: String? = null,
        unitsPerPackage: Int = 24,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("category", category?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("price", price)
            .put("cost", cost)
            .put("stock", stock)
            .put("min_stock", minStock)
            .put("unit", unit?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("units_per_package", unitsPerPackage.coerceAtLeast(1))
            .toString()
        val req = if (existingId == null) {
            post("/rest/v1/products", accessToken, body)
        } else {
            patch("/rest/v1/products?id=eq.$existingId", accessToken, body)
        }
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Produit non enregistré (${resp.code})"
        }
    }

    fun deleteProduct(accessToken: String, productId: String): String? {
        client.newCall(delete("/rest/v1/products?id=eq.$productId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression impossible (${resp.code})"
        }
    }

    fun adjustStockQuick(
        accessToken: String,
        estId: String,
        userId: String,
        actorName: String,
        product: Product,
        newStock: Double,
        newMinStock: Double,
        reason: String,
    ): String? {
        val delta = newStock - product.stock
        val upd = JSONObject()
            .put("stock", newStock)
            .put("min_stock", newMinStock)
            .toString()
        client.newCall(patch("/rest/v1/products?id=eq.${product.id}", accessToken, upd)).execute().use { resp ->
            if (!resp.isSuccessful) return "Ajustement refusé (${resp.code})"
        }
        if (delta != 0.0) {
            val mov = JSONObject()
                .put("establishment_id", estId)
                .put("product_id", product.id)
                .put("product_name", product.name)
                .put("qty", delta)
                .put("movement_type", "adjustment")
                .put("unit_cost", product.cost)
                .put("unit_price", product.price)
                .put("reason", reason)
                .put("note", "$reason (${product.stock.toInt()} -> ${newStock.toInt()})")
                .put("created_by", userId)
                .toString()
            try {
                client.newCall(post("/rest/v1/stock_movements", accessToken, mov)).execute().use { }
            } catch (_: Exception) { }
            val audit = JSONObject()
                .put("establishment_id", estId)
                .put("actor_id", userId)
                .put("actor_name", actorName)
                .put("action", "stock.adjust")
                .put("entity_type", "product")
                .put("entity_id", product.id)
                .put("entity_label", product.name)
                .put("reason", "$reason (${product.stock.toInt()} -> ${newStock.toInt()})")
                .toString()
            try {
                client.newCall(post("/rest/v1/operation_audit", accessToken, audit)).execute().use { }
            } catch (_: Exception) { }
        }
        return null
    }

    fun postArrival(
        accessToken: String,
        estId: String,
        userId: String,
        product: Product,
        bottlesToAdd: Int,
        note: String,
    ): String? {
        if (bottlesToAdd <= 0) return "Quantité invalide"
        val newStock = product.stock + bottlesToAdd
        val upd = JSONObject().put("stock", newStock).toString()
        client.newCall(patch("/rest/v1/products?id=eq.${product.id}", accessToken, upd)).execute().use { resp ->
            if (!resp.isSuccessful) return "Arrivage refusé (${resp.code})"
        }
        val mov = JSONObject()
            .put("establishment_id", estId)
            .put("product_id", product.id)
            .put("product_name", product.name)
            .put("qty", bottlesToAdd)
            .put("movement_type", "arrival")
            .put("unit_cost", product.cost)
            .put("unit_price", product.price)
            .put("reason", "arrivage")
            .put("note", note)
            .put("created_by", userId)
            .toString()
        try {
            client.newCall(post("/rest/v1/stock_movements", accessToken, mov)).execute().use { }
        } catch (_: Exception) { }
        return null
    }

    // ---------- Ventes / Caisse POS ----------

    fun postSaleLine(
        accessToken: String,
        estId: String,
        userId: String,
        product: Product,
        qty: Int,
        paymentMethod: String = "cash",
        unitPriceOverride: Double? = null,
        poleCode: String? = null,
        cashSessionId: String? = null,
    ): String? {
        if (qty <= 0) return "Quantité invalide"
        val unitPrice = unitPriceOverride ?: product.price
        val sale = JSONObject()
            .put("establishment_id", estId)
            .put("product_id", product.id)
            .put("qty", qty)
            .put("unit_price", unitPrice)
            .put("total", unitPrice * qty)
            .put("payment_method", paymentMethod)
            .put("created_by", userId)
        if (!poleCode.isNullOrBlank()) sale.put("pole_code", poleCode)
        if (!cashSessionId.isNullOrBlank()) sale.put("cash_session_id", cashSessionId)

        client.newCall(post("/rest/v1/sales", accessToken, sale.toString())).execute().use { resp ->
            if (!resp.isSuccessful) return "Vente refusée (${resp.code})"
        }
        val newStock = maxOf(0.0, product.stock - qty)
        val upd = JSONObject().put("stock", newStock).toString()
        client.newCall(patch("/rest/v1/products?id=eq.${product.id}", accessToken, upd)).execute().use { resp ->
            if (!resp.isSuccessful) return "Stock non mis à jour (${resp.code})"
        }
        val mov = JSONObject()
            .put("establishment_id", estId)
            .put("product_id", product.id)
            .put("product_name", product.name)
            .put("qty", -qty)
            .put("movement_type", "pos_sale")
            .put("unit_cost", product.cost)
            .put("unit_price", unitPrice)
            .put("reason", "caisse")
            .put("note", if (!poleCode.isNullOrBlank()) "Vente POS [$poleCode]" else "Vente POS GESMAK")
            .put("created_by", userId)
            .toString()
        try {
            client.newCall(post("/rest/v1/stock_movements", accessToken, mov)).execute().use { }
        } catch (_: Exception) { }
        return null
    }

    fun fetchSalesSince(accessToken: String, estId: String, sinceIso: String, poleCode: String? = null): List<SaleSummaryRow> {
        val poleFilter = if (!poleCode.isNullOrBlank()) "&pole_code=eq.${enc(poleCode)}" else ""
        val url =
            "/rest/v1/sales?establishment_id=eq.$estId&created_at=gte.${enc(sinceIso)}$poleFilter&select=id,total,qty,payment_method,created_at,pole_code,product_id,created_by&order=created_at.desc&limit=500"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SaleSummaryRow(
                            id = o.optString("id"),
                            total = o.optDouble("total", 0.0),
                            qty = o.optInt("qty", 1),
                            paymentMethod = o.optString("payment_method", "cash").ifBlank { "cash" },
                            createdAt = o.optString("created_at"),
                            poleCode = o.optString("pole_code").ifBlank { null },
                            productId = o.optString("product_id").ifBlank { null },
                            createdBy = o.optString("created_by").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun fetchSalesTotal(accessToken: String, estId: String, sinceIso: String): Double =
        fetchSalesSince(accessToken, estId, sinceIso).sumOf { it.total }

    fun fetchRecentSales(accessToken: String, estId: String, limit: Int = 30): List<Triple<String, Double, String>> {
        val url =
            "/rest/v1/sales?establishment_id=eq.$estId&select=total,created_at,qty&order=created_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        Triple(
                            o.optString("created_at"),
                            o.optDouble("total", 0.0),
                            o.optString("qty"),
                        ),
                    )
                }
            }
        }
    }

    // ---------- Commandes ----------

    fun fetchOpenOrders(accessToken: String, estId: String): List<OrderRow> =
        fetchOrders(accessToken, estId, statuses = listOf("pending", "preparing", "ready"))

    fun fetchOrders(
        accessToken: String,
        estId: String,
        statuses: List<String>? = null,
        limit: Int = 120,
    ): List<OrderRow> {
        val statusClause = if (!statuses.isNullOrEmpty()) {
            "&status=in.(${statuses.joinToString(",")})"
        } else {
            ""
        }
        val url = "/rest/v1/orders?establishment_id=eq.$estId$statusClause&select=*&order=created_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        OrderRow(
                            id = o.getString("id"),
                            status = o.optString("status"),
                            total = o.optDouble("total", 0.0),
                            createdAt = o.optString("created_at"),
                            customerName = o.optString("customer_name").ifBlank { null },
                            tableNumber = o.optString("table_number").ifBlank { null },
                            orderType = o.optString("order_type").ifBlank { null },
                            poleCode = o.optString("pole_code").ifBlank { null },
                            notes = o.optString("notes").ifBlank { null },
                            serverId = o.optString("server_id").ifBlank { null },
                            tableId = o.optString("table_id").ifBlank { null },
                            source = o.optString("source").ifBlank { null },
                            serverName = o.optString("server_name").ifBlank { null },
                            paymentMethod = o.optString("payment_method").ifBlank { null },
                            paidAt = o.optString("paid_at").ifBlank { null },
                            paidAmount = if (!o.has("paid_amount") || o.isNull("paid_amount")) null else o.optDouble("paid_amount"),
                            stockDeducted = o.optBoolean("stock_deducted", false),
                            createdBy = o.optString("created_by").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    private fun parseOrderItem(o: JSONObject): OrderItemRow {
        val qty = if (o.has("qty") && !o.isNull("qty")) {
            o.optInt("qty", 1)
        } else if (o.has("quantity") && !o.isNull("quantity")) {
            o.optInt("quantity", 1)
        } else {
            1
        }
        return OrderItemRow(
            id = o.optString("id"),
            orderId = o.optString("order_id"),
            productId = o.optString("product_id").ifBlank { null },
            productName = o.optString("product_name", "Article"),
            quantity = qty.coerceAtLeast(1),
            unitPrice = o.optDouble("unit_price", 0.0),
            status = o.optString("status").ifBlank { null },
            notes = o.optString("notes").ifBlank { null },
        )
    }

    fun fetchOrderItems(accessToken: String, orderId: String): List<OrderItemRow> {
        val url = "/rest/v1/order_items?order_id=eq.$orderId&select=*"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) add(parseOrderItem(arr.getJSONObject(i)))
            }
        }
    }

    fun fetchOrderItemsBatch(accessToken: String, orderIds: List<String>): Map<String, List<OrderItemRow>> {
        if (orderIds.isEmpty()) return emptyMap()
        val ids = orderIds.take(60).joinToString(",")
        val url = "/rest/v1/order_items?order_id=in.($ids)&select=*"
        return try {
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return emptyMap()
                val arr = JSONArray(resp.body?.string().orEmpty())
                val grouped = mutableMapOf<String, MutableList<OrderItemRow>>()
                for (i in 0 until arr.length()) {
                    val row = parseOrderItem(arr.getJSONObject(i))
                    if (row.orderId.isNotBlank()) {
                        grouped.getOrPut(row.orderId) { mutableListOf() }.add(row)
                    }
                }
                grouped
            }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun updateOrderStatus(accessToken: String, orderId: String, status: String): Boolean {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/orders?id=eq.$orderId", accessToken, body)).execute().use {
            if (!it.isSuccessful) return false
        }
        // Synchroniser les lignes d'articles vers les statuts autorisés ('pending','preparing','ready','served')
        if (status in setOf("preparing", "ready", "served")) {
            val patchItems = JSONObject().put("status", status).toString()
            try {
                val filter = when (status) {
                    "preparing" -> "&status=eq.pending"
                    "ready" -> "&status=in.(pending,preparing)"
                    else -> "&status=neq.served"
                }
                client.newCall(patch("/rest/v1/order_items?order_id=eq.$orderId$filter", accessToken, patchItems))
                    .execute().use { }
            } catch (_: Exception) { }
        }
        return true
    }

    fun updateOrderItemStatus(accessToken: String, itemId: String, status: String): Boolean {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/order_items?id=eq.$itemId", accessToken, body)).execute().use {
            return it.isSuccessful
        }
    }

    fun assignOrderServer(
        accessToken: String,
        orderId: String,
        serverId: String?,
        serverName: String?,
        tableId: String? = null,
    ): String? {
        val body = JSONObject()
            .put("server_id", serverId ?: JSONObject.NULL)
            .put("server_name", serverName ?: JSONObject.NULL)
            .toString()
        client.newCall(patch("/rest/v1/orders?id=eq.$orderId", accessToken, body)).execute().use { resp ->
            if (!resp.isSuccessful) return "Attribution refusée (${resp.code})"
        }
        if (!tableId.isNullOrBlank() && !serverId.isNullOrBlank()) {
            try {
                assignTableServer(accessToken, tableId, serverId, serverName)
            } catch (_: Exception) { }
        }
        return null
    }

    fun appendItemsToOrder(
        accessToken: String,
        orderId: String,
        existingNotes: String?,
        extraNote: String?,
        lines: List<Pair<Product, Int>>,
    ): String? {
        if (lines.isEmpty()) return "Aucun article sélectionné."
        val itemsArr = JSONArray()
        for ((prod, qty) in lines) {
            itemsArr.put(
                JSONObject()
                    .put("order_id", orderId)
                    .put("product_id", prod.id)
                    .put("product_name", prod.name)
                    .put("qty", qty)
                    .put("unit_price", prod.price)
                    .put("status", "pending"),
            )
        }
        client.newCall(post("/rest/v1/order_items", accessToken, itemsArr.toString())).execute().use { resp ->
            if (!resp.isSuccessful) return "Ajout articles refusé (${resp.code})"
        }
        val allItems = fetchOrderItems(accessToken, orderId)
        val newTotal = allItems.sumOf { it.unitPrice * it.quantity }
        val mergedNotes = listOfNotNull(existingNotes?.trim()?.ifBlank { null }, extraNote?.trim()?.ifBlank { null })
            .joinToString(" · ").ifBlank { null }
        val upd = JSONObject()
            .put("total", newTotal)
            .put("status", "pending")
            .put("notes", mergedNotes ?: JSONObject.NULL)
            .toString()
        client.newCall(patch("/rest/v1/orders?id=eq.$orderId", accessToken, upd)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Mise à jour total refusée (${resp.code})"
        }
    }

    fun cancelOrderWithReason(
        accessToken: String,
        estId: String,
        userId: String,
        actorName: String,
        order: OrderRow,
        reason: String,
    ): String? {
        val cleanReason = reason.trim().ifBlank { "Annulation opérateur" }
        val mergedNotes = listOfNotNull(order.notes?.trim()?.ifBlank { null }, "[Annulée : $cleanReason]")
            .joinToString(" · ")
        val upd = JSONObject()
            .put("status", "cancelled")
            .put("notes", mergedNotes)
            .toString()
        client.newCall(patch("/rest/v1/orders?id=eq.${order.id}", accessToken, upd)).execute().use { resp ->
            if (!resp.isSuccessful) return "Annulation refusée (${resp.code})"
        }
        if (!order.tableId.isNullOrBlank()) {
            try { updateTableStatus(accessToken, order.tableId, "free") } catch (_: Exception) { }
        }
        try {
            val audit = JSONObject()
                .put("establishment_id", estId)
                .put("actor_id", userId)
                .put("actor_name", actorName)
                .put("action", "order.cancel")
                .put("entity_type", "order")
                .put("entity_id", order.id)
                .put("entity_label", order.tableNumber?.let { "Table $it" } ?: "Commande #${order.id.take(6)}")
                .put("reason", cleanReason)
                .toString()
            client.newCall(post("/rest/v1/operation_audit", accessToken, audit)).execute().use { }
        } catch (_: Exception) { }
        return null
    }

    fun closeAndPayOrder(
        accessToken: String,
        estId: String,
        userId: String,
        actorName: String,
        order: OrderRow,
        products: List<Product>,
        selectedItemIds: Set<String>?,
        paymentMethod: String,
        cashSessionId: String? = null,
    ): String? {
        val allItems = fetchOrderItems(accessToken, order.id)
        val isSplit = !selectedItemIds.isNullOrEmpty() && selectedItemIds.size < allItems.count { it.status != "served" }
        val targetItems = if (!selectedItemIds.isNullOrEmpty()) {
            allItems.filter { it.id in selectedItemIds }
        } else {
            allItems.filter { it.status != "served" }.ifEmpty { allItems }
        }
        val paidAmount = if (targetItems.isNotEmpty()) {
            targetItems.sumOf { it.unitPrice * it.quantity }
        } else {
            order.total
        }
        val canonicalSalePm = when (paymentMethod) {
            "cash" -> "cash"
            "wave", "orange_money", "mtn_money", "mobile", "mobile_money" -> "mobile_money"
            else -> "other"
        }
        // 1. Enregistrer les ventes (avec fallback sur canonicalSalePm si contrainte SQL stricte) + décrement stock
        val prodById = products.associateBy { it.id }
        val shouldDeductStock = !order.stockDeducted || isSplit
        for (item in targetItems) {
            val pid = item.productId
            if (!pid.isNullOrBlank()) {
                val saleObj = JSONObject()
                    .put("establishment_id", estId)
                    .put("product_id", pid)
                    .put("qty", item.quantity)
                    .put("unit_price", item.unitPrice)
                    .put("total", item.unitPrice * item.quantity)
                    .put("payment_method", paymentMethod)
                    .put("created_by", userId)
                if (!order.poleCode.isNullOrBlank()) saleObj.put("pole_code", order.poleCode)
                if (!cashSessionId.isNullOrBlank()) saleObj.put("cash_session_id", cashSessionId)

                var saleOk = false
                client.newCall(post("/rest/v1/sales", accessToken, saleObj.toString())).execute().use { r ->
                    saleOk = r.isSuccessful
                }
                if (!saleOk && paymentMethod != canonicalSalePm) {
                    saleObj.put("payment_method", canonicalSalePm)
                    client.newCall(post("/rest/v1/sales", accessToken, saleObj.toString())).execute().use { }
                }

                if (shouldDeductStock) {
                    val prod = prodById[pid]
                    val currentStock = prod?.stock ?: 0.0
                    val newStock = maxOf(0.0, currentStock - item.quantity)
                    try {
                        client.newCall(
                            patch("/rest/v1/products?id=eq.$pid", accessToken, JSONObject().put("stock", newStock).toString()),
                        ).execute().use { }
                    } catch (_: Exception) { }
                    try {
                        val mov = JSONObject()
                            .put("establishment_id", estId)
                            .put("product_id", pid)
                            .put("product_name", item.productName)
                            .put("qty", -item.quantity)
                            .put("movement_type", "pos_sale")
                            .put("unit_cost", prod?.cost ?: 0.0)
                            .put("unit_price", item.unitPrice)
                            .put("reason", "commande")
                            .put("note", "Encaissement commande ${order.tableNumber?.let { "T$it " } ?: ""}($paymentMethod)")
                            .put("created_by", userId)
                            .toString()
                        client.newCall(post("/rest/v1/stock_movements", accessToken, mov)).execute().use { }
                    } catch (_: Exception) { }
                }
            }
            try {
                updateOrderItemStatus(accessToken, item.id, "served")
            } catch (_: Exception) { }
        }

        // 2. Clôture complète ou partielle
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(Date())
        val remaining = allItems.filter { it.status != "served" && targetItems.none { t -> t.id == it.id } }

        if (remaining.isEmpty()) {
            val upd = JSONObject()
                .put("status", "served")
                .put("payment_method", paymentMethod)
                .put("paid_at", nowIso)
                .put("paid_amount", (order.paidAmount ?: 0.0) + paidAmount)
                .put("stock_deducted", true)
                .toString()
            client.newCall(patch("/rest/v1/orders?id=eq.${order.id}", accessToken, upd)).execute().use { resp ->
                if (!resp.isSuccessful) return "Clôture refusée (${resp.code})"
            }
            if (!order.tableId.isNullOrBlank()) {
                try { updateTableStatus(accessToken, order.tableId, "free") } catch (_: Exception) { }
            }
        } else {
            val remainingTotal = remaining.sumOf { it.unitPrice * it.quantity }
            val notePart = "[Partiel $paymentMethod ${paidAmount.toInt()} F par $actorName]"
            val merged = listOfNotNull(order.notes?.trim()?.ifBlank { null }, notePart).joinToString(" · ")
            val upd = JSONObject()
                .put("total", remainingTotal)
                .put("paid_amount", (order.paidAmount ?: 0.0) + paidAmount)
                .put("notes", merged)
                .toString()
            client.newCall(patch("/rest/v1/orders?id=eq.${order.id}", accessToken, upd)).execute().use { resp ->
                if (!resp.isSuccessful) return "Scission refusée (${resp.code})"
            }
        }
        return null
    }

    fun createOrderWithItems(
        accessToken: String,
        estId: String,
        userId: String,
        tableId: String? = null,
        tableNumber: String?,
        customerName: String?,
        orderType: String,
        poleCode: String?,
        notes: String?,
        lines: List<Pair<Product, Int>>,
        serverId: String? = userId,
        serverName: String? = null,
        immediatePayMethod: String? = null,
        cashSessionId: String? = null,
    ): String? {
        if (lines.isEmpty()) return "Aucun article sélectionné."
        val total = lines.sumOf { (p, q) -> p.price * q }
        val isInstantPay = !immediatePayMethod.isNullOrBlank()
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(Date())
        val orderObj = JSONObject()
            .put("establishment_id", estId)
            .put("status", if (isInstantPay) "served" else "pending")
            .put("total", total)
            .put("order_type", orderType)
            .put("table_id", tableId?.ifBlank { null } ?: JSONObject.NULL)
            .put("table_number", tableNumber?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("customer_name", customerName?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("pole_code", poleCode?.ifBlank { null } ?: JSONObject.NULL)
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("source", "staff")
            .put("created_by", userId)
            .put("server_id", serverId?.ifBlank { null } ?: JSONObject.NULL)
        if (!serverName.isNullOrBlank()) orderObj.put("server_name", serverName)
        if (isInstantPay) {
            orderObj.put("payment_method", immediatePayMethod)
            orderObj.put("paid_at", nowIso)
        }
        client.newCall(post("/rest/v1/orders", accessToken, orderObj.toString(), "return=representation")).execute().use { resp ->
            if (!resp.isSuccessful) return "Commande refusée (${resp.code})"
            val arr = JSONArray(resp.body?.string().orEmpty())
            val oid = arr.optJSONObject(0)?.optString("id").orEmpty()
            if (oid.isBlank()) return "Commande créée sans ID"
            val itemsArr = JSONArray()
            for ((prod, qty) in lines) {
                itemsArr.put(
                    JSONObject()
                        .put("order_id", oid)
                        .put("product_id", prod.id)
                        .put("product_name", prod.name)
                        .put("qty", qty)
                        .put("unit_price", prod.price)
                        .put("status", if (isInstantPay) "served" else "pending"),
                )
            }
            client.newCall(post("/rest/v1/order_items", accessToken, itemsArr.toString())).execute().use { r2 ->
                if (!r2.isSuccessful) return "Articles non enregistrés (${r2.code})"
            }
            if (isInstantPay) {
                val pm = immediatePayMethod!!
                val canonicalPm = when (pm) {
                    "cash" -> "cash"
                    "wave", "orange_money", "mtn_money", "mobile", "mobile_money" -> "mobile_money"
                    else -> "other"
                }
                for ((prod, qty) in lines) {
                    val saleObj = JSONObject()
                        .put("establishment_id", estId)
                        .put("product_id", prod.id)
                        .put("qty", qty)
                        .put("unit_price", prod.price)
                        .put("total", prod.price * qty)
                        .put("payment_method", pm)
                        .put("created_by", userId)
                    if (!poleCode.isNullOrBlank()) saleObj.put("pole_code", poleCode)
                    if (!cashSessionId.isNullOrBlank()) saleObj.put("cash_session_id", cashSessionId)
                    var ok = false
                    client.newCall(post("/rest/v1/sales", accessToken, saleObj.toString())).execute().use { sr -> ok = sr.isSuccessful }
                    if (!ok && pm != canonicalPm) {
                        saleObj.put("payment_method", canonicalPm)
                        try { client.newCall(post("/rest/v1/sales", accessToken, saleObj.toString())).execute().use { } } catch (_: Exception) { }
                    }
                    val newStock = maxOf(0.0, prod.stock - qty)
                    try {
                        client.newCall(
                            patch("/rest/v1/products?id=eq.${prod.id}", accessToken, JSONObject().put("stock", newStock).toString()),
                        ).execute().use { }
                    } catch (_: Exception) { }
                }
            } else if (!tableId.isNullOrBlank()) {
                try { updateTableStatus(accessToken, tableId, "occupied") } catch (_: Exception) { }
            }
            return null
        }
    }

    // ---------- Abonnement & Demandes de paiement Wave ----------

    fun fetchPendingPaymentRequests(accessToken: String, estId: String): List<PaymentRequestRow> {
        val url =
            "/rest/v1/payment_requests?establishment_id=eq.$estId&status=eq.pending&select=id,establishment_id,plan_tier,months,amount_fcfa,payment_method,reference_code,status,created_at&order=created_at.desc&limit=5"
        return try {
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return emptyList()
                val arr = JSONArray(resp.body?.string().orEmpty())
                buildList {
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        add(
                            PaymentRequestRow(
                                id = o.optString("id"),
                                establishmentId = o.optString("establishment_id"),
                                planTier = o.optString("plan_tier", "starter"),
                                months = o.optInt("months", 1),
                                amountFcfa = o.optInt("amount_fcfa", 0),
                                paymentMethod = o.optString("payment_method", "wave"),
                                referenceCode = o.optString("reference_code"),
                                status = o.optString("status", "pending"),
                                createdAt = o.optString("created_at"),
                            ),
                        )
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun createPaymentRequest(
        accessToken: String,
        estId: String,
        userId: String,
        planTier: String,
        months: Int,
        amountFcfa: Int,
        referenceCode: String,
        proofNote: String? = null,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("user_id", userId)
            .put("plan_tier", planTier)
            .put("months", months.coerceIn(1, 60))
            .put("amount_fcfa", amountFcfa.coerceAtLeast(1))
            .put("payment_method", "wave")
            .put("reference_code", referenceCode)
            .put("status", "pending")
            .put("proof_note", proofNote?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .toString()
        return try {
            client.newCall(post("/rest/v1/payment_requests", accessToken, body)).execute().use { resp ->
                if (resp.isSuccessful) null else "Synchronisation demande (${resp.code})"
            }
        } catch (e: Exception) {
            e.message ?: "Erreur réseau"
        }
    }

    // ---------- Dépenses ----------

    fun fetchExpenses(accessToken: String, estId: String, limit: Int = 60): List<ExpenseRow> {
        val url =
            "/rest/v1/expenses?establishment_id=eq.$estId&select=id,category,description,amount,payment_method,pole_code,created_at&order=created_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ExpenseRow(
                            id = o.optString("id"),
                            category = o.optString("category", "Autre"),
                            description = o.optString("description").ifBlank { null },
                            amount = o.optDouble("amount", 0.0),
                            paymentMethod = o.optString("payment_method").ifBlank { "cash" },
                            poleCode = o.optString("pole_code").ifBlank { null },
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    fun postExpense(
        accessToken: String,
        estId: String,
        userId: String,
        category: String,
        description: String?,
        amount: Double,
        paymentMethod: String,
        poleCode: String? = null,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("category", category)
            .put("description", description?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("amount", amount)
            .put("payment_method", paymentMethod)
            .put("created_by", userId)
        if (!poleCode.isNullOrBlank()) body.put("pole_code", poleCode)
        client.newCall(post("/rest/v1/expenses", accessToken, body.toString())).execute().use { resp ->
            return if (resp.isSuccessful) null else "Dépense refusée (${resp.code})"
        }
    }

    fun updateExpense(
        accessToken: String,
        expenseId: String,
        category: String,
        description: String?,
        amount: Double,
        paymentMethod: String,
    ): String? {
        val body = JSONObject()
            .put("category", category)
            .put("description", description?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("amount", amount)
            .put("payment_method", paymentMethod)
            .toString()
        client.newCall(patch("/rest/v1/expenses?id=eq.$expenseId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Modification dépense refusée (${resp.code})"
        }
    }

    fun deleteExpense(accessToken: String, expenseId: String): String? {
        client.newCall(delete("/rest/v1/expenses?id=eq.$expenseId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    // ---------- Sessions caisse & Clôture Z ----------

    private fun parseCashSession(o: JSONObject): CashSessionRow = CashSessionRow(
        id = o.optString("id"),
        establishmentId = o.optString("establishment_id"),
        sessionDate = o.optString("session_date"),
        status = o.optString("status", "open"),
        openedAt = o.optString("opened_at"),
        closedAt = o.optString("closed_at").ifBlank { null },
        openingFloat = o.optDouble("opening_float", 0.0),
        closingCashReal = if (o.isNull("closing_cash_real")) null else o.optDouble("closing_cash_real"),
        expectedCash = if (o.isNull("expected_cash")) null else o.optDouble("expected_cash"),
        cashDifference = if (o.isNull("cash_difference")) null else o.optDouble("cash_difference"),
        totalSales = if (o.isNull("total_sales")) null else o.optDouble("total_sales"),
        totalExpenses = if (o.isNull("total_expenses")) null else o.optDouble("total_expenses"),
        notes = o.optString("notes").ifBlank { null },
        poleCode = o.optString("pole_code").ifBlank { null },
        cashierName = o.optString("cashier_name").ifBlank { null },
        approvedByName = o.optString("approved_by_name").ifBlank { null },
    )

    fun fetchTodayCashSession(
        accessToken: String,
        estId: String,
        todayDate: String,
        poleCode: String? = null,
    ): CashSessionRow? {
        val poleFilter = if (!poleCode.isNullOrBlank()) "&pole_code=eq.${enc(poleCode)}" else ""
        val url =
            "/rest/v1/cash_sessions?establishment_id=eq.$estId&session_date=eq.$todayDate$poleFilter&order=opened_at.desc&limit=1"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            return parseCashSession(arr.getJSONObject(0))
        }
    }

    fun fetchCashSessionHistory(
        accessToken: String,
        estId: String,
        poleCode: String? = null,
        limit: Int = 20,
    ): List<CashSessionRow> {
        val poleFilter = if (!poleCode.isNullOrBlank()) "&pole_code=eq.${enc(poleCode)}" else ""
        val url =
            "/rest/v1/cash_sessions?establishment_id=eq.$estId$poleFilter&order=session_date.desc,opened_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) add(parseCashSession(arr.getJSONObject(i)))
            }
        }
    }

    fun openCashSession(
        accessToken: String,
        estId: String,
        userId: String,
        cashierName: String,
        todayDate: String,
        openingFloat: Double,
        poleCode: String?,
        salesToday: Double,
        expensesToday: Double,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("session_date", todayDate)
            .put("status", "open")
            .put("opening_float", openingFloat)
            .put("opened_by", userId)
            .put("pole_code", poleCode ?: JSONObject.NULL)
            .put("cashier_name", cashierName)
            .put("total_sales", salesToday)
            .put("total_expenses", expensesToday)
            .toString()
        client.newCall(post("/rest/v1/cash_sessions", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Ouverture session refusée (${resp.code})"
        }
    }

    fun closeCashSession(
        accessToken: String,
        sessionId: String,
        userId: String,
        realCash: Double,
        expectedCash: Double,
        salesToday: Double,
        expensesToday: Double,
        notes: String?,
        approvedBy: String? = null,
        approvedByName: String? = null,
    ): String? {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        val diff = realCash - expectedCash
        val body = JSONObject()
            .put("status", "closed")
            .put("closed_at", nowIso)
            .put("closed_by", userId)
            .put("closing_cash_real", realCash)
            .put("expected_cash", expectedCash)
            .put("cash_difference", diff)
            .put("total_sales", salesToday)
            .put("total_expenses", expensesToday)
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("approved_by", approvedBy ?: JSONObject.NULL)
            .put("approved_by_name", approvedByName ?: JSONObject.NULL)
            .toString()
        client.newCall(patch("/rest/v1/cash_sessions?id=eq.$sessionId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Clôture Z refusée (${resp.code})"
        }
    }

    // ---------- Journée d'exploitation (Service Day via cash_sessions) ----------

    fun fetchServiceDay(accessToken: String, estId: String, todayDate: String): ServiceDayRow? {
        val url =
            "/rest/v1/cash_sessions?establishment_id=eq.$estId&session_date=eq.$todayDate&order=opened_at.desc&limit=1"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            val o = arr.getJSONObject(0)
            return ServiceDayRow(
                id = o.optString("id"),
                sessionDate = o.optString("session_date"),
                status = o.optString("status", "open"),
                openedAt = o.optString("opened_at").ifBlank { null },
                closedAt = o.optString("closed_at").ifBlank { null },
            )
        }
    }

    fun openServiceDay(accessToken: String, estId: String, userId: String, todayDate: String): String? {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        val closePrev = JSONObject()
            .put("status", "closed")
            .put("closed_at", nowIso)
            .toString()
        try {
            client.newCall(
                patch(
                    "/rest/v1/cash_sessions?establishment_id=eq.$estId&session_date=eq.$todayDate&status=eq.open",
                    accessToken,
                    closePrev,
                ),
            ).execute().use { }
        } catch (_: Exception) { }

        val body = JSONObject()
            .put("establishment_id", estId)
            .put("session_date", todayDate)
            .put("status", "open")
            .put("opened_at", nowIso)
            .put("opened_by", userId)
            .put("opening_float", 0)
            .toString()
        client.newCall(post("/rest/v1/cash_sessions", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Impossible d'ouvrir la journée (${resp.code})"
        }
    }

    fun closeServiceDay(accessToken: String, dayId: String, userId: String): String? {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        val body = JSONObject()
            .put("status", "closed")
            .put("closed_at", nowIso)
            .put("closed_by", userId)
            .toString()
        client.newCall(patch("/rest/v1/cash_sessions?id=eq.$dayId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Clôture journée refusée (${resp.code})"
        }
    }

    // ---------- Tables & Serveurs ----------

    fun fetchTables(accessToken: String, estId: String): List<RestaurantTableRow> {
        val url =
            "/rest/v1/restaurant_tables?establishment_id=eq.$estId&select=id,number,status,seats,location,server_id,server_name&order=number.asc&limit=100"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        RestaurantTableRow(
                            id = o.optString("id"),
                            number = o.optString("number"),
                            status = o.optString("status", "free"),
                            seats = o.optInt("seats", 4),
                            location = o.optString("location").ifBlank { null },
                            serverId = o.optString("server_id").ifBlank { null },
                            serverName = o.optString("server_name").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun addTable(accessToken: String, estId: String, number: String, seats: Int = 4, location: String = "salle"): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("number", number.trim())
            .put("status", "free")
            .put("seats", seats)
            .put("location", location)
            .toString()
        client.newCall(post("/rest/v1/restaurant_tables", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Ajout table refusé (${resp.code})"
        }
    }

    fun updateTableStatus(accessToken: String, tableId: String, status: String): String? {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/restaurant_tables?id=eq.$tableId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Modification statut refusée (${resp.code})"
        }
    }

    fun assignTableServer(accessToken: String, tableId: String, serverId: String?, serverName: String?): String? {
        val body = JSONObject()
            .put("server_id", serverId ?: JSONObject.NULL)
            .put("server_name", serverName ?: JSONObject.NULL)
            .toString()
        client.newCall(patch("/rest/v1/restaurant_tables?id=eq.$tableId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Affectation serveur refusée (${resp.code})"
        }
    }

    fun deleteTable(accessToken: String, tableId: String): String? {
        client.newCall(delete("/rest/v1/restaurant_tables?id=eq.$tableId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression table refusée (${resp.code})"
        }
    }

    // ---------- Carte / Menu & Réservations ----------

    fun fetchMenuCategories(accessToken: String, estId: String): List<MenuCategoryRow> {
        val url = "/rest/v1/menu_categories?establishment_id=eq.$estId&select=id,name,sort_order&order=sort_order.asc"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(MenuCategoryRow(o.optString("id"), o.optString("name"), o.optInt("sort_order", i)))
                }
            }
        }
    }

    fun upsertMenuCategory(accessToken: String, estId: String, existingId: String?, name: String, sortOrder: Int): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("sort_order", sortOrder)
            .toString()
        val req = if (existingId == null) post("/rest/v1/menu_categories", accessToken, body)
        else patch("/rest/v1/menu_categories?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Catégorie non enregistrée (${resp.code})"
        }
    }

    fun deleteMenuCategory(accessToken: String, id: String): String? {
        client.newCall(delete("/rest/v1/menu_categories?id=eq.$id", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    private fun parseMenuDescriptionMeta(rawDesc: String?): Triple<Boolean, Boolean, Pair<Double?, String?>> {
        val raw = rawDesc.orEmpty()
        val isDaily = Regex("\\[MENU_JOUR\\]", RegexOption.IGNORE_CASE).containsMatchIn(raw)
        val weMatch = Regex("\\[PROMO_WE(?::(\\d+(?:\\.\\d+)?))?\\]", RegexOption.IGNORE_CASE).find(raw)
        val isWe = weMatch != null
        val promoPrice = weMatch?.groupValues?.getOrNull(1)?.toDoubleOrNull()?.takeIf { it > 0 }
        val clean = raw
            .replace(Regex("\\[MENU_JOUR\\]", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\[PROMO_WE(?::\\d+(?:\\.\\d+)?)?\\]", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s{2,}"), " ")
            .trim()
            .ifBlank { null }
        return Triple(isDaily, isWe, promoPrice to clean)
    }

    private fun encodeMenuDescriptionMeta(
        cleanDesc: String?,
        isDailyMenu: Boolean,
        isWeekendPromo: Boolean,
        promoPrice: Double?,
    ): String? {
        val (_, _, pair) = parseMenuDescriptionMeta(cleanDesc)
        val pureDesc = pair.second
        val tags = mutableListOf<String>()
        if (isDailyMenu) tags.add("[MENU_JOUR]")
        if (isWeekendPromo) {
            if (promoPrice != null && promoPrice > 0) tags.add("[PROMO_WE:${promoPrice.toInt()}]")
            else tags.add("[PROMO_WE]")
        }
        return (tags + listOfNotNull(pureDesc)).joinToString(" ").trim().ifBlank { null }
    }

    fun fetchMenuItems(accessToken: String, estId: String): List<MenuItemRow> {
        val url = "/rest/v1/menu_items?establishment_id=eq.$estId&select=*&order=name.asc"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val rawDesc = if (o.isNull("description") || !o.has("description")) null else o.optString("description")
                    val (isDailyTag, isWeTag, metaPair) = parseMenuDescriptionMeta(rawDesc)
                    val isDaily = o.optBoolean("is_daily_menu", false) || isDailyTag
                    val isWe = o.optBoolean("is_weekend_promo", false) || isWeTag
                    val colPromo = if (o.has("promo_price") && !o.isNull("promo_price")) o.optDouble("promo_price", 0.0).takeIf { it > 0 } else null
                    add(
                        MenuItemRow(
                            id = o.optString("id"),
                            name = o.optString("name"),
                            price = o.optDouble("price", 0.0),
                            categoryId = o.optString("category_id").ifBlank { null },
                            description = metaPair.second,
                            linkedProductId = o.optString("linked_product_id").ifBlank { null },
                            isAvailable = o.optBoolean("is_available", true),
                            imageUrl = if (o.has("image_url") && !o.isNull("image_url")) o.optString("image_url").ifBlank { null } else null,
                            isDailyMenu = isDaily,
                            isWeekendPromo = isWe,
                            promoPrice = colPromo ?: metaPair.first,
                        ),
                    )
                }
            }
        }
    }

    fun upsertMenuItem(
        accessToken: String,
        estId: String,
        existingId: String?,
        name: String,
        price: Double,
        categoryId: String?,
        description: String?,
        linkedProductId: String?,
        isAvailable: Boolean,
        isDailyMenu: Boolean = false,
        isWeekendPromo: Boolean = false,
        promoPrice: Double? = null,
        imageUrl: String? = null,
    ): String? {
        val encodedDesc = encodeMenuDescriptionMeta(description, isDailyMenu, isWeekendPromo, promoPrice)
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("price", price)
            .put("category_id", categoryId?.ifBlank { null } ?: JSONObject.NULL)
            .put("description", encodedDesc ?: JSONObject.NULL)
            .put("linked_product_id", linkedProductId?.ifBlank { null } ?: JSONObject.NULL)
            .put("is_available", isAvailable)
            .put("image_url", imageUrl?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .toString()
        val req = if (existingId == null) post("/rest/v1/menu_items", accessToken, body)
        else patch("/rest/v1/menu_items?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Plat non enregistré (${resp.code})"
        }
    }

    fun deleteMenuItem(accessToken: String, id: String): String? {
        client.newCall(delete("/rest/v1/menu_items?id=eq.$id", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    // ---------- Chambres d'Hôtel & Réservations ----------

    private fun parseRoomMeta(rawNotes: String?): Triple<String?, String?, Pair<String?, String?>> {
        val raw = rawNotes.orEmpty()
        val regex = Regex("\\[GESMAK_ROOM\\]([\\s\\S]*?)\\[/GESMAK_ROOM\\]")
        val match = regex.find(raw)
        var rName: String? = null
        var rDesc: String? = null
        var rImg: String? = null
        if (match != null) {
            try {
                val jo = JSONObject(match.groupValues[1])
                rName = jo.optString("name").ifBlank { null }
                rDesc = jo.optString("description").ifBlank { null }
                rImg = jo.optString("image_url").ifBlank { null }
            } catch (_: Exception) { }
        }
        val cleanNotes = raw.replace(regex, "").trim().ifBlank { null }
        return Triple(rName, rDesc, rImg to cleanNotes)
    }

    private fun encodeRoomMeta(
        name: String?,
        description: String?,
        imageUrl: String?,
        plainNotes: String?,
    ): String? {
        val clean = plainNotes.orEmpty()
            .replace(Regex("\\[GESMAK_ROOM\\][\\s\\S]*?\\[/GESMAK_ROOM\\]"), "")
            .trim()
        val payload = JSONObject()
        if (!name.isNullOrBlank()) payload.put("name", name.trim())
        if (!description.isNullOrBlank()) payload.put("description", description.trim())
        if (!imageUrl.isNullOrBlank()) payload.put("image_url", imageUrl.trim())
        val tag = if (payload.length() > 0) "[GESMAK_ROOM]$payload[/GESMAK_ROOM]" else ""
        return listOf(tag, clean).filter { it.isNotBlank() }.joinToString(" ").trim().ifBlank { null }
    }

    fun syncRoomsToQrConfig(accessToken: String, estId: String) {
        try {
            val rooms = fetchHotelRooms(accessToken, estId)
            val snap = JSONArray()
            for (r in rooms) {
                snap.put(
                    JSONObject()
                        .put("id", r.id)
                        .put("number", r.number)
                        .put("name", r.name ?: r.typeName ?: "Chambre ${r.number}")
                        .put("description", r.description ?: "")
                        .put("image_url", r.imageUrl ?: "")
                        .put("price_per_night", r.pricePerNight)
                        .put("capacity", r.capacity)
                        .put("floor", r.floor ?: "")
                        .put("status", r.status),
                )
            }
            var prevCfg = JSONObject()
            client.newCall(get("/rest/v1/establishments?id=eq.$estId&select=qr_config&limit=1", accessToken)).execute().use { resp ->
                if (resp.isSuccessful) {
                    val arr = JSONArray(resp.body?.string().orEmpty())
                    val existing = arr.optJSONObject(0)?.optJSONObject("qr_config")
                    if (existing != null) prevCfg = existing
                }
            }
            prevCfg.put("rooms", snap)
            client.newCall(
                patch("/rest/v1/establishments?id=eq.$estId", accessToken, JSONObject().put("qr_config", prevCfg).toString()),
            ).execute().use { }
        } catch (_: Exception) { }
    }

    fun fetchHotelRooms(accessToken: String, estId: String): List<HotelRoomRow> {
        val url =
            "/rest/v1/hotel_rooms?establishment_id=eq.$estId&select=*,hotel_room_types(name,price_per_night,capacity)&order=number.asc&limit=200"
        return try {
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return emptyList()
                val arr = JSONArray(resp.body?.string().orEmpty())
                buildList {
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val rt = o.optJSONObject("hotel_room_types")
                        val rawNotes = if (o.isNull("notes") || !o.has("notes")) null else o.optString("notes")
                        val (mName, mDesc, pair) = parseRoomMeta(rawNotes)
                        val colImg = if (o.has("image_url") && !o.isNull("image_url")) o.optString("image_url").ifBlank { null } else null
                        val colName = if (o.has("name") && !o.isNull("name")) o.optString("name").ifBlank { null } else null
                        val colDesc = if (o.has("description") && !o.isNull("description")) o.optString("description").ifBlank { null } else null
                        val basePrice = o.optDouble("price_per_night", 0.0).takeIf { it > 0 }
                            ?: (rt?.optDouble("price_per_night", 0.0) ?: 0.0)
                        add(
                            HotelRoomRow(
                                id = o.optString("id"),
                                number = o.optString("number"),
                                name = colName ?: mName ?: rt?.optString("name")?.ifBlank { null },
                                description = colDesc ?: mDesc,
                                imageUrl = colImg ?: pair.first,
                                floor = if (o.isNull("floor") || !o.has("floor")) null else o.optString("floor").ifBlank { null },
                                roomTypeId = if (o.isNull("room_type_id") || !o.has("room_type_id")) null else o.optString("room_type_id").ifBlank { null },
                                typeName = rt?.optString("name")?.ifBlank { null },
                                pricePerNight = basePrice,
                                capacity = o.optInt("capacity", rt?.optInt("capacity", 2) ?: 2),
                                status = o.optString("status", "available"),
                                notes = pair.second,
                            ),
                        )
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun upsertHotelRoom(
        accessToken: String,
        estId: String,
        existingId: String?,
        number: String,
        name: String?,
        description: String?,
        imageUrl: String?,
        floor: String?,
        pricePerNight: Double,
        capacity: Int,
        status: String,
    ): String? {
        if (number.isBlank()) return "Numéro de chambre requis."
        val encodedNotes = encodeRoomMeta(name, description, imageUrl, null)
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("number", number.trim())
            .put("floor", floor?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("price_per_night", pricePerNight)
            .put("capacity", capacity.coerceAtLeast(1))
            .put("status", status.ifBlank { "available" })
            .put("notes", encodedNotes ?: JSONObject.NULL)
            .toString()
        val req = if (existingId == null) post("/rest/v1/hotel_rooms", accessToken, body)
        else patch("/rest/v1/hotel_rooms?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return "Chambre non enregistrée (${resp.code})"
        }
        syncRoomsToQrConfig(accessToken, estId)
        return null
    }

    fun updateHotelRoomStatus(accessToken: String, estId: String, roomId: String, status: String): String? {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/hotel_rooms?id=eq.$roomId", accessToken, body)).execute().use { resp ->
            if (!resp.isSuccessful) return "Statut chambre non modifié (${resp.code})"
        }
        syncRoomsToQrConfig(accessToken, estId)
        return null
    }

    fun deleteHotelRoom(accessToken: String, estId: String, roomId: String): String? {
        client.newCall(delete("/rest/v1/hotel_rooms?id=eq.$roomId", accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return "Suppression refusée (${resp.code})"
        }
        syncRoomsToQrConfig(accessToken, estId)
        return null
    }

    fun fetchHotelReservations(accessToken: String, estId: String): List<HotelReservationRow> {
        val url =
            "/rest/v1/hotel_reservations?establishment_id=eq.$estId&select=*,hotel_guests(first_name,last_name,phone),hotel_rooms(number)&order=check_in.desc&limit=100"
        return try {
            client.newCall(get(url, accessToken)).execute().use { resp ->
                if (!resp.isSuccessful) return emptyList()
                val arr = JSONArray(resp.body?.string().orEmpty())
                buildList {
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val g = o.optJSONObject("hotel_guests")
                        val r = o.optJSONObject("hotel_rooms")
                        val gName = listOfNotNull(
                            g?.optString("first_name")?.ifBlank { null },
                            g?.optString("last_name")?.ifBlank { null },
                        ).joinToString(" ").ifBlank { "Client" }
                        add(
                            HotelReservationRow(
                                id = o.optString("id"),
                                guestName = gName,
                                guestPhone = g?.optString("phone")?.ifBlank { null },
                                roomNumber = r?.optString("number")?.ifBlank { null },
                                roomId = if (o.isNull("room_id") || !o.has("room_id")) null else o.optString("room_id").ifBlank { null },
                                checkIn = o.optString("check_in"),
                                checkOut = o.optString("check_out"),
                                rate = o.optDouble("rate", 0.0),
                                total = o.optDouble("total", 0.0),
                                amountPaid = o.optDouble("amount_paid", 0.0),
                                status = o.optString("status", "pending"),
                                paymentMethod = if (o.isNull("payment_method") || !o.has("payment_method")) null else o.optString("payment_method").ifBlank { null },
                                notes = if (o.isNull("notes") || !o.has("notes")) null else o.optString("notes").ifBlank { null },
                            ),
                        )
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun updateHotelReservationStatus(
        accessToken: String,
        estId: String,
        resId: String,
        roomId: String?,
        newStatus: String,
    ): String? {
        val body = JSONObject().put("status", newStatus).toString()
        client.newCall(patch("/rest/v1/hotel_reservations?id=eq.$resId", accessToken, body)).execute().use { resp ->
            if (!resp.isSuccessful) return "Statut réservation refusé (${resp.code})"
        }
        if (!roomId.isNullOrBlank()) {
            val roomStatus = when (newStatus) {
                "in_progress" -> "occupied"
                "confirmed" -> "reserved"
                "completed" -> "cleaning"
                "cancelled" -> "available"
                else -> null
            }
            if (roomStatus != null) {
                updateHotelRoomStatus(accessToken, estId, roomId, roomStatus)
            }
        }
        return null
    }

    fun fetchReservations(accessToken: String, estId: String): List<ReservationRow> {
        val url =
            "/rest/v1/restaurant_reservations?establishment_id=eq.$estId&select=id,table_id,customer_name,phone,party_size,reservation_time,status,notes&order=reservation_time.desc&limit=80"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ReservationRow(
                            id = o.optString("id"),
                            tableId = o.optString("table_id").ifBlank { null },
                            customerName = o.optString("customer_name"),
                            phone = o.optString("phone").ifBlank { null },
                            partySize = o.optInt("party_size", 2),
                            reservationTime = o.optString("reservation_time"),
                            status = o.optString("status", "confirmed"),
                            notes = o.optString("notes").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun upsertReservation(
        accessToken: String,
        estId: String,
        userId: String,
        existingId: String?,
        customerName: String,
        phone: String?,
        partySize: Int,
        reservationTime: String,
        tableId: String?,
        status: String,
        notes: String?,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("customer_name", customerName.trim())
            .put("phone", phone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("party_size", partySize.coerceAtLeast(1))
            .put("reservation_time", reservationTime)
            .put("table_id", tableId?.ifBlank { null } ?: JSONObject.NULL)
            .put("status", status)
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("created_by", userId)
            .toString()
        val req = if (existingId == null) post("/rest/v1/restaurant_reservations", accessToken, body)
        else patch("/rest/v1/restaurant_reservations?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Réservation refusée (${resp.code})"
        }
    }

    // ---------- Clients, Fournisseurs & Achats ----------

    fun fetchCustomers(accessToken: String, estId: String): List<CustomerRow> {
        val url =
            "/rest/v1/customers?establishment_id=eq.$estId&select=id,establishment_id,name,phone,email,notes,total_visits,total_spent,loyalty_points&order=total_spent.desc&limit=200"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        CustomerRow(
                            id = o.optString("id"),
                            establishmentId = o.optString("establishment_id"),
                            name = o.optString("name"),
                            phone = o.optString("phone").ifBlank { null },
                            email = o.optString("email").ifBlank { null },
                            notes = o.optString("notes").ifBlank { null },
                            totalVisits = o.optInt("total_visits", 0),
                            totalSpent = o.optDouble("total_spent", 0.0),
                            loyaltyPoints = o.optInt("loyalty_points", 0),
                        ),
                    )
                }
            }
        }
    }

    fun upsertCustomer(
        accessToken: String,
        estId: String,
        existingId: String?,
        name: String,
        phone: String?,
        email: String?,
        notes: String?,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("phone", phone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("email", email?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .toString()
        val req = if (existingId == null) post("/rest/v1/customers", accessToken, body)
        else patch("/rest/v1/customers?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Client non enregistré (${resp.code})"
        }
    }

    fun deleteCustomer(accessToken: String, customerId: String): String? {
        client.newCall(delete("/rest/v1/customers?id=eq.$customerId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    fun fetchSuppliers(accessToken: String, estId: String): List<SupplierRow> {
        val url =
            "/rest/v1/suppliers?establishment_id=eq.$estId&select=id,establishment_id,name,contact_person,phone,email,address,notes&order=name.asc&limit=200"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SupplierRow(
                            id = o.optString("id"),
                            establishmentId = o.optString("establishment_id"),
                            name = o.optString("name"),
                            contactPerson = o.optString("contact_person").ifBlank { null },
                            phone = o.optString("phone").ifBlank { null },
                            email = o.optString("email").ifBlank { null },
                            address = o.optString("address").ifBlank { null },
                            notes = o.optString("notes").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun upsertSupplier(
        accessToken: String,
        estId: String,
        existingId: String?,
        name: String,
        contactPerson: String?,
        phone: String?,
        email: String?,
        address: String?,
        notes: String?,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("contact_person", contactPerson?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("phone", phone?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("email", email?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("address", address?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .toString()
        val req = if (existingId == null) post("/rest/v1/suppliers", accessToken, body)
        else patch("/rest/v1/suppliers?id=eq.$existingId", accessToken, body)
        client.newCall(req).execute().use { resp ->
            return if (resp.isSuccessful) null else "Fournisseur non enregistré (${resp.code})"
        }
    }

    fun deleteSupplier(accessToken: String, supplierId: String): String? {
        client.newCall(delete("/rest/v1/suppliers?id=eq.$supplierId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    fun fetchPurchases(accessToken: String, estId: String, limit: Int = 60): List<PurchaseRow> {
        val url =
            "/rest/v1/purchases?establishment_id=eq.$estId&select=id,establishment_id,supplier_id,product_id,qty,unit_cost,total,status,notes,created_at&order=created_at.desc&limit=$limit"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        PurchaseRow(
                            id = o.optString("id"),
                            establishmentId = o.optString("establishment_id"),
                            supplierId = o.optString("supplier_id").ifBlank { null },
                            productId = o.optString("product_id").ifBlank { null },
                            qty = o.optDouble("qty", 0.0),
                            unitCost = o.optDouble("unit_cost", 0.0),
                            total = o.optDouble("total", 0.0),
                            status = o.optString("status", "received"),
                            notes = o.optString("notes").ifBlank { null },
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    fun createPurchaseAndRestock(
        accessToken: String,
        estId: String,
        userId: String,
        product: Product,
        supplierId: String?,
        qty: Double,
        unitCost: Double,
        notes: String?,
    ): String? {
        if (qty <= 0) return "Quantité invalide"
        val total = qty * unitCost
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("supplier_id", supplierId?.ifBlank { null } ?: JSONObject.NULL)
            .put("product_id", product.id)
            .put("qty", qty)
            .put("unit_cost", unitCost)
            .put("total", total)
            .put("status", "received")
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("created_by", userId)
            .toString()
        client.newCall(post("/rest/v1/purchases", accessToken, body)).execute().use { resp ->
            if (!resp.isSuccessful) return "Achat refusé (${resp.code})"
        }
        val upd = JSONObject()
            .put("stock", product.stock + qty)
            .put("cost", if (unitCost > 0) unitCost else product.cost)
            .toString()
        client.newCall(patch("/rest/v1/products?id=eq.${product.id}", accessToken, upd)).execute().use { }
        return null
    }

    fun deletePurchase(accessToken: String, purchaseId: String): String? {
        client.newCall(delete("/rest/v1/purchases?id=eq.$purchaseId", accessToken)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Suppression refusée (${resp.code})"
        }
    }

    // ---------- Comptabilité & Mode Patron ----------

    fun fetchDailyReportsRange(accessToken: String, estId: String, fromDate: String): List<DailyReportRow> {
        val url =
            "/rest/v1/daily_reports?establishment_id=eq.$estId&date=gte.${enc(fromDate)}&select=id,date,total_sales,total_expenses,cash,mobile_money,notes,sent_at,losses,broken&order=date.desc&limit=120"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        DailyReportRow(
                            id = o.optString("id"),
                            date = o.optString("date"),
                            totalSales = o.optDouble("total_sales", 0.0),
                            totalExpenses = o.optDouble("total_expenses", 0.0),
                            cash = o.optDouble("cash", 0.0),
                            mobileMoney = o.optDouble("mobile_money", 0.0),
                            notes = o.optString("notes").ifBlank { null },
                            sentAt = o.optString("sent_at").ifBlank { null },
                            losses = o.optDouble("losses", 0.0),
                            broken = o.optDouble("broken", 0.0),
                        ),
                    )
                }
            }
        }
    }

    fun postPatronValidation(
        accessToken: String,
        estId: String,
        userId: String,
        actorName: String,
        dateStr: String,
    ): String? {
        val notif = JSONObject()
            .put("user_id", userId)
            .put("establishment_id", estId)
            .put("title", "Point validé par le patron")
            .put("message", "$actorName a validé le point du $dateStr.")
            .put("type", "patron_validation")
            .put("read", false)
            .toString()
        client.newCall(post("/rest/v1/notifications", accessToken, notif)).execute().use { }
        val audit = JSONObject()
            .put("establishment_id", estId)
            .put("actor_id", userId)
            .put("actor_name", actorName)
            .put("action", "patron.validate_report")
            .put("entity_type", "daily_report")
            .put("entity_label", dateStr)
            .put("reason", "Validation Mode Patron")
            .toString()
        client.newCall(post("/rest/v1/operation_audit", accessToken, audit)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Validation enregistrée localement"
        }
    }

    // ---------- Chat Interne, Notifications & Planning ----------

    fun fetchGroupMessages(accessToken: String, estId: String): List<ChatMessageRow> {
        val url =
            "/rest/v1/chat_messages?establishment_id=eq.$estId&select=id,sender_id,sender_name,message,created_at&order=created_at.asc&limit=150"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ChatMessageRow(
                            id = o.optString("id"),
                            senderId = o.optString("sender_id"),
                            senderName = o.optString("sender_name").ifBlank { null },
                            message = o.optString("message"),
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    fun sendGroupMessage(accessToken: String, estId: String, userId: String, senderName: String, message: String): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("sender_id", userId)
            .put("sender_name", senderName)
            .put("message", message.trim())
            .toString()
        client.newCall(post("/rest/v1/chat_messages", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Envoi échoué (${resp.code})"
        }
    }

    fun fetchDirectMessages(accessToken: String, myUserId: String, peerUserId: String): List<ChatMessageRow> {
        val orExpr = enc("and(sender_id.eq.$myUserId,recipient_id.eq.$peerUserId),and(sender_id.eq.$peerUserId,recipient_id.eq.$myUserId)")
        val url = "/rest/v1/direct_messages?or=($orExpr)&select=id,sender_id,recipient_id,sender_name,message,created_at&order=created_at.asc&limit=200"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ChatMessageRow(
                            id = o.optString("id"),
                            senderId = o.optString("sender_id"),
                            senderName = o.optString("sender_name").ifBlank { null },
                            recipientId = o.optString("recipient_id").ifBlank { null },
                            message = o.optString("message"),
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    fun sendDirectMessage(
        accessToken: String,
        estId: String?,
        userId: String,
        peerUserId: String,
        senderName: String,
        message: String,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId ?: JSONObject.NULL)
            .put("sender_id", userId)
            .put("recipient_id", peerUserId)
            .put("sender_name", senderName)
            .put("message", message.trim())
            .toString()
        client.newCall(post("/rest/v1/direct_messages", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Envoi DM échoué (${resp.code})"
        }
    }

    fun fetchNotifications(accessToken: String, userId: String): List<NotificationRow> {
        val url =
            "/rest/v1/notifications?user_id=eq.$userId&select=id,title,message,type,read,link,created_at&order=created_at.desc&limit=80"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        NotificationRow(
                            id = o.optString("id"),
                            title = o.optString("title"),
                            message = o.optString("message").ifBlank { null },
                            type = o.optString("type").ifBlank { null },
                            read = o.optBoolean("read", false),
                            link = o.optString("link").ifBlank { null },
                            createdAt = o.optString("created_at"),
                        ),
                    )
                }
            }
        }
    }

    fun markNotificationRead(accessToken: String, id: String) {
        try {
            client.newCall(patch("/rest/v1/notifications?id=eq.$id", accessToken, JSONObject().put("read", true).toString()))
                .execute().use { }
        } catch (_: Exception) { }
    }

    fun markAllNotificationsRead(accessToken: String, userId: String) {
        try {
            client.newCall(
                patch(
                    "/rest/v1/notifications?user_id=eq.$userId&read=eq.false",
                    accessToken,
                    JSONObject().put("read", true).toString(),
                ),
            ).execute().use { }
        } catch (_: Exception) { }
    }

    fun deleteNotification(accessToken: String, id: String) {
        try {
            client.newCall(delete("/rest/v1/notifications?id=eq.$id", accessToken)).execute().use { }
        } catch (_: Exception) { }
    }

    fun fetchShifts(accessToken: String, estId: String, startIso: String, endIso: String): List<ShiftRow> {
        val url =
            "/rest/v1/shifts?establishment_id=eq.$estId&start_time=gte.${enc(startIso)}&start_time=lt.${enc(endIso)}&select=id,employee_id,start_time,end_time,status,notes&order=start_time.asc"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ShiftRow(
                            id = o.optString("id"),
                            employeeId = o.optString("employee_id"),
                            startTime = o.optString("start_time"),
                            endTime = o.optString("end_time"),
                            status = o.optString("status", "scheduled"),
                            notes = o.optString("notes").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun createShift(
        accessToken: String,
        estId: String,
        employeeId: String,
        startIso: String,
        endIso: String,
        notes: String?,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("employee_id", employeeId)
            .put("start_time", startIso)
            .put("end_time", endIso)
            .put("status", "scheduled")
            .put("notes", notes?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .toString()
        client.newCall(post("/rest/v1/shifts", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Création shift refusée (${resp.code})"
        }
    }

    fun updateShiftStatus(accessToken: String, shiftId: String, status: String): String? {
        val body = JSONObject().put("status", status).toString()
        client.newCall(patch("/rest/v1/shifts?id=eq.$shiftId", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Maj shift refusée (${resp.code})"
        }
    }

    // ---------- Transfert de Stock Inter-Sites ----------

    fun transferStockBetweenSites(
        accessToken: String,
        sourceEstId: String,
        targetEstId: String,
        targetEstName: String,
        userId: String,
        actorName: String,
        lines: List<Pair<Product, Double>>,
    ): String? {
        if (sourceEstId == targetEstId) return "Choisissez un établissement cible différent."
        if (lines.isEmpty()) return "Aucun article à transférer."
        val targetProducts = fetchProducts(accessToken, targetEstId)
        for ((srcProd, qty) in lines) {
            if (qty <= 0 || qty > srcProd.stock) continue
            // 1. Déduire source
            client.newCall(
                patch(
                    "/rest/v1/products?id=eq.${srcProd.id}",
                    accessToken,
                    JSONObject().put("stock", maxOf(0.0, srcProd.stock - qty)).toString(),
                ),
            ).execute().use { }
            // 2. Incrémenter ou créer cible
            val match = targetProducts.find { it.name.equals(srcProd.name, ignoreCase = true) }
            if (match != null) {
                client.newCall(
                    patch(
                        "/rest/v1/products?id=eq.${match.id}",
                        accessToken,
                        JSONObject().put("stock", match.stock + qty).toString(),
                    ),
                ).execute().use { }
            } else {
                upsertProduct(
                    accessToken = accessToken,
                    estId = targetEstId,
                    existingId = null,
                    name = srcProd.name,
                    category = srcProd.category,
                    price = srcProd.price,
                    cost = srcProd.cost,
                    stock = qty,
                    minStock = srcProd.minStock,
                    unit = srcProd.unit,
                    unitsPerPackage = srcProd.unitsPerPackage,
                )
            }
            // 3. Journaliser mouvements
            val mOut = JSONObject()
                .put("establishment_id", sourceEstId)
                .put("product_id", srcProd.id)
                .put("product_name", srcProd.name)
                .put("qty", -qty)
                .put("movement_type", "transfer_out")
                .put("reason", "transfert vers $targetEstName")
                .put("created_by", userId)
                .toString()
            try { client.newCall(post("/rest/v1/stock_movements", accessToken, mOut)).execute().use { } } catch (_: Exception) { }
        }
        val audit = JSONObject()
            .put("establishment_id", sourceEstId)
            .put("actor_id", userId)
            .put("actor_name", actorName)
            .put("action", "stock.transfer")
            .put("entity_type", "establishment")
            .put("entity_id", targetEstId)
            .put("entity_label", targetEstName)
            .put("reason", "Transfert ${lines.size} réf. vers $targetEstName")
            .toString()
        try { client.newCall(post("/rest/v1/operation_audit", accessToken, audit)).execute().use { } } catch (_: Exception) { }
        return null
    }

    // ---------- Kits & Promos ----------

    fun fetchKits(accessToken: String, estId: String): List<ProductKitRow> {
        val url = "/rest/v1/product_kits?establishment_id=eq.$estId&select=id,name,description,price,active&order=created_at.desc"
        val kits = client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        ProductKitRow(
                            id = o.optString("id"),
                            name = o.optString("name"),
                            description = o.optString("description").ifBlank { null },
                            price = o.optDouble("price", 0.0),
                            active = o.optBoolean("active", true),
                        ),
                    )
                }
            }
        }
        if (kits.isEmpty()) return kits
        val ids = kits.joinToString(",") { it.id }
        val itemsByKit = mutableMapOf<String, MutableList<ProductKitItemRow>>()
        try {
            client.newCall(get("/rest/v1/product_kit_items?kit_id=in.($ids)&select=id,kit_id,product_id,product_name,qty,unit_price", accessToken))
                .execute().use { resp ->
                    if (resp.isSuccessful) {
                        val arr = JSONArray(resp.body?.string().orEmpty())
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            val kid = o.optString("kit_id")
                            itemsByKit.getOrPut(kid) { mutableListOf() }.add(
                                ProductKitItemRow(
                                    id = o.optString("id"),
                                    kitId = kid,
                                    productId = o.optString("product_id").ifBlank { null },
                                    productName = o.optString("product_name"),
                                    qty = o.optInt("qty", 1),
                                    unitPrice = o.optDouble("unit_price", 0.0),
                                ),
                            )
                        }
                    }
                }
        } catch (_: Exception) { }
        return kits.map { it.copy(items = itemsByKit[it.id].orEmpty()) }
    }

    fun createKit(
        accessToken: String,
        estId: String,
        name: String,
        description: String?,
        price: Double,
        items: List<Pair<Product, Int>>,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("description", description?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("price", price)
            .put("active", true)
            .toString()
        client.newCall(post("/rest/v1/product_kits", accessToken, body, "return=representation")).execute().use { resp ->
            if (!resp.isSuccessful) return "Kit non enregistré (${resp.code})"
            val arr = JSONArray(resp.body?.string().orEmpty())
            val kitId = arr.optJSONObject(0)?.optString("id").orEmpty()
            if (kitId.isNotBlank() && items.isNotEmpty()) {
                val itemsArr = JSONArray()
                for ((p, q) in items) {
                    itemsArr.put(
                        JSONObject()
                            .put("kit_id", kitId)
                            .put("product_id", p.id)
                            .put("product_name", p.name)
                            .put("qty", q)
                            .put("unit_price", p.price),
                    )
                }
                client.newCall(post("/rest/v1/product_kit_items", accessToken, itemsArr.toString())).execute().use { }
            }
            return null
        }
    }

    fun toggleKitActive(accessToken: String, kitId: String, active: Boolean) {
        try {
            client.newCall(patch("/rest/v1/product_kits?id=eq.$kitId", accessToken, JSONObject().put("active", active).toString()))
                .execute().use { }
        } catch (_: Exception) { }
    }

    fun deleteKit(accessToken: String, kitId: String) {
        try {
            client.newCall(delete("/rest/v1/product_kits?id=eq.$kitId", accessToken)).execute().use { }
        } catch (_: Exception) { }
    }

    fun fetchPromos(accessToken: String, estId: String): List<PromotionRow> {
        val url =
            "/rest/v1/promotions?establishment_id=eq.$estId&select=id,name,description,promo_type,value,product_id,buy_qty,get_qty,active&order=created_at.desc"
        client.newCall(get(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val arr = JSONArray(resp.body?.string().orEmpty())
            return buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        PromotionRow(
                            id = o.optString("id"),
                            name = o.optString("name"),
                            description = o.optString("description").ifBlank { null },
                            promoType = o.optString("promo_type", "percent"),
                            value = o.optDouble("value", 0.0),
                            productId = o.optString("product_id").ifBlank { null },
                            buyQty = if (o.isNull("buy_qty")) null else o.optInt("buy_qty"),
                            getQty = if (o.isNull("get_qty")) null else o.optInt("get_qty"),
                            active = o.optBoolean("active", true),
                        ),
                    )
                }
            }
        }
    }

    fun createPromo(
        accessToken: String,
        estId: String,
        name: String,
        description: String?,
        promoType: String,
        value: Double,
        productId: String?,
        buyQty: Int?,
        getQty: Int?,
    ): String? {
        val body = JSONObject()
            .put("establishment_id", estId)
            .put("name", name.trim())
            .put("description", description?.trim()?.ifBlank { null } ?: JSONObject.NULL)
            .put("promo_type", promoType)
            .put("value", value)
            .put("product_id", productId?.ifBlank { null } ?: JSONObject.NULL)
            .put("buy_qty", buyQty ?: JSONObject.NULL)
            .put("get_qty", getQty ?: JSONObject.NULL)
            .put("active", true)
            .toString()
        client.newCall(post("/rest/v1/promotions", accessToken, body)).execute().use { resp ->
            return if (resp.isSuccessful) null else "Promo non enregistrée (${resp.code})"
        }
    }

    fun togglePromoActive(accessToken: String, promoId: String, active: Boolean) {
        try {
            client.newCall(patch("/rest/v1/promotions?id=eq.$promoId", accessToken, JSONObject().put("active", active).toString()))
                .execute().use { }
        } catch (_: Exception) { }
    }

    fun deletePromo(accessToken: String, promoId: String) {
        try {
            client.newCall(delete("/rest/v1/promotions?id=eq.$promoId", accessToken)).execute().use { }
        } catch (_: Exception) { }
    }
}
