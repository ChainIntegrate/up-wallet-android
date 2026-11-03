package it.chainintegrate.upwallet;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.webkit.WebViewAssetLoader;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.util.Arrays;

import javax.crypto.Cipher;

/**
 * The signing window (from 0.10.0), as in the browser extension: what the phone key signs is shown and
 * computed here, not by the wallet page.
 *
 * The wallet page (and everything it loads: dApps' requests, WalletConnect, the network) can only send a
 * structured request through PhoneKeyPlugin.request(). This activity opens over the app with its own
 * WebView, which loads only the app's signing code (assets/signer/, served by WebViewAssetLoader at
 * https://appassets.androidplatform.net/assets/signer/): no network, no navigation, no other page. Its
 * script (app/signer/signer.js with sign-plan.js, the extension's own file) computes the digest again from
 * the request, shows it, and after "Sign" asks this activity for the signature: only then the fingerprint
 * prompt opens, over this window, and the key signs that digest. The answer (a signature or a signed
 * transaction) goes back to the page's call; closing the window rejects it (4001).
 *
 * The only way to the key is the SignerBridge, which exists only in this WebView.
 */
public class SignerActivity extends FragmentActivity {
    private static final String START = "https://appassets.androidplatform.net/assets/signer/signer.html";

    /** The request waiting for this window: one at a time. */
    static final class Pending {
        final PluginCall call;
        final String request;
        final String lang;
        boolean answered = false;
        Pending(PluginCall call, String request, String lang) { this.call = call; this.request = request; this.lang = lang; }
    }

    private static Pending pending;

    static synchronized boolean offer(Pending p) {
        if (pending != null) return false;
        pending = p;
        return true;
    }
    static synchronized void drop() { pending = null; }
    private static synchronized Pending current() { return pending; }

