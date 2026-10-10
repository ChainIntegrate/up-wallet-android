package it.chainintegrate.upwallet;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Links and text that another app hands to UP Wallet, and the way back to the dApp.
 * - A "wc:" link opened with the app, or text shared to it (Share -> UP Wallet): the page reads the
 *   one that started the app with getPending(), and gets later ones as "incoming" events.
 * - "upwallet://..." is UP Wallet's own link, which dApps open to bring it to the front when they send
 *   a request (announced in the WalletConnect metadata): nothing to read, the app just comes forward.
 * - The app that opened either link, when Android says (the referrer), is remembered: "Back to the
 *   dApp" returns to it.
 */
@CapacitorPlugin(name = "IncomingLink")
public class IncomingLinkPlugin extends Plugin {
    private String pending = null;
    private String source = null;   // package of the app that last opened a link to UP Wallet

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        noteSource(intent);
        pending = textOf(intent);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        noteSource(intent);
        String text = textOf(intent);
        if (text == null) return;
        JSObject data = new JSObject();
        data.put("text", text);
        notifyListeners("incoming", data, true);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", pending);
        pending = null;
        call.resolve(ret);
    }

    /**
     * Back to the dApp, in this order:
     * 1. the dApp's own app link ({url}, e.g. "someapp://", announced by the dApp to WalletConnect);
     * 2. the app that opened a link to UP Wallet (its referrer);
     * 3. the default browser's task, on the tab it was showing (its launch intent resumes the task).
     * Returns {ok, via: "dapp" | "source" | "browser", target}; ok=false when none could be opened:
     * the page then just moves to the background.
     */
    @PluginMethod
    public void backToDapp(PluginCall call) {
        JSObject ret = new JSObject();
        PackageManager pm = getContext().getPackageManager();
        String url = call.getString("url");
        if (url != null && !url.isEmpty()) {
            try {
                Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(view);
                ret.put("ok", true); ret.put("via", "dapp"); ret.put("target", url);
                call.resolve(ret);
                return;
            } catch (ActivityNotFoundException | SecurityException e) { /* no app for it: next way */ }
        }
        if (source != null) {
            Intent launch = pm.getLaunchIntentForPackage(source);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getActivity().startActivity(launch);
                    ret.put("ok", true); ret.put("via", "source"); ret.put("target", source);
                    call.resolve(ret);
                    return;
                } catch (ActivityNotFoundException | SecurityException e) { /* next way */ }
            }
        }
        try {
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"));
            ResolveInfo ri = pm.resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY);
            String pkg = ri != null && ri.activityInfo != null ? ri.activityInfo.packageName : null;
            Intent launch = pkg != null && !"android".equals(pkg) ? pm.getLaunchIntentForPackage(pkg) : null;
            if (launch == null) { ret.put("ok", false); call.resolve(ret); return; }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(launch);
            ret.put("ok", true); ret.put("via", "browser"); ret.put("target", pkg);
        } catch (Exception e) {
            ret.put("ok", false);
        }
        call.resolve(ret);
    }

    /** Kept for the page of older builds: the default browser only. */
    @PluginMethod
    public void backToBrowser(PluginCall call) {
        backToDapp(call);
    }

    /**
     * Android's settings of the "dApp requests" notification category, where pop-up (banner)
     * notifications are turned on: some phones (ColorOS among them) keep them off for apps installed
     * from an APK. On Android 7 and older, the app's notification settings.
     */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        String channel = call.getString("channel", "requests");
        Intent intent;
        if (Build.VERSION.SDK_INT >= 26) {
            intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, channel);
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        JSObject ret = new JSObject();
        try {
            getActivity().startActivity(intent);
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
        }
        call.resolve(ret);
    }

    // The app that sent the intent: from the intent's referrer extras, else the activity's referrer
    // (Android fills it for the intent that started or last reached the activity). Not UP Wallet itself.
    private void noteSource(Intent intent) {
        if (intent == null) return;
        String act = intent.getAction();
        if (!Intent.ACTION_VIEW.equals(act) && !Intent.ACTION_SEND.equals(act)) return;
        String pkg = null;
        Uri ref = intent.getParcelableExtra(Intent.EXTRA_REFERRER);
        if (ref == null) {
            String name = intent.getStringExtra(Intent.EXTRA_REFERRER_NAME);
            if (name != null) ref = Uri.parse(name);
        }
        if (ref == null) ref = getActivity().getReferrer();
        if (ref != null && "android-app".equals(ref.getScheme())) pkg = ref.getHost();
        if (pkg != null && !pkg.equals(getContext().getPackageName())) source = pkg;
    }

    private static String textOf(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            return t == null ? null : t.toString();
        }
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri u = intent.getData();
            if (u == null || "upwallet".equals(u.getScheme())) return null;   // our own link: just come forward
            return u.toString();
        }
        return null;
    }
}
