package com.gesmak.app.data

import android.content.Context
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

    val session: Flow<SessionData?> = context.dataStore.data.map { prefs ->
        val access = prefs[keyAccess] ?: return@map null
        SessionData(
            accessToken = access,
            refreshToken = prefs[keyRefresh].orEmpty(),
            email = prefs[keyEmail].orEmpty(),
            userId = prefs[keyUserId].orEmpty(),
        )
    }

    suspend fun save(data: SessionData) {
        context.dataStore.edit { prefs ->
            prefs[keyAccess] = data.accessToken
            prefs[keyRefresh] = data.refreshToken
            prefs[keyEmail] = data.email
            prefs[keyUserId] = data.userId
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}

data class SessionData(
    val accessToken: String,
    val refreshToken: String,
    val email: String,
    val userId: String,
)
