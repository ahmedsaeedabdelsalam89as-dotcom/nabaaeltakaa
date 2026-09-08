package com.nabaaltaqah.phonebridge

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object BridgeSecretStore {
    private const val PREFS = "bridge_secure"
    private const val KEY_ALIAS = "naba_phone_bridge_wrap_v1"
    private const val SECRET_CT = "pairing_secret_ct"
    private const val SECRET_IV = "pairing_secret_iv"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        kg.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return kg.generateKey()
    }

    private fun encrypt(context: Context, plain: ByteArray) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val ct = cipher.doFinal(plain)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(SECRET_CT, Base64.encodeToString(ct, Base64.NO_WRAP))
            .putString(SECRET_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .apply()
    }

    private fun decrypt(context: Context): ByteArray? {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ct = p.getString(SECRET_CT, null) ?: return null
        val iv = p.getString(SECRET_IV, null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
        )
        return cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP))
    }

    fun getOrCreate(context: Context): String {
        val existing = try { decrypt(context) } catch (_: Exception) { null }
        if (existing != null && existing.size == 32) return Base64.encodeToString(existing, Base64.NO_WRAP)
        return rotate(context)
    }

    fun rotate(context: Context): String {
        val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
        encrypt(context, secret)
        return Base64.encodeToString(secret, Base64.NO_WRAP)
    }
}
