package com.gesmak.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.gesmak.app.BuildConfig
import com.gesmak.app.R
import com.gesmak.app.data.LocalSalesStore
import com.gesmak.app.data.NotifyHelper
import com.gesmak.app.data.OfflineCache
import com.gesmak.app.data.OfflineQueue
import com.gesmak.app.data.RemoteVersion
import com.gesmak.app.data.SessionStore
import com.gesmak.app.data.SupabaseApi
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.data.UpdateChecker
import com.gesmak.app.ui.components.StatusPill
import com.gesmak.app.ui.screens.AppRoute
import com.gesmak.app.ui.screens.ArrivalScreen
import com.gesmak.app.ui.screens.ChatScreen
import com.gesmak.app.ui.screens.ClotureScreen
import com.gesmak.app.ui.screens.CrmSupplyScreen
import com.gesmak.app.ui.screens.EstChoice
import com.gesmak.app.ui.screens.ExpensesScreen
import com.gesmak.app.ui.screens.FinancePatronScreen
import com.gesmak.app.ui.screens.HomeDashboard
import com.gesmak.app.ui.screens.InventoryScreen
import com.gesmak.app.ui.screens.KitsPromosScreen
import com.gesmak.app.ui.screens.LoginScreen
import com.gesmak.app.ui.screens.NotificationsScreen
import com.gesmak.app.ui.screens.OrdersScreen
import com.gesmak.app.ui.screens.PlanningAndServiceScreen
import com.gesmak.app.ui.screens.PointManuelScreen
import com.gesmak.app.ui.screens.PowersScreen
import com.gesmak.app.ui.screens.QrOrderScreen
import com.gesmak.app.ui.screens.ReportsScreen
import com.gesmak.app.ui.screens.SalesScreen
import com.gesmak.app.ui.screens.SettingsScreen
import com.gesmak.app.ui.screens.SplashScreen
import com.gesmak.app.ui.screens.StockTransferScreen
import com.gesmak.app.ui.screens.TablesKitchenScreen
import com.gesmak.app.ui.screens.TeamScreen
import com.gesmak.app.ui.theme.GesmakTheme
import com.gesmak.app.ui.theme.LocalGesmakColors
import com.gesmak.app.ui.theme.poleColorHex
import com.gesmak.app.ui.theme.poleLabelFr
import com.gesmak.app.ui.theme.roleLabelFr
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private data class DrawerNavItem(
    val route: Int,
    val label: String,
    val icon: ImageVector,
)

