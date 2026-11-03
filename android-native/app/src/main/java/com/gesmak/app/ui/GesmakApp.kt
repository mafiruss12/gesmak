package com.gesmak.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import com.gesmak.app.data.SessionStore
import com.gesmak.app.data.SupabaseAuth
import com.gesmak.app.ui.screens.HomeScreen
import com.gesmak.app.ui.screens.LoginScreen
import kotlinx.coroutines.launch

@Composable
fun GesmakApp() {
    val context = LocalContext.current
    val store = remember { SessionStore(context.applicationContext) }
    val auth = remember { SupabaseAuth() }
    val session by store.session.collectAsState(initial = null)
    val scope = rememberCoroutineScope()

    if (session == null) {
        LoginScreen(
            authConfigured = auth.isConfigured,
            onLogin = { login, password, onResult ->
                scope.launch {
                    val res = auth.signIn(login, password)
                    if (res.ok && res.session != null) {
                        store.save(res.session)
                        onResult(null)
                    } else {
                        onResult(res.error ?: "Connexion impossible")
                    }
                }
            },
        )
    } else {
        HomeScreen(
            email = session?.email.orEmpty(),
            onLogout = {
                scope.launch { store.clear() }
            },
        )
    }
}
