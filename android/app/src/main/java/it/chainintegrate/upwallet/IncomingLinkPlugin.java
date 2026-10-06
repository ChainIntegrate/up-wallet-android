package it.chainintegrate.upwallet;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Text that another app hands to UP Wallet: a "wc:" link opened with the app, or text shared to it
 * (Share -> UP Wallet). The page reads the one that started the app with getPending(), and gets later
 * ones as "incoming" events. Only the text is passed on: the page decides what to do with it.
 */
@CapacitorPlugin(name = "IncomingLink")
public class IncomingLinkPlugin extends Plugin {
    private String pending = null;

    @Override
    public void load() {
        pending = textOf(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
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
     * Back to the dApp: brings the default browser's task to the front, on the tab it was showing (its
     * launch intent resumes the existing task, it does not open a new tab). ok=false when there is no
     * default browser (no choice made, or none installed): the page then just moves to the background.
     */
    @PluginMethod
    public void backToBrowser(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"));
            ResolveInfo ri = pm.resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY);
            String pkg = ri != null && ri.activityInfo != null ? ri.activityInfo.packageName : null;
            Intent launch = pkg != null && !"android".equals(pkg) ? pm.getLaunchIntentForPackage(pkg) : null;
            if (launch == null) { ret.put("ok", false); call.resolve(ret); return; }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(launch);
            ret.put("ok", true);
            ret.put("browser", pkg);
        } catch (Exception e) {
            ret.put("ok", false);
        }
        call.resolve(ret);
    }

    private static String textOf(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            return t == null ? null : t.toString();
        }
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri u = intent.getData();
            return u == null ? null : u.toString();
        }
        return null;
    }
}
