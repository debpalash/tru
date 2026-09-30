package expo.modules.proxyhttp

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.TimeUnit

/** Text HTTP with an optional per-request CONNECT proxy. */
class ProxyHttpModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ProxyHttp")

    AsyncFunction("startEmbeddedTor") { promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) { promise.reject("ERR_TOR", "no context", null); return@AsyncFunction }
      try { EmbeddedTor.start(ctx); promise.resolve(true) }
      catch (e: Exception) { promise.reject("ERR_TOR", e.message ?: "start failed", e) }
    }
    AsyncFunction("stopEmbeddedTor") { promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) { promise.resolve(false); return@AsyncFunction }
      try { EmbeddedTor.stop(ctx) } catch (_: Exception) {}
      promise.resolve(true)
    }
    Function("getTorStatus") { EmbeddedTor.status }
    AsyncFunction("getTorInfo") { promise: Promise ->
      try {
        val read = EmbeddedTor.controlInfo("traffic/read")?.trim()?.toLongOrNull() ?: 0L
        val written = EmbeddedTor.controlInfo("traffic/written")?.trim()?.toLongOrNull() ?: 0L
        val built = (EmbeddedTor.controlInfo("circuit-status") ?: "").split("\n").map { it.trim() }.filter {
          it.isNotEmpty() && it.split(" ").getOrNull(1) == "BUILT"
        }
        val general = built.firstOrNull { it.contains("PURPOSE=GENERAL") } ?: built.firstOrNull()
        val pathToken = general?.split(" ")?.drop(2)?.firstOrNull { it.startsWith("$") && !it.contains("=") }
        val path = pathToken?.split(",")?.joinToString(" › ") { hop ->
          hop.substringAfter("~", "").ifEmpty { hop.substringBefore("~").removePrefix("$").take(8) }
        } ?: ""
        promise.resolve(mapOf("read" to read.toDouble(), "written" to written.toDouble(), "circuits" to built.size, "path" to path))
      } catch (_: Exception) { promise.resolve(null) }
    }

    val orbotPackage = "org.torproject.android"
    Function("isOrbotInstalled") {
      val ctx = appContext.reactContext ?: return@Function false
      try { ctx.packageManager.getPackageInfo(orbotPackage, 0); true } catch (_: Exception) { false }
    }
    AsyncFunction("openOrbot") { promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) { promise.reject("ERR_TOR", "no context", null); return@AsyncFunction }
      try {
        val launch = ctx.packageManager.getLaunchIntentForPackage(orbotPackage)
        if (launch != null) {
          ctx.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); promise.resolve(true)
        } else {
          val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$orbotPackage")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          try { ctx.startActivity(market) } catch (_: Exception) {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$orbotPackage")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          }
          promise.resolve(false)
        }
      } catch (e: Exception) { promise.reject("ERR_TOR", e.message ?: "open failed", e) }
    }

    /**
     * Android's WebView proxy is process-wide. Removing Chromium's implicit
     * bypass rules is intentional: a dead proxy must fail instead of leaking
     * the request over a direct connection.
     */
    AsyncFunction("setWebViewProxy") { hostPort: String?, promise: Promise ->
      if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {
        Log.i(TAG, "WebView proxy override unsupported")
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        val controller = ProxyController.getInstance()
        if (hostPort.isNullOrBlank()) {
          controller.clearProxyOverride({ it.run() }) { Log.i(TAG, "WebView proxy cleared") }
        } else {
          val config = ProxyConfig.Builder()
            .addProxyRule("http://$hostPort")
            .removeImplicitRules()
            .build()
          controller.setProxyOverride(config, { it.run() }) { Log.i(TAG, "WebView proxy = $hostPort") }
        }
        promise.resolve(true)
      } catch (error: Throwable) {
        Log.w(TAG, "Could not change WebView proxy", error)
        promise.resolve(false)
      }
    }

    AsyncFunction("request") { url: String, method: String, headers: Map<String, String>, body: String?, proxyHost: String?, proxyPort: Int, timeoutMs: Int, promise: Promise ->
      try {
        val timeout = timeoutMs.toLong()
        val builder = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
          .connectTimeout(timeout, TimeUnit.MILLISECONDS)
          .readTimeout(timeout, TimeUnit.MILLISECONDS)
          .writeTimeout(timeout, TimeUnit.MILLISECONDS)
          .callTimeout(timeout, TimeUnit.MILLISECONDS)
          .retryOnConnectionFailure(false)
        if (!proxyHost.isNullOrEmpty() && proxyPort > 0) builder.proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress(proxyHost, proxyPort)))
        val request = Request.Builder().url(url)
        for ((key, value) in headers) {
          if (key.equals("accept-encoding", ignoreCase = true)) continue
          try { request.addHeader(key, value) } catch (_: Exception) {}
        }
        val verb = method.uppercase()
        if (verb in listOf("POST", "PUT", "PATCH", "DELETE")) {
          val contentType = headers["content-type"] ?: headers["Content-Type"]
          request.method(verb, (body ?: "").toRequestBody(contentType?.toMediaTypeOrNull()))
        } else request.method(verb, null)
        builder.build().newCall(request.build()).enqueue(object : Callback {
          override fun onFailure(call: Call, error: IOException) { promise.reject("ERR_PROXY_HTTP", error.message ?: "request failed", error) }
          override fun onResponse(call: Call, response: Response) {
            response.use { promise.resolve(mapOf("status" to it.code, "body" to (try { it.body?.string() ?: "" } catch (_: Exception) { "" }))) }
          }
        })
      } catch (e: Exception) { promise.reject("ERR_PROXY_HTTP", e.message ?: "error", e) }
    }
  }

  companion object {
    private const val TAG = "TruProxyHttp"
  }
}
