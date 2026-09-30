package expo.modules.proxyhttp

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.os.IBinder
import androidx.core.content.ContextCompat
import org.torproject.jni.TorService

/** In-process Tor with fixed SOCKS and remote-DNS-safe HTTP tunnel ports. */
object EmbeddedTor {
  @Volatile var status: String = TorService.STATUS_OFF
  @Volatile private var bound = false
  @Volatile private var service: TorService? = null

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      intent.getStringExtra(TorService.EXTRA_STATUS)?.let { status = it }
    }
  }

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder) {
      service = (binder as? TorService.LocalBinder)?.service
    }
    override fun onServiceDisconnected(name: ComponentName?) { service = null }
  }

  @Synchronized fun start(ctx: Context) {
    if (bound) return
    val app = ctx.applicationContext
    writeTorrc(app)
    ContextCompat.registerReceiver(app, statusReceiver, IntentFilter(TorService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
    app.bindService(Intent(app, TorService::class.java), connection, Context.BIND_AUTO_CREATE)
    bound = true
  }

  @Synchronized fun stop(ctx: Context) {
    if (!bound) return
    val app = ctx.applicationContext
    try { app.unbindService(connection) } catch (_: IllegalArgumentException) {}
    try { app.unregisterReceiver(statusReceiver) } catch (_: IllegalArgumentException) {}
    service = null
    status = TorService.STATUS_OFF
    bound = false
  }

  fun controlInfo(key: String): String? = try { service?.getInfo(key) } catch (_: Exception) { null }

  private fun writeTorrc(app: Context) {
    try {
      val torrc = TorService.getTorrc(app)
      torrc.parentFile?.mkdirs()
      torrc.writeText("SOCKSPort 9050\nHTTPTunnelPort 8118\n")
    } catch (_: Exception) {}
  }
}
