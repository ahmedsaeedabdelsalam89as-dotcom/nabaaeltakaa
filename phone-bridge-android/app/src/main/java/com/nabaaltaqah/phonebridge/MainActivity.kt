package com.nabaaltaqah.phonebridge

import android.Manifest
import android.app.*
import android.content.*
import android.net.ConnectivityManager
import java.net.Inet4Address
import android.os.*
import android.view.WindowManager
import android.widget.*

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContentView(R.layout.activity_main)
        BridgeSecretStore.getOrCreate(this)
        render()
        findViewById<Button>(R.id.grantCall).setOnClickListener {
            if (Build.VERSION.SDK_INT >= 23) requestPermissions(arrayOf(Manifest.permission.CALL_PHONE), 10)
        }
        findViewById<Button>(R.id.startBridge).setOnClickListener {
            startForegroundService(Intent(this, BridgeService::class.java)); render()
        }
        findViewById<Button>(R.id.rotateKey).setOnClickListener {
            BridgeSecretStore.rotate(this); render()
        }
    }
    private fun localIp(): String {
        val cm = applicationContext.getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return "غير متصل"
        val props = cm.getLinkProperties(network) ?: return "غير متصل"
        return props.linkAddresses
            .map { it.address }
            .filterIsInstance<Inet4Address>()
            .firstOrNull { !it.isLoopbackAddress }
            ?.hostAddress ?: "غير متصل"
    }
    private fun render() {
        findViewById<TextView>(R.id.status).text = "جاهز — امنح صلاحية الاتصال مرة واحدة ثم شغّل الربط"
        findViewById<TextView>(R.id.endpoint).text = "العنوان: ${localIp()}:8765"
        findViewById<TextView>(R.id.secret).text = "مفتاح الربط: ${BridgeSecretStore.getOrCreate(this)}"
    }
}
