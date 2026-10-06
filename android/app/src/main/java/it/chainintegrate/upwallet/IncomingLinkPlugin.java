package it.chainintegrate.upwallet;

import android.content.Intent;
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
