package social.heretoo.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * The DeviceAdminReceiver that `adb shell dpm set-device-owner` binds to.
 *
 * This class does almost nothing on its own — it exists so the OS has a stable
 * ComponentName to hand device-owner privileges to. All the actual policy work
 * happens in HereTooKioskModule, which passes this component to
 * DevicePolicyManager on every call.
 *
 * Do not rename or move this class without also updating:
 *   - plugins/withKiosk.js (ADMIN_RECEIVER)
 *   - docs/KIOSK_PROVISIONING.md (the adb command)
 * A mismatch means provisioning silently fails with "Not allowed to set the
 * device owner".
 */
class KioskAdminReceiver : DeviceAdminReceiver() {
  companion object {
    private const val TAG = "HereTooKiosk"
  }

  override fun onEnabled(context: Context, intent: Intent) {
    super.onEnabled(context, intent)
    Log.i(TAG, "Device admin enabled")
  }

  override fun onDisabled(context: Context, intent: Intent) {
    super.onDisabled(context, intent)
    Log.i(TAG, "Device admin disabled")
  }

  override fun onLockTaskModeEntering(
    context: Context,
    intent: Intent,
    pkg: String
  ) {
    super.onLockTaskModeEntering(context, intent, pkg)
    Log.i(TAG, "Entered lock task mode: $pkg")
  }

  override fun onLockTaskModeExiting(context: Context, intent: Intent) {
    super.onLockTaskModeExiting(context, intent)
    Log.i(TAG, "Exited lock task mode")
  }
}