    private Pending mine;
    private WebView web;
    private boolean signing = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mine = current();
        // Opened again by the system without a request (e.g. after the process was restarted): nothing to sign.
        if (mine == null || mine.answered) { finish(); return; }

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0x0f, 0x11, 0x15));
        // A window drawn over this one (another app's overlay) must not be able to press "Sign".
        web.setFilterTouchesWhenObscured(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setDomStorageEnabled(false);
        s.setDatabaseEnabled(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);   // nothing from the network is loaded
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && "appassets.androidplatform.net".equals(u.getHost())
                        && u.getPath() != null && u.getPath().startsWith("/assets/signer/")) {
                    WebResourceResponse r = loader.shouldInterceptRequest(u);
                    if (r != null) return r;
                }
                // Anything else (the network, other assets): nothing.
                return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", new java.util.HashMap<>(), new ByteArrayInputStream(new byte[0]));
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { return true; }   // no navigation
        });
        web.addJavascriptInterface(new Bridge(), "SignerBridge");
        setContentView(web);
        web.loadUrl(START);
    }

    @Override
    protected void onDestroy() {
        // Closed without an answer (back, the task removed): the page's request is rejected.
        if (mine != null && !isChangingConfigurations()) answerReject("4001", "User rejected the request.");
        if (web != null) { web.removeJavascriptInterface("SignerBridge"); web.destroy(); web = null; }
        super.onDestroy();
    }

    private synchronized boolean take() {
        if (mine == null || mine.answered) return false;
        mine.answered = true;
        drop();
        return true;
    }
    private void answerResolve(String result) {
        if (!take()) return;
        JSObject ret = new JSObject();
        ret.put("result", result);
        mine.call.resolve(ret);
    }
    private void answerReject(String code, String message) {
        if (!take()) return;
        mine.call.reject(message == null || message.isEmpty() ? "rejected" : message, code);
    }

    private void js(String fn, String... args) {
        StringBuilder sb = new StringBuilder("window.").append(fn).append(" && window.").append(fn).append("(");
        for (int i = 0; i < args.length; i++) { if (i > 0) sb.append(","); sb.append(JSONObject.quote(args[i])); }
        sb.append(")");
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(sb.toString(), null); });
    }
    private void failed(String code, String message) { signing = false; js("__upwFailed", code, message == null ? "" : message); }

    // The signature of a digest computed by the window, after the fingerprint prompt. Main thread.
    private void sign(String digestHex, String title) {
        if (signing || mine == null || mine.answered) return;
        byte[] digest = PhoneKeyPlugin.hex(digestHex);
        if (digest == null || digest.length != 32) { failed("FAILED", "digest must be 32 bytes"); return; }
        SharedPreferences p = PhoneKeyPlugin.prefs(this);
        if (!p.contains("ct") || !PhoneKeyPlugin.keyExists()) { failed("NO_KEY", "no phone key"); return; }
        Cipher cipher;
        try { cipher = PhoneKeyPlugin.decryptCipher(this); }
        catch (KeyPermanentlyInvalidatedException e) {
            failed("INVALIDATED", "the phone key can no longer be unlocked (the screen lock changed): create a new one and revoke the old one"); return;
        } catch (Exception e) { failed("FAILED", "cannot open the key: " + e.getMessage()); return; }
        final String expected = p.getString("address", "");
        final byte[] ct = Base64.decode(p.getString("ct", ""), Base64.NO_WRAP);
        signing = true;
        BiometricPrompt prompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                BiometricPrompt.CryptoObject co = result.getCryptoObject();
                if (co == null || co.getCipher() == null) { failed("FAILED", "no key after authentication"); return; }
                byte[] priv = null;
                try {
                    priv = co.getCipher().doFinal(ct);
                    byte[] sig = Secp256k1.sign(priv, digest);
                    // The signature must recover to the stored address: a wrong key never leaves this method.
                    if (!expected.equals(Secp256k1.recoverAddress(digest, sig))) { failed("FAILED", "signature check failed"); return; }
                    signing = false;
                    js("__upwSigned", PhoneKeyPlugin.toHex(sig));
                } catch (Exception e) { failed("FAILED", "failed: " + e.getMessage()); }
                finally { if (priv != null) Arrays.fill(priv, (byte) 0); }
            }
            @Override
            public void onAuthenticationError(int code, CharSequence msg) {
                boolean canceled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                boolean noAuth = code == BiometricPrompt.ERROR_NO_BIOMETRICS || code == BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL || code == BiometricPrompt.ERROR_HW_NOT_PRESENT || code == BiometricPrompt.ERROR_HW_UNAVAILABLE;
                failed(canceled ? "CANCELED" : noAuth ? "NO_AUTH" : "FAILED", String.valueOf(msg));
            }
        });
        boolean it = "it".equals(mine.lang);
        String t = title == null || title.isEmpty() ? "UP Wallet" : title.length() > 60 ? title.substring(0, 60) : title;
        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(t)
            .setSubtitle(it ? "Firma con la chiave del telefono" : "Sign with the phone key")
            .setConfirmationRequired(true)
            .setAllowedAuthenticators(PhoneKeyPlugin.authenticators());
        if (Build.VERSION.SDK_INT < 30) info.setNegativeButtonText(it ? "Annulla" : "Cancel");
        try { prompt.authenticate(info.build(), new BiometricPrompt.CryptoObject(cipher)); }
        catch (Exception e) { failed("FAILED", "cannot ask for the fingerprint: " + e.getMessage()); }
    }

    /** The window's script talks to the native side only through this object (signer.js). */
    private final class Bridge {
        @JavascriptInterface
        public String request() {
            Pending p = mine;
            if (p == null || p.answered) return "null";
            try {
                JSONObject o = new JSONObject();
                o.put("request", new JSONObject(p.request));
                o.put("address", PhoneKeyPlugin.prefs(SignerActivity.this).getString("address", ""));
                o.put("lang", p.lang);
                return o.toString();
            } catch (Exception e) { return "null"; }
        }
        @JavascriptInterface
        public void sign(String digest, String title) { runOnUiThread(() -> SignerActivity.this.sign(digest, title)); }
        @JavascriptInterface
        public void done(String result) {
            runOnUiThread(() -> {
                if (result == null || result.length() > 256 * 1024) return;
                answerResolve(result);
                finish();
            });
        }
        @JavascriptInterface
        public void reject(String code, String message) {
            runOnUiThread(() -> {
                answerReject(code == null ? "4001" : code.length() > 16 ? code.substring(0, 16) : code, message == null ? "" : message.length() > 500 ? message.substring(0, 500) : message);
                finish();
            });
        }
    }
}