@Composable
fun GesmakApp() {
    val context = LocalContext.current
    val store = remember { SessionStore(context.applicationContext) }
    val salesStore = remember { LocalSalesStore(context.applicationContext) }
    val offlineQ = remember { OfflineQueue(context.applicationContext) }
    val offlineCache = remember { OfflineCache(context.applicationContext) }
    val updateChecker = remember { UpdateChecker(context.applicationContext) }
    val auth = remember { SupabaseAuth() }
    val api = remember { SupabaseApi() }

    val session by store.session.collectAsState(initial = null)
    val isLightTheme by store.isLightTheme.collectAsState(initial = true)
    val orderSound by store.orderSoundEnabled.collectAsState(initial = true)
    val storedEstId by store.activeEstId.collectAsState(initial = null)
    val storedPole by store.selectedPole.collectAsState(initial = null)
    val scope = rememberCoroutineScope()

    var splashDone by remember { mutableStateOf(false) }

    var member by remember { mutableStateOf<SupabaseApi.Member?>(null) }
    var establishment by remember { mutableStateOf<SupabaseApi.Establishment?>(null) }
    var poles by remember { mutableStateOf<List<SupabaseApi.EstablishmentPole>>(emptyList()) }
    var allPoles by remember { mutableStateOf<List<SupabaseApi.EstablishmentPole>>(emptyList()) }
    var teamMembers by remember { mutableStateOf<List<SupabaseApi.Member>>(emptyList()) }
    var employees by remember { mutableStateOf<List<SupabaseApi.EmployeeRow>>(emptyList()) }
    var products by remember { mutableStateOf<List<SupabaseApi.Product>>(emptyList()) }
    var orders by remember { mutableStateOf<List<SupabaseApi.OrderRow>>(emptyList()) }
    var expenses by remember { mutableStateOf<List<SupabaseApi.ExpenseRow>>(emptyList()) }
    var tables by remember { mutableStateOf<List<SupabaseApi.RestaurantTableRow>>(emptyList()) }
    var serviceDay by remember { mutableStateOf<SupabaseApi.ServiceDayRow?>(null) }
    var cashSession by remember { mutableStateOf<SupabaseApi.CashSessionRow?>(null) }
    var cashHistory by remember { mutableStateOf<List<SupabaseApi.CashSessionRow>>(emptyList()) }
    var audits by remember { mutableStateOf<List<SupabaseApi.AuditRow>>(emptyList()) }
    var todaySalesList by remember { mutableStateOf<List<SupabaseApi.SaleSummaryRow>>(emptyList()) }
    var sales30d by remember { mutableStateOf<List<SupabaseApi.SaleSummaryRow>>(emptyList()) }
    var customers by remember { mutableStateOf<List<SupabaseApi.CustomerRow>>(emptyList()) }
    var suppliers by remember { mutableStateOf<List<SupabaseApi.SupplierRow>>(emptyList()) }
    var purchases by remember { mutableStateOf<List<SupabaseApi.PurchaseRow>>(emptyList()) }
    var dailyReports by remember { mutableStateOf<List<SupabaseApi.DailyReportRow>>(emptyList()) }
    var menuCategories by remember { mutableStateOf<List<SupabaseApi.MenuCategoryRow>>(emptyList()) }
    var menuItems by remember { mutableStateOf<List<SupabaseApi.MenuItemRow>>(emptyList()) }
    var reservations by remember { mutableStateOf<List<SupabaseApi.ReservationRow>>(emptyList()) }
    var groupMessages by remember { mutableStateOf<List<SupabaseApi.ChatMessageRow>>(emptyList()) }
    var dmMessages by remember { mutableStateOf<List<SupabaseApi.ChatMessageRow>>(emptyList()) }
    var selectedChatPeer by remember { mutableStateOf<SupabaseApi.Member?>(null) }
    var notifications by remember { mutableStateOf<List<SupabaseApi.NotificationRow>>(emptyList()) }
    var shifts by remember { mutableStateOf<List<SupabaseApi.ShiftRow>>(emptyList()) }
    var kits by remember { mutableStateOf<List<SupabaseApi.ProductKitRow>>(emptyList()) }
    var promos by remember { mutableStateOf<List<SupabaseApi.PromotionRow>>(emptyList()) }
    var pendingPaymentRequests by remember { mutableStateOf<List<SupabaseApi.PaymentRequestRow>>(emptyList()) }

    var loadingData by remember { mutableStateOf(false) }
    var dataError by remember { mutableStateOf<String?>(null) }
    var isOffline by remember { mutableStateOf(false) }
    var lastSyncedMs by remember { mutableLongStateOf(0L) }
    var productImageDefaults by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var activeRoute by remember { mutableIntStateOf(AppRoute.HOME) }
    var busyOrderId by remember { mutableStateOf<String?>(null) }
    var busySale by remember { mutableStateOf(false) }
    var serviceDayBusy by remember { mutableStateOf(false) }
    var clotureBusy by remember { mutableStateOf(false) }
    var clotureNotice by remember { mutableStateOf<String?>(null) }
    var clotureError by remember { mutableStateOf<String?>(null) }

    var knownOrderIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var estIdResolved by remember { mutableStateOf<String?>(null) }
    var activePole by remember { mutableStateOf<String?>(null) }
    var offlineCount by remember { mutableIntStateOf(offlineQ.size()) }
    var estChoices by remember { mutableStateOf<List<EstChoice>>(emptyList()) }

    var caDay by remember { mutableDoubleStateOf(0.0) }
    var cashSalesDay by remember { mutableDoubleStateOf(0.0) }
    var caWeek by remember { mutableDoubleStateOf(0.0) }
    var caMonth by remember { mutableDoubleStateOf(0.0) }
    var expensesDay by remember { mutableDoubleStateOf(0.0) }
    var expensesMonth by remember { mutableDoubleStateOf(0.0) }
    var recentSales by remember { mutableStateOf<List<Triple<String, Double, String>>>(emptyList()) }

    // États mise à jour in-app
    var remoteUpdate by remember { mutableStateOf<RemoteVersion?>(null) }
    var updateChecking by remember { mutableStateOf(false) }
    var updateDownloading by remember { mutableStateOf(false) }
    var updateProgress by remember { mutableIntStateOf(0) }
    var updateStatusMsg by remember { mutableStateOf<String?>(null) }
    var canInstallUnknownApps by remember { mutableStateOf(updateChecker.canRequestPackageInstalls()) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { }

    fun requestAppPermissions() {
        val perms = buildList {
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.RECORD_AUDIO)
        }.toTypedArray()
        permissionLauncher.launch(perms)
    }

    fun checkUpdates(manual: Boolean = false) {
        scope.launch {
            if (manual) {
                updateChecking = true
                updateStatusMsg = null
            }
            canInstallUnknownApps = updateChecker.canRequestPackageInstalls()
            val found = withContext(Dispatchers.IO) { updateChecker.check() }
            if (found != null && updateChecker.isUpdateAvailable(found)) {
                remoteUpdate = found
                if (manual) updateStatusMsg = "Nouvelle version disponible : v${found.versionName}"
            } else {
                if (manual) updateStatusMsg = "Vous utilisez déjà la dernière version (v${BuildConfig.VERSION_NAME})."
            }
            if (manual) updateChecking = false
        }
    }

    fun downloadAndInstallUpdate() {
        canInstallUnknownApps = updateChecker.canRequestPackageInstalls()
        if (!canInstallUnknownApps) {
            updateStatusMsg = "Activez d'abord « Sources inconnues » pour GESMAK, puis réappuyez sur Mettre à jour."
            updateChecker.openInstallPermissionSettings()
            return
        }
        val targetUrl = remoteUpdate?.apkUrl
            ?: "https://github.com/mafiruss12/gesmak/releases/download/apk-latest/GESMAK-native.apk"
        scope.launch {
            updateDownloading = true
            updateProgress = 0
            updateStatusMsg = "Téléchargement de la mise à jour..."
            try {
                val file = withContext(Dispatchers.IO) {
                    updateChecker.downloadApk(targetUrl) { pct ->
                        updateProgress = pct
                    }
                }
                updateStatusMsg = "Téléchargement terminé — lancement de l'installation..."
                updateChecker.installApk(file)
            } catch (e: Exception) {
                updateStatusMsg = SupabaseAuth.friendlyNetworkError(e, "Erreur de téléchargement.")
            } finally {
                updateDownloading = false
            }
        }
    }

    LaunchedEffect(storedPole) {
        if (activePole == null && !storedPole.isNullOrBlank()) {
            activePole = storedPole
        }
    }

    LaunchedEffect(Unit) {
        NotifyHelper.ensureChannel(context)
        if (Build.VERSION.SDK_INT >= 33) {
            permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
        checkUpdates(manual = false)
        while (isActive) {
            delay(30 * 60_000L)
            checkUpdates(manual = false)
        }
    }

    fun isoTodayDate(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun isoStartOfToday(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(cal.time)
    }

    fun isoDateDaysAgo(days: Int): String {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -days)
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
    }

    fun isoDaysAgo(days: Int): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.add(Calendar.DAY_OF_YEAR, -days)
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(cal.time)
    }

    fun isoDaysAhead(days: Int): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.add(Calendar.DAY_OF_YEAR, days)
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(cal.time)
    }

    fun isoStartOfMonth(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(cal.time)
    }

    fun drainOffline(token: String, userId: String) {
        offlineQ.drain { type, payload ->
            when (type) {
                "sale" -> {
                    val pid = payload.getString("product_id")
                    val qty = payload.getInt("qty")
                    val p = products.find { it.id == pid } ?: return@drain false
                    api.postSaleLine(
                        accessToken = token,
                        estId = payload.getString("est_id"),
                        userId = userId,
                        product = p,
                        qty = qty,
                        paymentMethod = payload.optString("payment_method", "cash"),
                        poleCode = payload.optString("pole_code").ifBlank { null },
                        cashSessionId = payload.optString("cash_session_id").ifBlank { null },
                    ) == null
                }
                "arrival" -> {
                    val pid = payload.getString("product_id")
                    val qty = payload.getInt("qty")
                    val p = products.find { it.id == pid } ?: return@drain false
                    api.postArrival(
                        token,
                        payload.getString("est_id"),
                        userId,
                        p,
                        qty,
                        payload.optString("note"),
                    ) == null
                }
                else -> true
            }
        }
        offlineCount = offlineQ.size()
    }

    fun refreshData() {
        val s = session ?: return
        scope.launch {
            loadingData = true
            dataError = null
            canInstallUnknownApps = updateChecker.canRequestPackageInstalls()
            try {
                withContext(Dispatchers.IO) {
                    drainOffline(s.accessToken, s.userId)
                    var activeToken = s.accessToken
                    var m = api.fetchMember(activeToken, s.userId)
                    // Si token expiré, tenter refresh automatique
                    if (m == null && s.refreshToken.isNotBlank()) {
                        val ref = auth.refreshSession(s.refreshToken)
                        if (ref.ok && ref.session != null) {
                            store.save(ref.session)
                            activeToken = ref.session.accessToken
                            m = api.fetchMember(activeToken, ref.session.userId)
                        }
                    }
                    if (m != null) member = m
                    val links = api.fetchAllEstablishmentLinks(activeToken, s.userId)
                    val ids = links.map { it.establishmentId }.toMutableList()
                    (m ?: member)?.establishmentId?.let { if (it !in ids) ids.add(0, it) }
                    val choices = mutableListOf<EstChoice>()
                    for (id in ids.distinct()) {
                        val est = api.fetchEstablishment(activeToken, id)
                        if (est != null) choices.add(EstChoice(est.id, est.name))
                    }
                    if (choices.isNotEmpty()) estChoices = choices

                    var eid = estIdResolved ?: storedEstId
                    if (eid.isNullOrBlank() || (choices.isNotEmpty() && choices.none { it.id == eid })) {
                        eid = choices.firstOrNull()?.id ?: (m ?: member)?.establishmentId
                            ?: api.fetchLinkedEstablishmentId(activeToken, s.userId)
                    }
                    estIdResolved = eid

                    if (!eid.isNullOrBlank()) {
                        val todayStr = isoTodayDate()
                        val todayStart = isoStartOfToday()
                        val roleLower = m?.role?.lowercase().orEmpty()
                        val locked = if (roleLower in setOf("cashier", "caissier", "caissière", "caissiere", "manager", "gérant", "gerant")) {
                            m?.assignedPoleCode
                        } else {
                            null
                        }
                        val scopedPole = locked ?: activePole

                        establishment = api.fetchEstablishment(activeToken, eid) ?: establishment
                        pendingPaymentRequests = api.fetchPendingPaymentRequests(activeToken, eid)
                        poles = api.fetchPoles(activeToken, eid, includeInactive = false)
                        allPoles = api.fetchPoles(activeToken, eid, includeInactive = true)
                        productImageDefaults = api.fetchProductImageDefaults(activeToken)
                        products = api.fetchProducts(activeToken, eid)

                        val newOrders = api.fetchOrders(activeToken, eid, limit = 80)
                        val pendingIds = newOrders.filter { it.status == "pending" }.map { it.id }.toSet()
                        val brandNew = pendingIds - knownOrderIds
                        if (knownOrderIds.isNotEmpty() && brandNew.isNotEmpty()) {
                            val first = newOrders.firstOrNull { it.id in brandNew }
                            withContext(Dispatchers.Main) {
                                NotifyHelper.showOrder(
                                    context = context,
                                    title = "Nouvelle commande",
                                    body = "${first?.customerName ?: "Client"} · ${first?.total?.toLong() ?: 0} F",
                                    id = brandNew.first().hashCode(),
                                    sound = orderSound,
                                )
                            }
                        }
                        knownOrderIds = knownOrderIds + newOrders.map { it.id }
                        orders = newOrders

                        val todaySales = api.fetchSalesSince(activeToken, eid, todayStart, scopedPole)
                        todaySalesList = todaySales
                        caDay = todaySales.sumOf { it.total }
                        cashSalesDay = todaySales.filter { it.paymentMethod == "cash" }.sumOf { it.total }
                        val allSales30 = api.fetchSalesSince(activeToken, eid, isoDaysAgo(30))
                        sales30d = allSales30
                        caWeek = api.fetchSalesTotal(activeToken, eid, isoDaysAgo(7))
                        caMonth = allSales30.sumOf { it.total }
                        recentSales = api.fetchRecentSales(activeToken, eid, 40)

                        val expList = api.fetchExpenses(activeToken, eid, 60)
                        expenses = expList
                        val todayPrefix = todayStr
                        val monthPrefix = todayStr.take(7)
                        expensesDay = expList.filter { it.createdAt.startsWith(todayPrefix) }.sumOf { it.amount }
                        expensesMonth = expList.filter { it.createdAt.startsWith(monthPrefix) }.sumOf { it.amount }

                        serviceDay = api.fetchServiceDay(activeToken, eid, todayStr)
                        cashSession = api.fetchTodayCashSession(activeToken, eid, todayStr, scopedPole)
                        cashHistory = api.fetchCashSessionHistory(activeToken, eid, scopedPole, 20)
                        tables = api.fetchTables(activeToken, eid)
                        menuCategories = api.fetchMenuCategories(activeToken, eid)
                        menuItems = api.fetchMenuItems(activeToken, eid)
                        reservations = api.fetchReservations(activeToken, eid)

                        teamMembers = api.fetchTeamMembers(activeToken, eid)
                        employees = api.fetchEmployees(activeToken, eid)
                        customers = api.fetchCustomers(activeToken, eid)
                        groupMessages = api.fetchGroupMessages(activeToken, eid)
                        notifications = api.fetchNotifications(activeToken, s.userId)
                        shifts = api.fetchShifts(activeToken, eid, isoDaysAgo(7), isoDaysAhead(14))
                        kits = api.fetchKits(activeToken, eid)
                        promos = api.fetchPromos(activeToken, eid)

                        val peer = selectedChatPeer
                        if (peer != null) {
                            dmMessages = api.fetchDirectMessages(activeToken, s.userId, peer.userId)
                        }

                        if (roleLower in setOf("owner", "propriétaire", "proprietaire", "admin", "super_admin", "manager", "gérant", "gerant")) {
                            audits = api.fetchOperationAudit(activeToken, eid, 25)
                            suppliers = api.fetchSuppliers(activeToken, eid)
                            purchases = api.fetchPurchases(activeToken, eid, 60)
                            dailyReports = api.fetchDailyReportsRange(activeToken, eid, isoDateDaysAgo(30))
                        } else {
                            audits = emptyList()
                            suppliers = emptyList()
                            purchases = emptyList()
                            dailyReports = emptyList()
                        }

                        val syncedAt = System.currentTimeMillis()
                        offlineCache.save(
                            s.userId,
                            OfflineCache.Snapshot(
                                lastSyncedMs = syncedAt,
                                estId = eid,
                                member = member,
                                establishment = establishment,
                                estChoices = estChoices,
                                poles = poles,
                                allPoles = allPoles,
                                products = products,
                                orders = orders,
                                tables = tables,
                                serviceDay = serviceDay,
                                cashSession = cashSession,
                                caDay = caDay,
                                cashSalesDay = cashSalesDay,
                                caWeek = caWeek,
                                caMonth = caMonth,
                                expensesDay = expensesDay,
                                expensesMonth = expensesMonth,
                                productImageDefaults = productImageDefaults,
                            ),
                        )
                        lastSyncedMs = syncedAt
                        isOffline = false
                    } else if (m != null) {
                        establishment = null
                        pendingPaymentRequests = emptyList()
                        poles = emptyList()
                        allPoles = emptyList()
                        products = emptyList()
                        orders = emptyList()
                        expenses = emptyList()
                        tables = emptyList()
                        serviceDay = null
                        cashSession = null
                        cashHistory = emptyList()
                        teamMembers = emptyList()
                        employees = emptyList()
                        audits = emptyList()
                        todaySalesList = emptyList()
                        sales30d = emptyList()
                        customers = emptyList()
                        suppliers = emptyList()
                        purchases = emptyList()
                        dailyReports = emptyList()
                        menuCategories = emptyList()
                        menuItems = emptyList()
                        reservations = emptyList()
                        groupMessages = emptyList()
                        dmMessages = emptyList()
                        notifications = emptyList()
                        shifts = emptyList()
                        kits = emptyList()
                        promos = emptyList()
                        isOffline = false
                    }
                }
            } catch (e: Exception) {
                if (SupabaseAuth.isNetworkError(e)) {
                    isOffline = true
                    dataError = null
                } else {
                    dataError = SupabaseAuth.friendlyNetworkError(e, "Erreur de synchronisation.")
                }
            } finally {
                loadingData = false
                offlineCount = offlineQ.size()
            }
        }
    }

    LaunchedEffect(selectedChatPeer?.userId, session?.accessToken) {
        val s = session ?: return@LaunchedEffect
        val peer = selectedChatPeer ?: return@LaunchedEffect
        dmMessages = withContext(Dispatchers.IO) {
            api.fetchDirectMessages(s.accessToken, s.userId, peer.userId)
        }
    }

    LaunchedEffect(session?.accessToken, session?.userId) {
        val cur = session
        if (cur != null) {
            knownOrderIds = emptySet()
            estIdResolved = storedEstId
            val cached = offlineCache.load(cur.userId)
            if (cached != null) {
                if (cached.member != null) member = cached.member
                if (cached.establishment != null) establishment = cached.establishment
                if (cached.estChoices.isNotEmpty()) estChoices = cached.estChoices
                if (estIdResolved.isNullOrBlank() && !cached.estId.isNullOrBlank()) estIdResolved = cached.estId
                if (cached.poles.isNotEmpty()) poles = cached.poles
                if (cached.allPoles.isNotEmpty()) allPoles = cached.allPoles
                if (cached.products.isNotEmpty()) products = cached.products
                if (cached.orders.isNotEmpty()) orders = cached.orders
                if (cached.tables.isNotEmpty()) tables = cached.tables
                if (cached.serviceDay != null) serviceDay = cached.serviceDay
                if (cached.cashSession != null) cashSession = cached.cashSession
                if (cached.productImageDefaults.isNotEmpty()) productImageDefaults = cached.productImageDefaults
                caDay = cached.caDay
                cashSalesDay = cached.cashSalesDay
                caWeek = cached.caWeek
                caMonth = cached.caMonth
                expensesDay = cached.expensesDay
                expensesMonth = cached.expensesMonth
                lastSyncedMs = cached.lastSyncedMs
            }
            refreshData()
        } else {
            member = null
            establishment = null
            products = emptyList()
            orders = emptyList()
            estIdResolved = null
            estChoices = emptyList()
            selectedChatPeer = null
            dmMessages = emptyList()
            notifications = emptyList()
            productImageDefaults = emptyMap()
            isOffline = false
            lastSyncedMs = 0L
        }
    }

    LaunchedEffect(session?.accessToken, estIdResolved) {
        if (session == null) return@LaunchedEffect
        while (isActive) {
            delay(25_000)
            if (session != null) refreshData()
        }
    }

    GesmakTheme(isLight = isLightTheme) {
        val c = LocalGesmakColors.current

        if (!splashDone) {
            SplashScreen(onFinished = { splashDone = true })
            return@GesmakTheme
        }

        if (session == null) {
            LoginScreen(
                authConfigured = auth.isConfigured,
                isLightTheme = isLightTheme,
                onToggleTheme = { scope.launch { store.setLightTheme(!isLightTheme) } },
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
                onForgotPassword = { login, onResult ->
                    scope.launch {
                        val err = withContext(Dispatchers.IO) { auth.sendPasswordReset(login) }
                        onResult(err)
                    }
                },
            )
            return@GesmakTheme
        }

        val roleLower = member?.role?.lowercase().orEmpty()
        val isOwner = roleLower in setOf("owner", "propriétaire", "proprietaire", "admin", "super_admin")
        val isManager = roleLower in setOf("manager", "gérant", "gerant")
        val isCashierOnly = roleLower in setOf("cashier", "caissier", "caissière", "caissiere")
        val canEditStock = isOwner || isManager || (member?.canEditStock == true)
        val canManageTeam = isOwner || isManager
        val lockedPole = if (isCashierOnly || isManager) member?.assignedPoleCode else null

        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val pendingCount = orders.count { it.status == "pending" }
        val unreadNotifs = notifications.count { !it.read }

        val drawerSections = listOf(
            "Principal" to buildList {
                add(DrawerNavItem(AppRoute.HOME, "Tableau de bord", Icons.Default.Home))
                add(DrawerNavItem(AppRoute.POS, "Ma Caisse (POS)", Icons.Default.ShoppingCart))
                add(DrawerNavItem(AppRoute.ORDERS, "Commandes & Cuisine", Icons.Default.ReceiptLong))
                add(DrawerNavItem(AppRoute.TABLES, "Tables, Carte & Résa", Icons.Default.TableRestaurant))
                add(DrawerNavItem(AppRoute.CLOTURE, "Clôture Z", Icons.Default.PointOfSale))
            },
            "Gestion & Stocks" to buildList {
                add(DrawerNavItem(AppRoute.INVENTORY, "Stock & Catalogue", Icons.Default.Inventory2))
                add(DrawerNavItem(AppRoute.ARRIVAL, "Arrivages & Casiers", Icons.Default.LocalShipping))
                if (canEditStock) add(DrawerNavItem(AppRoute.POINT_MANUEL, "Point Manuel (Inventaire)", Icons.Default.CheckCircle))
                if (estChoices.size > 1 && canManageTeam) add(DrawerNavItem(AppRoute.TRANSFERS, "Transfert Inter-Sites", Icons.Default.SwapHoriz))
                if (canManageTeam) add(DrawerNavItem(AppRoute.KITS, "Kits & Promotions", Icons.Default.LocalOffer))
                add(DrawerNavItem(AppRoute.CRM, if (canManageTeam) "Clients, Fournisseurs & Achats" else "Clients & Fidélité", Icons.Default.Store))
            },
            "Finances & Équipe" to buildList {
                add(DrawerNavItem(AppRoute.EXPENSES, "Dépenses", Icons.Default.TrendingDown))
                if (canManageTeam) add(DrawerNavItem(AppRoute.TEAM, "Équipe, Accès & RH", Icons.Default.Groups))
                add(DrawerNavItem(AppRoute.POWERS, "Rôles & Pouvoirs", Icons.Default.Shield))
                if (isOwner) {
                    add(DrawerNavItem(AppRoute.FINANCE, "Compta, Stats & Mode Patron", Icons.Default.Analytics))
                    add(DrawerNavItem(AppRoute.REPORTS, "Rapports CA", Icons.Default.Assessment))
                }
            },
            "Outils & Comms" to buildList {
                add(DrawerNavItem(AppRoute.PLANNING, "Planning & Mon Service", Icons.Default.CalendarMonth))
                add(DrawerNavItem(AppRoute.CHAT, "Chat Interne", Icons.Default.Chat))
                add(DrawerNavItem(AppRoute.NOTIFICATIONS, if (unreadNotifs > 0) "Notifications ($unreadNotifs)" else "Notifications", Icons.Default.Notifications))
                add(DrawerNavItem(AppRoute.QR, "QR Code Tables", Icons.Default.QrCode2))
                add(DrawerNavItem(AppRoute.SETTINGS, "Paramètres & Mise à jour", Icons.Default.Settings))
            },
        )

        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(
                    drawerContainerColor = c.card,
                    modifier = Modifier.width(300.dp),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(14.dp),
                    ) {
                        // En-tête drawer
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(
                                painter = painterResource(id = R.drawable.logo_circle),
                                contentDescription = "GESMAK",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(44.dp).clip(CircleShape),
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("GESMAK", color = c.accent, fontWeight = FontWeight.Black, fontSize = 18.sp)
                                Text(
                                    establishment?.name ?: "Mon Établissement",
                                    color = c.text,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatusPill(label = roleLabelFr(member?.role), color = c.sky)
                            val p = lockedPole ?: activePole
                            if (!p.isNullOrBlank()) {
                                StatusPill(label = poleLabelFr(p), color = poleColorHex(p))
                            }
                        }
                        HorizontalDivider(color = c.border, modifier = Modifier.padding(vertical = 10.dp))

                        drawerSections.forEach { (sectionTitle, items) ->
                            if (items.isNotEmpty()) {
                                Text(
                                    sectionTitle.uppercase(),
                                    color = c.muted,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                )
                                items.forEach { item ->
                                    NavigationDrawerItem(
                                        selected = activeRoute == item.route,
                                        onClick = {
                                            activeRoute = item.route
                                            scope.launch { drawerState.close() }
                                        },
                                        icon = { Icon(item.icon, contentDescription = null) },
                                        label = { Text(item.label, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                        colors = NavigationDrawerItemDefaults.colors(
                                            selectedContainerColor = c.accentSoft,
                                            selectedIconColor = c.accentDeep,
                                            selectedTextColor = c.accentDeep,
                                            unselectedIconColor = c.muted,
                                            unselectedTextColor = c.text,
                                        ),
                                    )
                                }
                            }
                        }

                        HorizontalDivider(color = c.border, modifier = Modifier.padding(vertical = 10.dp))
                        Text(
                            "v${BuildConfig.VERSION_NAME} · Kevin Tech Pro",
                            color = c.muted,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp),
                        )
                    }
                }
            },
        ) {
            Scaffold(
                containerColor = c.bg,
                topBar = {
                    Surface(
                        color = c.headerBg,
                        shadowElevation = if (c.isLight) 2.dp else 0.dp,
                    ) {
                        Column(modifier = Modifier.statusBarsPadding()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                    Icon(Icons.Default.Menu, contentDescription = "Menu", tint = c.text)
                                }
                                Image(
                                    painter = painterResource(id = R.drawable.logo_circle),
                                    contentDescription = "GESMAK",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.size(30.dp).clip(CircleShape),
                                )
                                Spacer(Modifier.width(8.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        establishment?.name ?: "GESMAK",
                                        color = c.text,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        poleLabelFr(lockedPole ?: activePole),
                                        color = c.muted,
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                    )
                                }
                                StatusPill(
                                    label = if (isOffline) "Hors-ligne" else "En ligne",
                                    color = if (isOffline) c.rose else c.emerald,
                                )
                                IconButton(onClick = { activeRoute = AppRoute.NOTIFICATIONS }) {
                                    if (unreadNotifs > 0) {
                                        BadgedBox(badge = { Badge { Text("$unreadNotifs") } }) {
                                            Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = c.accent)
                                        }
                                    } else {
                                        Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = c.muted)
                                    }
                                }
                                IconButton(
                                    onClick = { scope.launch { store.setLightTheme(!isLightTheme) } },
                                ) {
                                    Icon(
                                        imageVector = if (isLightTheme) Icons.Default.DarkMode else Icons.Default.LightMode,
                                        contentDescription = "Thème",
                                        tint = c.accent,
                                    )
                                }
                            }
                            if (remoteUpdate != null && activeRoute != AppRoute.SETTINGS) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF065F46))
                                        .clickable { activeRoute = AppRoute.SETTINGS }
                                        .padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(Icons.Default.Download, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        "Mise à jour v${remoteUpdate!!.versionName} disponible — Toucher pour installer",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }
                    }
                },
                bottomBar = {
                    NavigationBar(
                        containerColor = c.headerBg,
                        contentColor = c.text,
                    ) {
                        val navItems = listOf(
                            Triple(AppRoute.HOME, "Accueil", Icons.Default.Home),
                            Triple(AppRoute.POS, "Caisse", Icons.Default.ShoppingCart),
                            Triple(AppRoute.ORDERS, "Commandes", Icons.Default.ReceiptLong),
                            Triple(AppRoute.CLOTURE, "Clôturer", Icons.Default.PointOfSale),
                            Triple(AppRoute.INVENTORY, "Stock", Icons.Default.Inventory2),
                        )
                        navItems.forEach { (route, label, icon) ->
                            NavigationBarItem(
                                selected = activeRoute == route,
                                onClick = { activeRoute = route },
                                icon = {
                                    if (route == AppRoute.ORDERS && pendingCount > 0) {
                                        BadgedBox(badge = { Badge { Text("$pendingCount") } }) {
                                            Icon(icon, contentDescription = label)
                                        }
                                    } else {
                                        Icon(icon, contentDescription = label)
                                    }
                                },
                                label = {
                                    Text(label, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = c.accent,
                                    selectedTextColor = c.accent,
                                    indicatorColor = c.accentSoft,
                                    unselectedIconColor = c.muted,
                                    unselectedTextColor = c.muted,
                                ),
                            )
                        }
                    }
                },
            ) { padding ->
                val pageMod = Modifier.padding(padding)
                when (activeRoute) {
                    AppRoute.HOME -> HomeDashboard(
                        mod = pageMod,
                        member = member,
                        memberEmail = SupabaseAuth.displayLogin(session?.email.orEmpty()),
                        establishment = establishment,
                        products = products,
                        orders = orders,
                        serviceDay = serviceDay,
                        serviceDayBusy = serviceDayBusy,
                        caDay = caDay,
                        caMonth = caMonth,
                        expensesDay = expensesDay,
                        offlinePending = offlineCount,
                        isOffline = isOffline,
                        lastSyncedMs = lastSyncedMs,
                        establishments = estChoices,
                        currentEstId = estIdResolved,
                        activePoleCode = lockedPole ?: activePole,
                        loading = loadingData,
                        error = dataError,
                        updateLabel = remoteUpdate?.let { "Mise à jour prête · v${it.versionName}" },
                        updateBusy = updateDownloading,
                        onSelectEst = { id ->
                            estIdResolved = id
                            knownOrderIds = emptySet()
                            scope.launch { store.setActiveEstId(id) }
                            refreshData()
                        },
                        onRefresh = { refreshData() },
                        onToggleServiceDay = {
                            val s = session ?: return@HomeDashboard
                            val eid = estIdResolved ?: return@HomeDashboard
                            scope.launch {
                                serviceDayBusy = true
                                val err = withContext(Dispatchers.IO) {
                                    val sd = serviceDay
                                    if (sd?.status == "open") {
                                        api.closeServiceDay(s.accessToken, sd.id, s.userId)
                                    } else {
                                        api.openServiceDay(s.accessToken, eid, s.userId, isoTodayDate())
                                    }
                                }
                                serviceDayBusy = false
                                if (err != null) dataError = err else refreshData()
                            }
                        },
                        onNavigate = { target -> activeRoute = target },
                        onUpdateClick = { activeRoute = AppRoute.SETTINGS },
                    )

                    AppRoute.POS -> SalesScreen(
                        mod = pageMod,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        poles = poles,
                        lockedPole = lockedPole,
                        activePole = activePole,
                        isCashierOnly = isCashierOnly,
                        estId = estIdResolved,
                        salesStore = salesStore,
                        busy = busySale,
                        onSelectPole = { p ->
                            activePole = p
                            scope.launch { store.setSelectedPole(p) }
                            refreshData()
                        },
                        onVerifyPin = { pin, reason, cb ->
                            val s = session ?: return@SalesScreen
                            val eid = estIdResolved ?: return@SalesScreen
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    api.verifyManagerPinRpc(s.accessToken, eid, lockedPole ?: activePole, pin, "pos.discount", reason)
                                }
                                cb(res.ok, res.error)
                            }
                        },
                        onValidateSale = { lines, payMethod, discount, poleCode ->
                            val s = session ?: return@SalesScreen
                            val eid = estIdResolved ?: return@SalesScreen
                            val gross = lines.sumOf { (p, q) -> p.price * q }.coerceAtLeast(1.0)
                            val ratio = ((gross - discount) / gross).coerceIn(0.0, 1.0)
                            scope.launch {
                                busySale = true
                                withContext(Dispatchers.IO) {
                                    for ((product, qty) in lines) {
                                        val unitOverride = if (discount > 0.0) (product.price * ratio) else null
                                        try {
                                            val err = api.postSaleLine(
                                                accessToken = s.accessToken,
                                                estId = eid,
                                                userId = s.userId,
                                                product = product,
                                                qty = qty,
                                                paymentMethod = payMethod,
                                                unitPriceOverride = unitOverride,
                                                poleCode = poleCode,
                                                cashSessionId = cashSession?.id,
                                            )
                                            if (err != null) {
                                                offlineQ.enqueue(
                                                    "sale",
                                                    JSONObject()
                                                        .put("est_id", eid)
                                                        .put("product_id", product.id)
                                                        .put("qty", qty)
                                                        .put("payment_method", payMethod)
                                                        .put("pole_code", poleCode ?: ""),
                                                )
                                            }
                                        } catch (_: Exception) {
                                            offlineQ.enqueue(
                                                "sale",
                                                JSONObject()
                                                    .put("est_id", eid)
                                                    .put("product_id", product.id)
                                                    .put("qty", qty)
                                                    .put("payment_method", payMethod)
                                                    .put("pole_code", poleCode ?: ""),
                                            )
                                        }
                                    }
                                    offlineCount = offlineQ.size()
                                }
                                busySale = false
                                refreshData()
                            }
                        },
                    )

                    AppRoute.ORDERS -> OrdersScreen(
                        mod = pageMod,
                        orders = orders,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        tables = tables,
                        poles = poles,
                        teamMembers = teamMembers,
                        activePoleCode = lockedPole ?: activePole,
                        loading = loadingData,
                        busyId = busyOrderId,
                        onRefresh = { refreshData() },
                        onLoadItems = { oid, cb ->
                            val s = session ?: return@OrdersScreen
                            scope.launch {
                                val list = withContext(Dispatchers.IO) {
                                    try { api.fetchOrderItems(s.accessToken, oid) } catch (_: Exception) { emptyList() }
                                }
                                cb(list)
                            }
                        },
                        onUpdateItemStatus = { _, itemId, status, cb ->
                            val s = session ?: return@OrdersScreen
                            scope.launch {
                                withContext(Dispatchers.IO) {
                                    try { api.updateOrderItemStatus(s.accessToken, itemId, status) } catch (_: Exception) { }
                                }
                                cb()
                                refreshData()
                            }
                        },
                        onAdvance = { orderId, next ->
                            val s = session ?: return@OrdersScreen
                            scope.launch {
                                busyOrderId = orderId
                                val ok = withContext(Dispatchers.IO) {
                                    try { api.updateOrderStatus(s.accessToken, orderId, next) } catch (_: Exception) { false }
                                }
                                busyOrderId = null
                                if (ok) refreshData() else dataError = "Commande non mise à jour (vérifiez la connexion)."
                            }
                        },
                        onAssignServer = { order, srvId, srvName, cb ->
                            val s = session ?: return@OrdersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    try {
                                        api.assignOrderServer(s.accessToken, order.id, srvId, srvName, order.tableId)
                                    } catch (e: Exception) {
                                        SupabaseAuth.friendlyNetworkError(e, "Connexion requise pour attribuer un serveur.")
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onAppendItems = { order, extraNote, lines, cb ->
                            val s = session ?: return@OrdersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    try {
                                        api.appendItemsToOrder(s.accessToken, order.id, order.notes, extraNote, lines)
                                    } catch (e: Exception) {
                                        SupabaseAuth.friendlyNetworkError(e, "Connexion requise pour ajouter un tour.")
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCancelWithReason = { order, reason, cb ->
                            val s = session ?: return@OrdersScreen
                            val eid = estIdResolved ?: return@OrdersScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) }
                                ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    try {
                                        api.cancelOrderWithReason(s.accessToken, eid, s.userId, actorName, order, reason)
                                    } catch (e: Exception) {
                                        SupabaseAuth.friendlyNetworkError(e, "Connexion requise pour annuler la commande.")
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCloseAndPay = { order, selectedItemIds, payMethod, cb ->
                            val s = session ?: return@OrdersScreen
                            val eid = estIdResolved ?: return@OrdersScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) }
                                ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    try {
                                        api.closeAndPayOrder(
                                            accessToken = s.accessToken,
                                            estId = eid,
                                            userId = s.userId,
                                            actorName = actorName,
                                            order = order,
                                            products = products,
                                            selectedItemIds = selectedItemIds,
                                            paymentMethod = payMethod,
                                            cashSessionId = cashSession?.id,
                                        )
                                    } catch (e: Exception) {
                                        SupabaseAuth.friendlyNetworkError(e, "Connexion requise pour encaisser.")
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCreateOrder = { tableId, tableNum, custName, orderType, poleCode, notes, srvId, srvName, lines, cb ->
                            val s = session ?: return@OrdersScreen
                            val eid = estIdResolved ?: return@OrdersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    try {
                                        api.createOrderWithItems(
                                            accessToken = s.accessToken,
                                            estId = eid,
                                            userId = s.userId,
                                            tableId = tableId,
                                            tableNumber = tableNum,
                                            customerName = custName,
                                            orderType = orderType,
                                            poleCode = poleCode,
                                            notes = notes,
                                            lines = lines,
                                            serverId = srvId,
                                            serverName = srvName,
                                        )
                                    } catch (e: Exception) {
                                        SupabaseAuth.friendlyNetworkError(e, "Connexion requise pour créer la commande.")
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.CLOTURE -> ClotureScreen(
                        mod = pageMod,
                        poles = poles,
                        lockedPole = lockedPole,
                        activePole = activePole,
                        isCashierOnly = isCashierOnly,
                        session = cashSession,
                        history = cashHistory,
                        salesToday = caDay,
                        cashSalesToday = cashSalesDay,
                        expensesToday = expensesDay,
                        loading = loadingData,
                        saving = clotureBusy,
                        notice = clotureNotice,
                        error = clotureError,
                        onSelectPole = { p ->
                            activePole = p
                            scope.launch { store.setSelectedPole(p) }
                            refreshData()
                        },
                        onRefresh = { refreshData() },
                        onOpenSession = { openingFloat, poleCode ->
                            val s = session ?: return@ClotureScreen
                            val eid = estIdResolved ?: return@ClotureScreen
                            scope.launch {
                                clotureBusy = true
                                clotureError = null
                                clotureNotice = null
                                val err = withContext(Dispatchers.IO) {
                                    api.openCashSession(
                                        accessToken = s.accessToken,
                                        estId = eid,
                                        userId = s.userId,
                                        cashierName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email),
                                        todayDate = isoTodayDate(),
                                        openingFloat = openingFloat,
                                        poleCode = poleCode,
                                        salesToday = caDay,
                                        expensesToday = expensesDay,
                                    )
                                }
                                clotureBusy = false
                                if (err != null) clotureError = err else {
                                    clotureNotice = "Session de caisse ouverte."
                                    refreshData()
                                }
                            }
                        },
                        onVerifyPin = { pin, reason, cb ->
                            val s = session ?: return@ClotureScreen
                            val eid = estIdResolved ?: return@ClotureScreen
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    api.verifyManagerPinRpc(s.accessToken, eid, lockedPole ?: activePole, pin, "cloture.z", reason)
                                }
                                cb(res.ok, res.approvedBy, res.error)
                            }
                        },
                        onCloseSession = { sessId, realCash, expectedCash, notes, appId, appName ->
                            val s = session ?: return@ClotureScreen
                            scope.launch {
                                clotureBusy = true
                                clotureError = null
                                val err = withContext(Dispatchers.IO) {
                                    api.closeCashSession(
                                        accessToken = s.accessToken,
                                        sessionId = sessId,
                                        userId = s.userId,
                                        realCash = realCash,
                                        expectedCash = expectedCash,
                                        salesToday = caDay,
                                        expensesToday = expensesDay,
                                        notes = notes,
                                        approvedBy = appId,
                                        approvedByName = appName,
                                    )
                                }
                                clotureBusy = false
                                if (err != null) clotureError = err else {
                                    clotureNotice = "Clôture Z enregistrée."
                                    refreshData()
                                }
                            }
                        },
                    )

                    AppRoute.INVENTORY -> InventoryScreen(
                        mod = pageMod,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        loading = loadingData,
                        canEdit = canEditStock,
                        onRefresh = { refreshData() },
                        onSaveProduct = { id, name, cat, price, cost, stock, minStock, unit, unitsPerPkg, done ->
                            val s = session ?: return@InventoryScreen
                            val eid = estIdResolved ?: return@InventoryScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.upsertProduct(s.accessToken, eid, id, name, cat, price, cost, stock, minStock, unit, unitsPerPkg)
                                }
                                done(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteProduct = { prodId, done ->
                            val s = session ?: return@InventoryScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteProduct(s.accessToken, prodId) }
                                done(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.ARRIVAL -> ArrivalScreen(
                        mod = pageMod,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        canEdit = canEditStock,
                        busy = busySale,
                        onSubmit = { product, casiers, perCasier, unitExtra ->
                            val s = session ?: return@ArrivalScreen
                            val eid = estIdResolved ?: return@ArrivalScreen
                            val bottles = casiers * perCasier + unitExtra
                            val note = "arrivage ${casiers}x$perCasier +$unitExtra"
                            scope.launch {
                                busySale = true
                                withContext(Dispatchers.IO) {
                                    try {
                                        val err = api.postArrival(s.accessToken, eid, s.userId, product, bottles, note)
                                        if (err != null) {
                                            offlineQ.enqueue(
                                                "arrival",
                                                JSONObject()
                                                    .put("est_id", eid)
                                                    .put("product_id", product.id)
                                                    .put("qty", bottles)
                                                    .put("note", note),
                                            )
                                        }
                                    } catch (_: Exception) {
                                        offlineQ.enqueue(
                                            "arrival",
                                            JSONObject()
                                                .put("est_id", eid)
                                                .put("product_id", product.id)
                                                .put("qty", bottles)
                                                .put("note", note),
                                        )
                                    }
                                    offlineCount = offlineQ.size()
                                }
                                busySale = false
                                refreshData()
                            }
                        },
                    )

                    AppRoute.EXPENSES -> ExpensesScreen(
                        mod = pageMod,
                        expenses = expenses,
                        todayTotal = expensesDay,
                        monthTotal = expensesMonth,
                        canManage = canManageTeam,
                        onRefresh = { refreshData() },
                        onSave = { existingId, cat, desc, amount, pay, cb ->
                            val s = session ?: return@ExpensesScreen
                            val eid = estIdResolved ?: return@ExpensesScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    if (existingId == null) {
                                        api.postExpense(s.accessToken, eid, s.userId, cat, desc, amount, pay, lockedPole ?: activePole)
                                    } else {
                                        api.updateExpense(s.accessToken, existingId, cat, desc, amount, pay)
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDelete = { expId ->
                            val s = session ?: return@ExpensesScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.deleteExpense(s.accessToken, expId) }
                                refreshData()
                            }
                        },
                    )

                    AppRoute.TEAM -> TeamScreen(
                        mod = pageMod,
                        currentUser = member,
                        team = teamMembers,
                        poles = poles,
                        allPoles = allPoles,
                        employees = employees,
                        todaySales = todaySalesList,
                        todaySessions = cashHistory.filter { it.sessionDate == isoTodayDate() },
                        products = products,
                        audits = audits,
                        onRefresh = { refreshData() },
                        onInitPoles = { codes, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.ensureDefaultPolesRpc(s.accessToken, eid, codes) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onTogglePoleActive = { code, active, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.setPoleActive(s.accessToken, eid, code, active) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCreateAccess = { fullName, login, password, role, poleCode, supId, pin, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    val authEmail = SupabaseAuth.toAuthEmail(login)
                                    val signRes = auth.signUpEphemeral(authEmail, password, fullName, login, role)
                                    if (!signRes.ok || signRes.userId.isNullOrBlank()) {
                                        signRes.error ?: "Création du compte impossible"
                                    } else {
                                        val linkErr = api.assignTeamMemberRpc(s.accessToken, signRes.userId, eid, role, fullName, authEmail)
                                        if (linkErr != null) {
                                            linkErr
                                        } else if (!poleCode.isNullOrBlank() || !supId.isNullOrBlank() || !pin.isNullOrBlank()) {
                                            api.setMemberPoleAndPinRpc(s.accessToken, signRes.userId, eid, poleCode, supId, pin)
                                        } else {
                                            null
                                        }
                                    }
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onEditMemberFull = { mId, targetUid, fullName, newRole, poleCode, supId, pin, canStock, status, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    var e: String? = null
                                    if (fullName.isNotBlank()) {
                                        e = api.updateMemberProfile(s.accessToken, mId, fullName)
                                    }
                                    if (e == null && !newRole.isNullOrBlank()) {
                                        e = api.updateMemberRole(s.accessToken, mId, newRole, targetUid, eid)
                                    }
                                    if (e == null) {
                                        e = api.setMemberPoleAndPinRpc(s.accessToken, targetUid, eid, poleCode, supId, pin)
                                    }
                                    if (e == null) {
                                        e = api.toggleCanEditStock(s.accessToken, mId, canStock)
                                    }
                                    if (e == null) {
                                        e = api.updateMemberStatus(s.accessToken, mId, status)
                                    }
                                    e
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onRemoveMember = { mId, targetUid, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.removeMemberFromEstablishment(s.accessToken, mId, targetUid, eid) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onToggleStatus = { mId, next ->
                            val s = session ?: return@TeamScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.updateMemberStatus(s.accessToken, mId, next) }
                                refreshData()
                            }
                        },
                        onToggleStockEdit = { mId, allowed ->
                            val s = session ?: return@TeamScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.toggleCanEditStock(s.accessToken, mId, allowed) }
                                refreshData()
                            }
                        },
                        onSaveEmployee = { existingId, name, empRole, phone, salary, status, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.upsertEmployee(s.accessToken, eid, existingId, name, empRole, phone, salary, status)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteEmployee = { empId, cb ->
                            val s = session ?: return@TeamScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteEmployee(s.accessToken, empId) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onQuickAdjustStock = { prod, newStock, newMin, reason, cb ->
                            val s = session ?: return@TeamScreen
                            val eid = estIdResolved ?: return@TeamScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.adjustStockQuick(s.accessToken, eid, s.userId, actorName, prod, newStock, newMin, reason)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.REPORTS -> ReportsScreen(
                        mod = pageMod,
                        caDay = caDay,
                        caWeek = caWeek,
                        caMonth = caMonth,
                        recent = recentSales,
                        loading = loadingData,
                        onRefresh = { refreshData() },
                    )

                    AppRoute.POWERS -> PowersScreen(
                        mod = pageMod,
                        currentUser = member,
                        memberEmail = SupabaseAuth.displayLogin(session?.email.orEmpty()),
                        establishment = establishment,
                        poles = poles,
                        team = teamMembers,
                        audits = audits,
                        serviceDay = serviceDay,
                        serviceDayBusy = serviceDayBusy,
                        cashSession = cashSession,
                        activePoleCode = lockedPole ?: activePole,
                        onRefresh = { refreshData() },
                        onToggleServiceDay = {
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                serviceDayBusy = true
                                val err = withContext(Dispatchers.IO) {
                                    val sd = serviceDay
                                    if (sd?.status == "open") {
                                        api.closeServiceDay(s.accessToken, sd.id, s.userId)
                                    } else {
                                        api.openServiceDay(s.accessToken, eid, s.userId, isoTodayDate())
                                    }
                                }
                                serviceDayBusy = false
                                if (err != null) dataError = err else refreshData()
                            }
                        },
                        onOpenCashSession = { openingFloat, poleCode, cb ->
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.openCashSession(
                                        accessToken = s.accessToken,
                                        estId = eid,
                                        userId = s.userId,
                                        cashierName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email),
                                        todayDate = isoTodayDate(),
                                        openingFloat = openingFloat,
                                        poleCode = poleCode,
                                        salesToday = caDay,
                                        expensesToday = expensesDay,
                                    )
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onInitPoles = { codes, cb ->
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.ensureDefaultPolesRpc(s.accessToken, eid, codes)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSaveSelfPin = { pin, cb ->
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.setMemberPoleAndPinRpc(
                                        accessToken = s.accessToken,
                                        targetUserId = s.userId,
                                        estId = eid,
                                        poleCode = lockedPole ?: member?.assignedPoleCode,
                                        supervisorUserId = member?.supervisorUserId,
                                        managerPin = pin,
                                    )
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onUpdateMemberPowers = { memberId, targetUid, newRole, poleCode, supId, pin, cb ->
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    var roleErr: String? = null
                                    if (!newRole.isNullOrBlank()) {
                                        roleErr = api.updateMemberRole(s.accessToken, memberId, newRole, targetUid, eid)
                                    }
                                    roleErr ?: api.setMemberPoleAndPinRpc(
                                        accessToken = s.accessToken,
                                        targetUserId = targetUid,
                                        estId = eid,
                                        poleCode = poleCode,
                                        supervisorUserId = supId,
                                        managerPin = pin,
                                    )
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onToggleStatus = { mId, next, cb ->
                            val s = session ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.updateMemberStatus(s.accessToken, mId, next) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onToggleStockEdit = { mId, allowed, cb ->
                            val s = session ?: return@PowersScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.toggleCanEditStock(s.accessToken, mId, allowed) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onVerifyPin = { poleCode, pin, action, reason, cb ->
                            val s = session ?: return@PowersScreen
                            val eid = estIdResolved ?: return@PowersScreen
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    api.verifyManagerPinRpc(s.accessToken, eid, poleCode, pin, action, reason)
                                }
                                cb(res)
                                if (res.ok) refreshData()
                            }
                        },
                        onNavigate = { target -> activeRoute = target },
                    )

                    AppRoute.QR -> QrOrderScreen(
                        mod = pageMod,
                        estSlug = establishment?.slug,
                        tables = tables,
                        onAddTable = { num, cb ->
                            val s = session ?: return@QrOrderScreen
                            val eid = estIdResolved ?: return@QrOrderScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.addTable(s.accessToken, eid, num) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.TABLES -> TablesKitchenScreen(
                        mod = pageMod,
                        tables = tables,
                        team = teamMembers,
                        menuCategories = menuCategories,
                        menuItems = menuItems,
                        reservations = reservations,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        onRefresh = { refreshData() },
                        onAddTable = { num, seats, loc, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            val eid = estIdResolved ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.addTable(s.accessToken, eid, num, seats, loc) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCycleTableStatus = { tableId, nextStatus, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.updateTableStatus(s.accessToken, tableId, nextStatus) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onAssignServer = { tableId, srvId, srvName, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.assignTableServer(s.accessToken, tableId, srvId, srvName) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteTable = { tableId, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteTable(s.accessToken, tableId) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSaveCategory = { id, name, order, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            val eid = estIdResolved ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.upsertMenuCategory(s.accessToken, eid, id, name, order) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteCategory = { id, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteMenuCategory(s.accessToken, id) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSaveMenuItem = { id, name, price, catId, desc, linkedProdId, available, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            val eid = estIdResolved ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.upsertMenuItem(s.accessToken, eid, id, name, price, catId, desc, linkedProdId, available)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteMenuItem = { id, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteMenuItem(s.accessToken, id) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSaveReservation = { id, custName, phone, partySize, timeIso, tableId, status, notes, cb ->
                            val s = session ?: return@TablesKitchenScreen
                            val eid = estIdResolved ?: return@TablesKitchenScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.upsertReservation(s.accessToken, eid, s.userId, id, custName, phone, partySize, timeIso, tableId, status, notes)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.CRM -> CrmSupplyScreen(
                        mod = pageMod,
                        customers = customers,
                        suppliers = if (canManageTeam) suppliers else emptyList(),
                        purchases = if (canManageTeam) purchases else emptyList(),
                        products = products,
                        onRefresh = { refreshData() },
                        onSaveCustomer = { id, name, phone, email, notes, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            val eid = estIdResolved ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.upsertCustomer(s.accessToken, eid, id, name, phone, email, notes) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteCustomer = { id, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteCustomer(s.accessToken, id) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSaveSupplier = { id, name, contact, phone, email, address, notes, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            val eid = estIdResolved ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.upsertSupplier(s.accessToken, eid, id, name, contact, phone, email, address, notes)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeleteSupplier = { id, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deleteSupplier(s.accessToken, id) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCreatePurchase = { prod, supId, qty, unitCost, notes, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            val eid = estIdResolved ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.createPurchaseAndRestock(s.accessToken, eid, s.userId, prod, supId, qty, unitCost, notes)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onDeletePurchase = { id, cb ->
                            val s = session ?: return@CrmSupplyScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.deletePurchase(s.accessToken, id) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.FINANCE -> FinancePatronScreen(
                        mod = pageMod,
                        establishmentName = establishment?.name ?: "Établissement",
                        products = products,
                        sales30d = sales30d,
                        expenses = expenses,
                        purchases = purchases,
                        dailyReports = dailyReports,
                        todayDate = isoTodayDate(),
                        onRefresh = { refreshData() },
                        onValidatePatronToday = { dateStr, cb ->
                            val s = session ?: return@FinancePatronScreen
                            val eid = estIdResolved ?: return@FinancePatronScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.postPatronValidation(s.accessToken, eid, s.userId, actorName, dateStr)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.CHAT -> ChatScreen(
                        mod = pageMod,
                        myUserId = session?.userId.orEmpty(),
                        team = teamMembers,
                        groupMessages = groupMessages,
                        dmMessages = dmMessages,
                        selectedPeer = selectedChatPeer,
                        onSelectPeer = { selectedChatPeer = it },
                        onRefresh = { refreshData() },
                        onSendGroup = { msg, cb ->
                            val s = session ?: return@ChatScreen
                            val eid = estIdResolved ?: return@ChatScreen
                            val senderName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.sendGroupMessage(s.accessToken, eid, s.userId, senderName, msg)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onSendDm = { peerUid, msg, cb ->
                            val s = session ?: return@ChatScreen
                            val senderName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.sendDirectMessage(s.accessToken, estIdResolved, s.userId, peerUid, senderName, msg)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.NOTIFICATIONS -> NotificationsScreen(
                        mod = pageMod,
                        notifications = notifications,
                        onRefresh = { refreshData() },
                        onMarkRead = { nid ->
                            val s = session ?: return@NotificationsScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.markNotificationRead(s.accessToken, nid) }
                                refreshData()
                            }
                        },
                        onMarkAllRead = {
                            val s = session ?: return@NotificationsScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.markAllNotificationsRead(s.accessToken, s.userId) }
                                refreshData()
                            }
                        },
                        onDelete = { nid ->
                            val s = session ?: return@NotificationsScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.deleteNotification(s.accessToken, nid) }
                                refreshData()
                            }
                        },
                    )

                    AppRoute.PLANNING -> PlanningAndServiceScreen(
                        mod = pageMod,
                        employees = employees,
                        shifts = shifts,
                        myOrders = orders.filter { it.serverId == session?.userId || canManageTeam },
                        myTables = tables.filter { it.serverId == session?.userId || canManageTeam },
                        onRefresh = { refreshData() },
                        onCreateShift = { empId, date, startHm, endHm, notes, cb ->
                            val s = session ?: return@PlanningAndServiceScreen
                            val eid = estIdResolved ?: return@PlanningAndServiceScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.createShift(s.accessToken, eid, empId, "${date}T${startHm}:00Z", "${date}T${endHm}:00Z", notes)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onUpdateShiftStatus = { shiftId, st ->
                            val s = session ?: return@PlanningAndServiceScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.updateShiftStatus(s.accessToken, shiftId, st) }
                                refreshData()
                            }
                        },
                        onMarkOrderServed = { orderId ->
                            val s = session ?: return@PlanningAndServiceScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.updateOrderStatus(s.accessToken, orderId, "served") }
                                refreshData()
                            }
                        },
                    )

                    AppRoute.POINT_MANUEL -> PointManuelScreen(
                        mod = pageMod,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        onSavePointManuel = { adjustments, cb ->
                            val s = session ?: return@PointManuelScreen
                            val eid = estIdResolved ?: return@PointManuelScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    var firstErr: String? = null
                                    for ((prod, newQty) in adjustments) {
                                        val r = api.adjustStockQuick(
                                            s.accessToken,
                                            eid,
                                            s.userId,
                                            actorName,
                                            prod,
                                            newQty,
                                            prod.minStock,
                                            "Point manuel inventaire",
                                        )
                                        if (r != null && firstErr == null) firstErr = r
                                    }
                                    firstErr
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.TRANSFERS -> StockTransferScreen(
                        mod = pageMod,
                        currentEstId = estIdResolved,
                        establishments = estChoices,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        onTransfer = { targetEstId, targetEstName, lines, cb ->
                            val s = session ?: return@StockTransferScreen
                            val srcId = estIdResolved ?: return@StockTransferScreen
                            val actorName = member?.fullName?.ifBlank { SupabaseAuth.displayLogin(s.email) } ?: SupabaseAuth.displayLogin(s.email)
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.transferStockBetweenSites(s.accessToken, srcId, targetEstId, targetEstName, s.userId, actorName, lines)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                    )

                    AppRoute.KITS -> KitsPromosScreen(
                        mod = pageMod,
                        kits = kits,
                        promos = promos,
                        products = products,
                        productImageDefaults = productImageDefaults,
                        onRefresh = { refreshData() },
                        onCreateKit = { name, desc, price, items, cb ->
                            val s = session ?: return@KitsPromosScreen
                            val eid = estIdResolved ?: return@KitsPromosScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.createKit(s.accessToken, eid, name, desc, price, items) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onToggleKit = { kitId, active ->
                            val s = session ?: return@KitsPromosScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.toggleKitActive(s.accessToken, kitId, active) }
                                refreshData()
                            }
                        },
                        onDeleteKit = { kitId ->
                            val s = session ?: return@KitsPromosScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.deleteKit(s.accessToken, kitId) }
                                refreshData()
                            }
                        },
                        onCreatePromo = { name, desc, type, value, prodId, buyQty, getQty, cb ->
                            val s = session ?: return@KitsPromosScreen
                            val eid = estIdResolved ?: return@KitsPromosScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.createPromo(s.accessToken, eid, name, desc, type, value, prodId, buyQty, getQty)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onTogglePromo = { promoId, active ->
                            val s = session ?: return@KitsPromosScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.togglePromoActive(s.accessToken, promoId, active) }
                                refreshData()
                            }
                        },
                        onDeletePromo = { promoId ->
                            val s = session ?: return@KitsPromosScreen
                            scope.launch {
                                withContext(Dispatchers.IO) { api.deletePromo(s.accessToken, promoId) }
                                refreshData()
                            }
                        },
                    )

                    else -> SettingsScreen(
                        mod = pageMod,
                        member = member,
                        memberEmail = SupabaseAuth.displayLogin(session?.email.orEmpty()),
                        establishment = establishment,
                        pendingPaymentRequests = pendingPaymentRequests,
                        isLightTheme = isLightTheme,
                        orderSoundEnabled = orderSound,
                        remoteUpdate = remoteUpdate,
                        updateChecking = updateChecking,
                        updateDownloading = updateDownloading,
                        updateProgress = updateProgress,
                        updateStatusMsg = updateStatusMsg,
                        canInstallUnknownApps = canInstallUnknownApps,
                        onToggleTheme = { v -> scope.launch { store.setLightTheme(v) } },
                        onToggleOrderSound = { v -> scope.launch { store.setOrderSound(v) } },
                        onCheckUpdate = { checkUpdates(manual = true) },
                        onInstallUpdate = { downloadAndInstallUpdate() },
                        onOpenUnknownAppsSettings = { updateChecker.openInstallPermissionSettings() },
                        onSaveProfile = { fullName, cb ->
                            val s = session ?: return@SettingsScreen
                            val mId = member?.id ?: return@SettingsScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) { api.updateMemberProfile(s.accessToken, mId, fullName) }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onChangePassword = { currentPwd, newPwd, cb ->
                            val s = session ?: return@SettingsScreen
                            val email = s.email.ifBlank { member?.email.orEmpty() }
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    auth.updatePassword(s.accessToken, email, currentPwd, newPwd)
                                }
                                cb(err)
                            }
                        },
                        onSaveEstablishment = { name, addr, phone, type, cb ->
                            val s = session ?: return@SettingsScreen
                            val eid = estIdResolved ?: return@SettingsScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.updateEstablishmentDetails(s.accessToken, eid, name, addr, phone, type)
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCreateEstablishment = { name, type, addr, phone, cb ->
                            val s = session ?: return@SettingsScreen
                            scope.launch {
                                val (newId, err) = withContext(Dispatchers.IO) {
                                    api.createEstablishment(s.accessToken, s.userId, member?.id, name, type, addr, phone)
                                }
                                if (err == null && !newId.isNullOrBlank()) {
                                    estIdResolved = newId
                                    knownOrderIds = emptySet()
                                    store.setActiveEstId(newId)
                                    refreshData()
                                }
                                cb(err)
                            }
                        },
                        onCreatePaymentRequest = { tier, months, amountFcfa, refCode, payerName, cb ->
                            val s = session ?: return@SettingsScreen
                            val eid = estIdResolved ?: return@SettingsScreen
                            scope.launch {
                                val err = withContext(Dispatchers.IO) {
                                    api.createPaymentRequest(
                                        accessToken = s.accessToken,
                                        estId = eid,
                                        userId = s.userId,
                                        planTier = tier,
                                        months = months,
                                        amountFcfa = amountFcfa,
                                        referenceCode = refCode,
                                        proofNote = "Payeur: $payerName",
                                    )
                                }
                                cb(err)
                                if (err == null) refreshData()
                            }
                        },
                        onCaptureGps = { cb ->
                            val s = session ?: return@SettingsScreen
                            val eid = estIdResolved ?: return@SettingsScreen
                            val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                            val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                            if (!hasFine && !hasCoarse) {
                                requestAppPermissions()
                                cb("Autorisez d'abord la localisation, puis réappuyez sur Position GPS.")
                                return@SettingsScreen
                            }
                            scope.launch {
                                val loc = withContext(Dispatchers.IO) { readLastBestLocation(context) }
                                if (loc == null) {
                                    cb("Position GPS indisponible — activez le GPS sur le téléphone et réessayez.")
                                } else {
                                    val err = withContext(Dispatchers.IO) {
                                        api.updateEstablishmentGps(s.accessToken, eid, loc.latitude, loc.longitude, true)
                                    }
                                    if (err == null) {
                                        cb("Position GPS enregistrée (${String.format("%.4f", loc.latitude)}, ${String.format("%.4f", loc.longitude)})")
                                        refreshData()
                                    } else {
                                        cb(err)
                                    }
                                }
                            }
                        },
                        onRequestPermissions = { requestAppPermissions() },
                        onOpenAppSystemSettings = {
                            val intent = Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:${context.packageName}"),
                            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            context.startActivity(intent)
                        },
                        onLogout = { scope.launch { store.clear() } },
                    )
                }
            }
        }
    }
}

@SuppressLint("MissingPermission")
private fun readLastBestLocation(context: Context): Location? {
    return try {
        val mgr = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = mgr.getProviders(true)
        var best: Location? = null
        for (p in providers) {
            val l = mgr.getLastKnownLocation(p) ?: continue
            if (best == null || l.accuracy < best.accuracy) {
                best = l
            }
        }
        best
    } catch (_: Exception) {
        null
    }
}
