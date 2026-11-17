package com.gesmak.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("gesmak_session")

class SessionStore(private val context: Context) {
    private val keyAccess = stringPreferencesKey("access_token")
    private val keyRefresh = stringPreferencesKey("refresh_token")
    private val keyEmail = stringPreferencesKey("email")
    private val keyUserId = stringPreferencesKey("user_id")
    private val keyThemeLight = booleanPreferencesKey("theme_light")
    private val keyOrderSound = booleanPreferencesKey("order_sound")
    private val keyActiveEstId = stringPreferencesKey("active_est_id")
    private val keySelectedPole = stringPreferencesKey("selected_pole")

    val session: Flow<SessionData?> = context.dataStore.data.map { prefs ->
        val access = prefs[keyAccess] ?: return@map null
        SessionData(
            accessToken = access,
            refreshToken = prefs[keyRefresh].orEmpty(),
            email = prefs[keyEmail].orEmpty(),
            userId = prefs[keyUserId].orEmpty(),
        )
    }

    /** Mode jour par défaut comme gesmak.vercel.app */
    val isLightTheme: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[keyThemeLight] ?: true
    }

    val orderSoundEnabled: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[keyOrderSound] ?: true
    }

    val activeEstId: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[keyActiveEstId]?.ifBlank { null }
    }

    val selectedPole: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[keySelectedPole]?.ifBlank { null }
    }

    suspend fun save(data: SessionData) {
        context.dataStore.edit { prefs ->
            prefs[keyAccess] = data.accessToken
            prefs[keyRefresh] = data.refreshToken
            prefs[keyEmail] = data.email
            prefs[keyUserId] = data.userId
        }
    }

    suspend fun setLightTheme(light: Boolean) {
        context.dataStore.edit { it[keyThemeLight] = light }
    }

    suspend fun setOrderSound(enabled: Boolean) {
        context.dataStore.edit { it[keyOrderSound] = enabled }
    }

    suspend fun setActiveEstId(estId: String?) {
        context.dataStore.edit { prefs ->
            if (estId.isNullOrBlank()) prefs.remove(keyActiveEstId)
            else prefs[keyActiveEstId] = estId
        }
    }

    suspend fun setSelectedPole(pole: String?) {
        context.dataStore.edit { prefs ->
            if (pole.isNullOrBlank()) prefs.remove(keySelectedPole)
            else prefs[keySelectedPole] = pole
        }
    }

    suspend fun clear() {
        context.dataStore.edit { prefs ->
            prefs.remove(keyAccess)
            prefs.remove(keyRefresh)
            prefs.remove(keyEmail)
            prefs.remove(keyUserId)
            prefs.remove(keyActiveEstId)
            prefs.remove(keySelectedPole)
        }
    }
}

data class SessionData(
    val accessToken: String,
    val refreshToken: String,
    val email: String,
    val userId: String,
)
