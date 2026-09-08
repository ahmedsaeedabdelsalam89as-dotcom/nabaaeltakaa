package com.nabaaltaqah.phonebridge

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.IBinder
import android.util.Base64
import org.json.JSONObject
import java.io.*
import java.net.ServerSocket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class BridgeService : Service() {
    private val pool = Executors.newFixedThreadPool(4)
    private val seen = ConcurrentHashMap<String, Long>()
    @Volatile private var running = true
    private var rateWindowStart = System.currentTimeMillis()
    private var rateCount = 0

    override fun onCreate() {
        super.onCreate()
        val ch = "naba_phone_bridge"
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (android.os.Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(ch, "Naba Phone Bridge", NotificationManager.IMPORTANCE_LOW))
        val n = Notification.Builder(this, ch).setContentTitle("Naba Phone Bridge").setContentText("جاهز لاستقبال أوامر الاتصال من نظام الأسطول").setSmallIcon(android.R.drawable.sym_action_call).build()
        startForeground(41, n)
        pool.execute { serve() }
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { running = false; pool.shutdownNow(); super.onDestroy() }

    @Synchronized private fun checkRateLimit() {
        val now = System.currentTimeMillis()
        if (now - rateWindowStart >= 60_000) { rateWindowStart = now; rateCount = 0 }
        rateCount++
        if (rateCount > 20) throw SecurityException("rate limit exceeded")
    }
    private fun checkReplay(cmd: JSONObject) {
        val now = System.currentTimeMillis()
        val ts = cmd.optLong("ts", 0)
        if (kotlin.math.abs(now - ts) > 30_000) throw SecurityException("expired command")
        val id = cmd.optString("requestId", "")
        if (id.length !in 8..128) throw SecurityException("missing requestId")
        seen.entries.removeIf { now - it.value > 120_000 }
        if (seen.putIfAbsent(id, now) != null) throw SecurityException("replayed command")
    }
    private fun decrypt(obj: JSONObject): JSONObject {
        val secret = BridgeSecretStore.getOrCreate(this)
        val key = SecretKeySpec(Base64.decode(secret, Base64.NO_WRAP), "AES")
        val iv = Base64.decode(obj.getString("iv"), Base64.NO_WRAP)
        if (iv.size != 12) throw SecurityException("invalid IV")
        val data = Base64.decode(obj.getString("ciphertext"), Base64.NO_WRAP)
        if (data.size > 16_384) throw SecurityException("encrypted payload too large")
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return JSONObject(String(c.doFinal(data), StandardCharsets.UTF_8))
    }
    private fun readRequest(input: BufferedReader): String {
        val requestLine = input.readLine() ?: throw EOFException("missing request line")
        if (requestLine != "POST /v1/command HTTP/1.1" && requestLine != "POST /v1/command HTTP/1.0")
            throw SecurityException("unsupported request target")
        var line: String?; var len = 0
        while (true) {
            line = input.readLine() ?: break
            if (line.isEmpty()) break
            if (line.lowercase().startsWith("content-length:")) len = line.substringAfter(':').trim().toIntOrNull() ?: 0
        }
        if (len !in 1..32_768) throw SecurityException("invalid content length")
        val chars = CharArray(len); var off = 0
        while (off < len) { val n = input.read(chars, off, len - off); if (n <= 0) break; off += n }
        if (off != len) throw EOFException("truncated request")
        return String(chars)
    }
    private fun serve() {
        ServerSocket(8765).use { server ->
            server.reuseAddress = true
            while (running) {
                val sock = server.accept(); sock.soTimeout = 5_000
                pool.execute {
                    sock.use { s ->
                        try {
                            checkRateLimit()
                            val body = readRequest(BufferedReader(InputStreamReader(s.getInputStream())))
                            val cmd = decrypt(JSONObject(body))
                            checkReplay(cmd)
                            handle(cmd)
                            respond(s, true, "ok")
                        } catch (e: Exception) { respond(s, false, e.message ?: "error") }
                    }
                }
            }
        }
    }
    private fun handle(cmd: JSONObject) {
        when (cmd.getString("action")) {
            "ping" -> return
            "call" -> placeCall(cmd.getJSONObject("data").getString("phone"))
            else -> throw SecurityException("unsupported action")
        }
    }
    private fun placeCall(phone: String) {
        if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) throw SecurityException("CALL_PHONE permission missing")
        val safe = phone.filter { it.isDigit() || it == '+' }
        if (safe.length !in 7..20 || safe.count { it == '+' } > 1 || ('+' in safe && !safe.startsWith('+'))) throw SecurityException("invalid phone")
        startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:$safe")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    private fun respond(sock: java.net.Socket, ok: Boolean, msg: String) {
        val safeMsg = msg.take(180)
        val b = JSONObject().put("ok", ok).put("message", safeMsg).toString().toByteArray()
        val out = sock.getOutputStream()
        out.write("HTTP/1.1 ${if (ok) 200 else 400} ${if (ok) "OK" else "Bad Request"}\r\nContent-Type: application/json\r\nContent-Length: ${b.size}\r\nConnection: close\r\n\r\n".toByteArray())
        out.write(b); out.flush()
    }
}
