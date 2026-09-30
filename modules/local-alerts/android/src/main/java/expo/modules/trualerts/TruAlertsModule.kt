package expo.modules.trualerts

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Device-only alerts: no push tokens, network connections or remote SDK. */
class TruAlertsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TruAlerts")

    AsyncFunction("requestPermission") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) { promise.resolve(false); return@AsyncFunction }
      val manager = NotificationManagerCompat.from(context)
      if (Build.VERSION.SDK_INT < 33) {
        promise.resolve(manager.areNotificationsEnabled())
      } else {
        val permissions = appContext.permissions
        if (permissions == null) { promise.resolve(false); return@AsyncFunction }
        permissions.askForPermissions({ responses ->
          promise.resolve(responses.values.all { it.status == PermissionsStatus.GRANTED } && manager.areNotificationsEnabled())
        }, Manifest.permission.POST_NOTIFICATIONS)
      }
    }

    AsyncFunction("postAlert") { title: String, body: String, url: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val uri = Uri.parse(url)
      if (uri.scheme != "https" || uri.host.isNullOrEmpty() || uri.userInfo != null) return@AsyncFunction false
      if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return@AsyncFunction false
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channelId = "tru-monitors"
      if (Build.VERSION.SDK_INT >= 26) {
        manager.createNotificationChannel(NotificationChannel(channelId, "Tru monitors", NotificationManager.IMPORTANCE_DEFAULT).apply {
          lockscreenVisibility = Notification.VISIBILITY_PRIVATE
          setSound(null, null)
        })
      }
      val target = Uri.Builder().scheme("tru").authority("browser")
        .appendQueryParameter("url", url).appendQueryParameter("title", "Monitor match").build()
      val intent = Intent(Intent.ACTION_VIEW, target).setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val id = url.hashCode()
      val pending = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channelId) else Notification.Builder(context)
      val notification = builder.setSmallIcon(if (icon != 0) icon else context.applicationInfo.icon)
        .setContentTitle(title.take(160)).setContentText(body.take(300))
        .setStyle(Notification.BigTextStyle().bigText(body.take(300)))
        .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true)
        .setContentIntent(pending).build()
      try { manager.notify(id, notification); true } catch (_: SecurityException) { false }
    }
  }
}
