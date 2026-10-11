package it.chainintegrate.upwallet;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Starts and stops KeepAliveService: the page calls start when a dApp session opens, stop when none is left.
 * The service is started with startService, not startForegroundService: Android may refuse to make it a
 * foreground service (Android 15+: the daily time limit of data sync services, about 6 hours a day), and
 * a service started with startForegroundService that does not go to the foreground crashes the app.
 * Started this way, a refused service just stops; the page reads why with status().
 */
@CapacitorPlugin(name = "KeepAlive")
public class KeepAlivePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), KeepAliveService.class);
        i.putExtra("text", call.getString("text", ""));
        i.putExtra("channel", call.getString("channel", "UP Wallet"));
        try {
            KeepAliveService.lastError = null;
            getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** {running, error}: whether the service is in the foreground, and why Android refused it last. */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", KeepAliveService.running);
        ret.put("error", KeepAliveService.lastError);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), KeepAliveService.class));
        call.resolve();
    }
}
