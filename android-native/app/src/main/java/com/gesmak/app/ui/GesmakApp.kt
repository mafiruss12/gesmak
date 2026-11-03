package com.gesmak.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.gesmak.app.data.LocalSalesStore
import com.gesmak.app.data.NotifyHelper
import com.gesmak.app.data.SessionStore
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.screens.HomeDashboard
import com.gesmak.app.ui.screens.InventoryScreen
import com.gesmak.app.ui.screens.LoginScreen
import com.gesmak.app.ui.screens.OrdersScreen
import com.gesmak.app.ui.screens.SalesScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun GesmakApp() {
    val context = LocalContext.current
    val store = remember { SessionStore(context.applicationContext) }
    val salesStore = remember { LocalSalesStore(context.applicationContext) }
    val auth = remember { SupabaseAuth() }
    val api = remember { SupabaseApi() }
    val session by store.session.collectAsState(initial = null)
    val scope = rememberCoroutineScope()

    var member by remember { mutableStateOf<SupabaseApi.Member?>(null) }
    var establishment by remember { mutableStateOf<SupabaseApi.Establishment?>(null) }
    var products by remember { mutableStateOf<List<SupabaseApi.Product>>(emptyList()) }
    var orders by remember { mutableStateOf<List<SupabaseApi.OrderRow>>(emptyList()) }
    var loadingData by remember { mutableStateOf(false) }
    var dataError by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableIntStateOf(0) }
    var busyOrderId by remember { mutableStateOf<String?>(null) }
    var knownOrderIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var estIdResolved by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* granted or not */ }

    LaunchedEffect(Unit) {
        NotifyHelper.ensureChannel(context)
        if (Build.VERSION.SDK_INT >= 33) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun refreshData() {
        val s = session ?: return
        scope.launch {
            loadingData = true
            dataError = null
            try {
                withContext(Dispatchers.IO) {
                    val m = api.fetchMember(s.accessToken, s.userId)
                    member = m
                    var eid = m?.establishmentId
                    if (eid.isNullOrBlank()) {
                        eid = api.fetchLinkedEstablishmentId(s.accessToken, s.userId)
                    }
                    estIdResolved = eid
                    if (!eid.isNullOrBlank()) {
                        establishment = api.fetchEstablishment(s.accessToken, eid)
                        products = api.fetchProducts(s.accessToken, eid)
                        val newOrders = api.fetchOpenOrders(s.accessToken, eid)
                        // Notify on new pending orders
                        val pendingIds = newOrders.filter { it.status == "pending" }.map { it.id }.toSet()
                        val brandNew = pendingIds - knownOrderIds
                        if (knownOrderIds.isNotEmpty() && brandNew.isNotEmpty()) {
                            val first = newOrders.firstOrNull { it.id in brandNew }
                            withContext(Dispatchers.Main) {
                                NotifyHelper.showOrder(
                                    context,
                                    "Nouvelle commande",
                                    "${first?.customerName ?: "Client"} · ${first?.total?.toLong() ?: 0} F",
                                    id = brandNew.first().hashCode(),
                                )
                            }
                        }
                        knownOrderIds = knownOrderIds + newOrders.map { it.id }
                        orders = newOrders
                    } else {
                        establishment = null
                        products = emptyList()
                        orders = emptyList()
                    }
                }
            } catch (e: Exception) {
                dataError = e.message
            } finally {
                loadingData = false
            }
        }
    }

    LaunchedEffect(session?.accessToken, session?.userId) {
        if (session != null) {
            knownOrderIds = emptySet()
            refreshData()
        } else {
            member = null
            establishment = null
            products = emptyList()
            orders = emptyList()
            estIdResolved = null
        }
    }

    // Poll commandes toutes les 25s quand connecté
    LaunchedEffect(session?.accessToken) {
        if (session == null) return@LaunchedEffect
        while (isActive) {
            delay(25_000)
            if (session != null) refreshData()
        }
    }

    if (session == null) {
        LoginScreen(
            authConfigured = auth.isConfigured,
            onLogin = { login, password, onResult ->
                scope.launch {
                    val res = withContext(Dispatchers.IO) { auth.signIn(login, password) }
                    if (res.ok && res.session != null) {
                        store.save(res.session)
                        onResult(null)
                    } else {
                        onResult(res.error ?: "Connexion impossible")
                    }
                }
            },
        )
        return
    }

    val amber = Color(0xFFF59E0B)
    Scaffold(
        containerColor = Color(0xFF0C0A09),
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF1C1917), contentColor = Color.White) {
                val items = listOf(
                    Triple(0, "Accueil", Icons.Default.Home),
                    Triple(1, "Stock", Icons.Default.Inventory2),
                    Triple(2, "Commandes", Icons.Default.ReceiptLong),
                    Triple(3, "Caisse", Icons.Default.ShoppingCart),
                )
                items.forEach { (i, label, icon) ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { tab = i },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = amber,
                            selectedTextColor = amber,
                            indicatorColor = Color(0xFF292524),
                            unselectedIconColor = Color(0xFFA8A29E),
                            unselectedTextColor = Color(0xFFA8A29E),
                        ),
                    )
                }
            }
        },
    ) { padding ->
        val pageMod = Modifier.padding(padding)
        when (tab) {
            0 -> HomeDashboard(
                mod = pageMod,
                memberName = member?.fullName ?: session?.email.orEmpty(),
                role = member?.role ?: "—",
                estName = establishment?.name,
                productCount = products.size,
                openOrders = orders.size,
                loading = loadingData,
                error = dataError,
                onRefresh = { refreshData() },
                onLogout = { scope.launch { store.clear() } },
            )
            1 -> InventoryScreen(
                mod = pageMod,
                products = products,
                loading = loadingData,
                onRefresh = { refreshData() },
            )
            2 -> OrdersScreen(
                mod = pageMod,
                orders = orders,
                loading = loadingData,
                busyId = busyOrderId,
                onRefresh = { refreshData() },
                onAdvance = { orderId, next ->
                    val s = session ?: return@OrdersScreen
                    scope.launch {
                        busyOrderId = orderId
                        val ok = withContext(Dispatchers.IO) {
                            api.updateOrderStatus(s.accessToken, orderId, next)
                        }
                        busyOrderId = null
                        if (ok) refreshData()
                        else dataError = "Impossible de mettre à jour la commande"
                    }
                },
            )
            else -> SalesScreen(
                mod = pageMod,
                products = products,
                estId = estIdResolved,
                salesStore = salesStore,
                onRefresh = { refreshData() },
            )
        }
    }
}
