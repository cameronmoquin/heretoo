package social.heretoo.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import java.io.ByteArrayOutputStream
import android.os.UserManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.Queues
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native bridge for HereToo's kiosk mode.
 *
 * Every call is a no-op-with-status unless the app holds device owner, so the
 * JS side can call these unconditionally on any build without crashing.
 *
 * Device owner is granted once, over ADB, on a factory-reset phone with no
 * Google account. See docs/KIOSK_PROVISIONING.md.
 */
class HereTooKioskModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val currentActivity: Activity
    get() = appContext.activityProvider?.currentActivity
      ?: throw Exceptions.MissingActivity()

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE)
      as DevicePolicyManager

  private val adminComponent: ComponentName
    get() = ComponentName(context.applicationContext, KioskAdminReceiver::class.java)

  private val isOwner: Boolean
    get() = dpm.isDeviceOwnerApp(context.packageName)

  /**
   * Restrictions applied by `provision()`.
   *
   * DISALLOW_DEBUGGING_FEATURES is deliberately NOT here — it kills ADB, which
   * is the only remote left for fixing a misbehaving device. Pass it explicitly
   * via setRestrictions() once you are confident, and read the warning in
   * docs/KIOSK_PROVISIONING.md first.
   */
  private val defaultRestrictions = listOf(
    UserManager.DISALLOW_FACTORY_RESET,
    UserManager.DISALLOW_ADD_USER,
    UserManager.DISALLOW_SAFE_BOOT,
    UserManager.DISALLOW_INSTALL_APPS,
    UserManager.DISALLOW_UNINSTALL_APPS,
    UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
    UserManager.DISALLOW_MODIFY_ACCOUNTS,
    UserManager.DISALLOW_CONFIG_TETHERING,
    UserManager.DISALLOW_OUTGOING_BEAM
  )

  override fun definition() = ModuleDefinition {
    Name("HereTooKiosk")

    /**
     * Cheap, side-effect-free snapshot. Safe to poll from JS.
     */
    Function("getStatus") {
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val lockState =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) am.lockTaskModeState
        else ActivityManager.LOCK_TASK_MODE_NONE

      mapOf(
        "isDeviceOwner" to isOwner,
        "isLocked" to (lockState != ActivityManager.LOCK_TASK_MODE_NONE),
        "isPinnedOnly" to (lockState == ActivityManager.LOCK_TASK_MODE_PINNED),
        "isDefaultHome" to isDefaultHome(),
        "packageName" to context.packageName,
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }

    /**
     * One-time setup after device owner is granted. Idempotent — safe to call
     * on every cold start, which is what we do from the JS layer.
     *
     * allowedPackages: extra packages permitted inside lock task alongside us
     * (e.g. the dialer). Our own package is always included.
     */
    AsyncFunction("provision") { allowedPackages: List<String>?, promise: Promise ->
      if (!isOwner) {
        promise.reject(
          "ERR_NOT_DEVICE_OWNER",
          "HereToo is not the device owner. Run the adb provisioning step first.",
          null
        )
        return@AsyncFunction
      }

      val packages = (listOf(context.packageName) + (allowedPackages ?: emptyList()))
        .distinct()
        .toTypedArray()

      dpm.setLockTaskPackages(adminComponent, packages)

      // Become the permanent launcher: no chooser dialog, survives reboot.
      val launcher = resolveLauncherComponent()
      if (launcher == null) {
        promise.reject(
          "ERR_NO_LAUNCHER",
          "Could not resolve this app's launcher activity. The HOME intent " +
            "filter is missing — was this built with HERETOO_KIOSK=1?",
          null
        )
        return@AsyncFunction
      }

      dpm.addPersistentPreferredActivity(
        adminComponent,
        IntentFilter(Intent.ACTION_MAIN).apply {
          addCategory(Intent.CATEGORY_HOME)
          addCategory(Intent.CATEGORY_DEFAULT)
        },
        launcher
      )

      defaultRestrictions.forEach { dpm.addUserRestriction(adminComponent, it) }

      // Keep the screen from sleeping into a keyguard we cannot dismiss.
      dpm.setKeyguardDisabled(adminComponent, true)

      promise.resolve(mapOf("allowedPackages" to packages.toList()))
    }

    /**
     * Enter lock task. Kills the status shade, Recents, and Home escape.
     * Must run on the UI thread and after setLockTaskPackages, or Android
     * downgrades us to "screen pinning" with its confirmation dialog.
     */
    AsyncFunction("lock") { promise: Promise ->
      val activity = currentActivity

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && isOwner) {
        // GLOBAL_ACTIONS: the power menu, so the phone can be turned off.
        //
        // HOME: required the moment more than one app is whitelisted. Lock
        // task suppresses the Home button by default, which is correct for a
        // true single-app kiosk but traps a child inside any secondary app
        // they launch — PBS Kids has no "exit to HereToo" affordance and the
        // Back button bottoms out in its own UI. With HOME enabled and
        // HereToo registered as the launcher, Home always returns here.
        //
        // This does NOT restore the app drawer or the notification shade;
        // Home resolves to our persistent preferred activity and nothing else.
        dpm.setLockTaskFeatures(
          adminComponent,
          DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS or
            DevicePolicyManager.LOCK_TASK_FEATURE_HOME
        )
      }

      activity.startLockTask()
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)

    /**
     * Leave lock task. Used by the parent escape hatch — this does NOT drop
     * device owner, so `lock()` puts us straight back.
     */
    AsyncFunction("unlock") { promise: Promise ->
      currentActivity.stopLockTask()
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)

    /**
     * Apply or clear arbitrary UserManager.DISALLOW_* keys at runtime.
     */
    AsyncFunction("setRestrictions") { keys: List<String>, enabled: Boolean, promise: Promise ->
      if (!isOwner) {
        promise.reject("ERR_NOT_DEVICE_OWNER", "Not device owner.", null)
        return@AsyncFunction
      }
      keys.forEach {
        if (enabled) dpm.addUserRestriction(adminComponent, it)
        else dpm.clearUserRestriction(adminComponent, it)
      }
      promise.resolve(true)
    }

    /**
     * Resolve display metadata for the app shelf. Skips anything not
     * installed rather than erroring, so a whitelist entry for an app that
     * failed to sideload simply does not appear as a tile.
     *
     * Requires QUERY_ALL_PACKAGES (injected by plugins/withKiosk.js) — without
     * it Android 11+ package visibility filtering makes every lookup here
     * throw NameNotFound and the shelf comes back empty.
     */
    Function("getAppInfo") { packages: List<String> ->
      val pm = context.packageManager
      packages.mapNotNull { pkg ->
        try {
          val info = pm.getApplicationInfo(pkg, 0)
          // An app with no launch intent (a service, a provider) cannot be a
          // tile even though it is installed.
          if (pm.getLaunchIntentForPackage(pkg) == null) return@mapNotNull null
          mapOf(
            "packageName" to pkg,
            "label" to pm.getApplicationLabel(info).toString(),
            "icon" to encodeIcon(pm.getApplicationIcon(info))
          )
        } catch (e: PackageManager.NameNotFoundException) {
          null
        }
      }
    }

    /**
     * Launch a whitelisted app. Staying inside lock task depends on the
     * package being in setLockTaskPackages — launching something outside that
     * list drops the lock, which is why the shelf only ever calls this with
     * entries from KIOSK_ALLOWED_PACKAGES (constants/kioskApps.ts).
     */
    AsyncFunction("launchApp") { packageName: String, promise: Promise ->
      val intent = context.packageManager.getLaunchIntentForPackage(packageName)
      if (intent == null) {
        promise.reject(
          "ERR_NOT_INSTALLED",
          "$packageName is not installed, or exposes no launcher activity.",
          null
        )
        return@AsyncFunction
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)

    /**
     * Escape hatch for the most common real-world failure: the phone is on a
     * new network and cannot reach Supabase, so the app shows nothing.
     * Must leave lock task first or the settings activity is blocked.
     */
    AsyncFunction("openWifiSettings") { promise: Promise ->
      runCatching { currentActivity.stopLockTask() }

      context.startActivity(
        Intent(Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)

    /**
     * Full unprovision: clears restrictions, stops being the launcher, then
     * relinquishes device owner. IRREVERSIBLE without a factory reset —
     * device owner can only be granted on a fresh device.
     */
    AsyncFunction("releaseDeviceOwner") { promise: Promise ->
      if (!isOwner) {
        promise.resolve(false)
        return@AsyncFunction
      }

      runCatching { currentActivity.stopLockTask() }
      defaultRestrictions.forEach {
        runCatching { dpm.clearUserRestriction(adminComponent, it) }
      }
      runCatching { dpm.setKeyguardDisabled(adminComponent, false) }
      runCatching { dpm.clearPackagePersistentPreferredActivities(
        adminComponent, context.packageName
      ) }

      dpm.clearDeviceOwnerApp(context.packageName)
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)
  }

  /**
   * Render an app icon to a base64 PNG data URI so JS can put it straight in
   * an <Image source={{uri}}>. Adaptive icons are Drawables with no single
   * backing bitmap, so this draws onto a canvas rather than casting to
   * BitmapDrawable — that cast is the usual reason launcher icons come back
   * null on modern Android.
   *
   * 144px covers a tile at xxhdpi without bloating the bridge payload; eight
   * icons at this size is roughly 100 KB of base64 total.
   */
  private fun encodeIcon(drawable: Drawable): String? = try {
    val size = 144
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(Canvas(bitmap))

    ByteArrayOutputStream().use { out ->
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
      bitmap.recycle()
      "data:image/png;base64," +
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
  } catch (e: Exception) {
    // A missing icon is a cosmetic problem; the tile falls back to its label.
    null
  }

  /** Are we the activity the system would launch for HOME right now? */
  private fun isDefaultHome(): Boolean {
    val resolved = context.packageManager.resolveActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      PackageManager.MATCH_DEFAULT_ONLY
    )
    return resolved?.activityInfo?.packageName == context.packageName
  }

  /**
   * Find our own HOME activity rather than hardcoding the class name — this
   * module is compiled separately from the app, and a hardcoded
   * "social.heretoo.app.MainActivity" silently breaks if the package is ever
   * renamed. Returns null when the build lacks the HOME intent filter, which
   * is the honest signal that HERETOO_KIOSK=1 was not set.
   */
  private fun resolveLauncherComponent(): ComponentName? {
    val home = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
      .setPackage(context.packageName)

    val info = context.packageManager
      .queryIntentActivities(home, 0)
      .firstOrNull()
      ?: return null

    return ComponentName(info.activityInfo.packageName, info.activityInfo.name)
  }
}
