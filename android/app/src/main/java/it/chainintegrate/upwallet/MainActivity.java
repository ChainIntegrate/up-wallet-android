package it.chainintegrate.upwallet;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncomingLinkPlugin.class);
        registerPlugin(KeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        // The page runs in the WebView's renderer, a separate process. By default its priority drops when
        // the app is not visible, and Android froze it after ~8 minutes in the background even with the
        // keep-alive service running: a dApp request then waited until UP Wallet was opened. Keep the
        // renderer important while the app is in the background (the keep-alive service keeps the app's
        // own process in the foreground only while a dApp is connected).
        if (Build.VERSION.SDK_INT >= 26 && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
    }
}
