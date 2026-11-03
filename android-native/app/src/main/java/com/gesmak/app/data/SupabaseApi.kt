package com.gesmak.app.data

import com.gesmak.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
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
        val userId: String,
        val fullName: String,
        val role: String,
        val establishmentId: String?,
        val email: String?,
    )

    data class Establishment(val id: String, val name: String, val type: String?)
    data class Product(val id: String, val name: String, val price: Double, val stock: Double, val category: String?)
    data class OrderRow(
        val id: String,
        val status: String,
        val total: Double,
        val createdAt: String,
        val customerName: String?,
        val tableNumber: String?,
    )

    private fun authRequest(pathAndQuery: String, accessToken: String): Request =
        Request.Builder()
            .url("$baseUrl$pathAndQuery")
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .get()
            .build()

    fun fetchMember(accessToken: String, userId: String): Member? {
        val url =
            "/rest/v1/members?user_id=eq.$userId&select=user_id,full_name,role,establishment_id,email&limit=1"
        client.newCall(authRequest(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            val o = arr.getJSONObject(0)
            return Member(
                userId = o.optString("user_id"),
                fullName = o.optString("full_name"),
                role = o.optString("role", "owner"),
                establishmentId = o.optString("establishment_id").ifBlank { null },
                email = o.optString("email").ifBlank { null },
            )
        }
    }

    fun fetchEstablishment(accessToken: String, id: String): Establishment? {
        val url = "/rest/v1/establishments?id=eq.$id&select=id,name,type,business_type&limit=1"
        client.newCall(authRequest(url, accessToken)).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val arr = JSONArray(resp.body?.string().orEmpty())
            if (arr.length() == 0) return null
            val o = arr.getJSONObject(0)
            return Establishment(
                id = o.getString("id"),
                name = o.optString("name"),
                type = o.optString("type").ifBlank { o.optString("business_type") }.ifBlank { null },
            )
        }
    }

    fun fetchProducts(accessToken: String, estId: String): List<Product> {
        val url =
            "/rest/v1/products?establishment_id=eq.$estId&select=id,name,price,stock,category&order=name.asc&limit=200"
        client.newCall(authRequest(url, accessToken)).execute().use { resp ->
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
                            category = o.optString("category").ifBlank { null },
                        ),
                    )
                }
            }
        }
    }

    fun fetchOpenOrders(accessToken: String, estId: String): List<OrderRow> {
        val url =
            "/rest/v1/orders?establishment_id=eq.$estId&status=in.(pending,preparing,ready)&select=id,status,total,created_at,customer_name,table_number&order=created_at.desc&limit=50"
        client.newCall(authRequest(url, accessToken)).execute().use { resp ->
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
                        ),
                    )
                }
            }
        }
    }
}
