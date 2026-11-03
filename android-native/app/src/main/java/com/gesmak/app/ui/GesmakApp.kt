package com.gesmak.app.ui
import androidx.compose.ui.modifier.Modifier
import androidx.compose.ui.Modifier.modifier

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
import com.gesmak.app.data.SessionStore
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.screens.HomeDashboard
import com.gesmak.app.ui.screens.InventoryScreen
import com.gesmak.app.ui.screens.LoginScreen
import com.gesmak.app.ui.screens.OrdersScreen
import com.gesmak.app.ui.screens.SalesScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun GesmakApp() {
    val context = LocalContext.current
    val store = remember { SessionStore(context.applicationContext) }
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

    fun refreshData() {
        val s = session ?: return
        scope.launch {
            loadingData = true
            dataError = null
            try {
                withContext(Dispatchers.IO) {
                    val m = api.fetchMember(s.accessToken, s.userId)
                    member = m
                    val eid = m?.establishmentId
                    if (!eid.isNullOrBlank()) {
                        establishment = api.fetchEstablishment(s.accessToken, eid)
                        products = api.fetchProducts(s.accessToken, eid)
                        orders = api.fetchOpenOrders(s.accessToken, eid)
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
        if (session != null) refreshData()
        else {
            member = null
            establishment = null
            products = emptyList()
            orders = emptyList()
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
        val mod = Modifier.padding(padding)
        when (tab) {
            0 -> HomeDashboard(
                modifier = mod,
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
                modifier = mod,
                products = products,
                loading = loadingData,
                onRefresh = { refreshData() },
            )
            2 -> OrdersScreen(
                modifier = mod,
                orders = orders,
                loading = loadingData,
                onRefresh = { refreshData() },
            )
            else -> SalesScreen(
                modifier = mod,
                products = products,
                onRefresh = { refreshData() },
            )
        }
    }
}
