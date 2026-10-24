package it.chainintegrate.upwallet;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.security.keystore.StrongBoxUnavailableException;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * The phone key: the UP controller key kept on this phone (from 0.9.0, instead of MetaMask).
 *
 * The secp256k1 private key is created here and stored only encrypted, with an AES-256-GCM key of the
 * Android Keystore (StrongBox when the phone has it). That AES key can be used only right after the
 * user's fingerprint, face or (Android 11+) PIN, once per use: every signature asks for it. The private
 * key is decrypted in this process only for the signature, then wiped; it never reaches the web page,
 * which sends a 32-byte digest and gets the signature back. App data is not backed up
 * (allowBackup="false"), so there is no copy anywhere: a lost phone or an uninstalled app is handled by
 * revoking the key's address from another controller of the UP.
 *
 *   status()                          → { exists, address, hardware, canAuth }
 *   create({ title, subtitle })       → { address }        (asks for the fingerprint)
 *   sign({ digest, title, subtitle })  → { signature }      (r + s + v, 0x hex; asks for the fingerprint)
 *   remove()                          → {}
 *
 * Errors: code "CANCELED" (the user closed the prompt), "NO_AUTH" (no fingerprint or screen lock set
 * up), "INVALIDATED" (Android dropped the AES key, e.g. the screen lock was removed: the phone key is
 * lost), "NO_KEY", "EXISTS", "BUSY", "FAILED".
 */
@CapacitorPlugin(name = "PhoneKey")
public class PhoneKeyPlugin extends Plugin {
    private static final String ALIAS = "upwallet.phonekey.v1";
    private static final String PREFS = "upwallet.phonekey";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private boolean busy = false;

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private static int authenticators() {
        return Build.VERSION.SDK_INT >= 30
            ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            : BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    @PluginMethod
    public void status(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject ret = new JSObject();
        boolean exists = p.contains("ct") && keyExists();
        ret.put("exists", exists);
        ret.put("address", exists ? p.getString("address", null) : null);
        ret.put("hardware", exists ? hardware() : null);
        ret.put("canAuth", BiometricManager.from(getContext()).canAuthenticate(authenticators()) == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(ret);
    }

    @PluginMethod
    public void create(PluginCall call) {
        if (prefs().contains("ct") && keyExists()) { call.reject("a phone key already exists", "EXISTS"); return; }
        if (BiometricManager.from(getContext()).canAuthenticate(authenticators()) != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("no fingerprint or screen lock set up", "NO_AUTH"); return;
        }
        Cipher cipher;
        try {
            SecretKey k = newAesKey();
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, k);
        } catch (Exception e) { call.reject("cannot create the key: " + e.getMessage(), "FAILED"); return; }
        authenticate(call, cipher, (c) -> {
            byte[] priv = Secp256k1.newPrivateKey(new SecureRandom());
            try {
                String address = Secp256k1.address(priv);
                byte[] ct = c.doFinal(priv);
                prefs().edit()
                    .putString("ct", Base64.encodeToString(ct, Base64.NO_WRAP))
                    .putString("iv", Base64.encodeToString(c.getIV(), Base64.NO_WRAP))
                    .putString("address", address)
                    .commit();
                JSObject ret = new JSObject();
                ret.put("address", address);
                call.resolve(ret);
            } finally { Arrays.fill(priv, (byte) 0); }
        });
    }

    @PluginMethod
    public void sign(PluginCall call) {
        SharedPreferences p = prefs();
        if (!p.contains("ct") || !keyExists()) { call.reject("no phone key", "NO_KEY"); return; }
        byte[] digest = hex(call.getString("digest", ""));
        if (digest == null || digest.length != 32) { call.reject("digest must be 32 bytes", "FAILED"); return; }
        Cipher cipher;
        try {
            KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
            ks.load(null);
            SecretKey k = (SecretKey) ks.getKey(ALIAS, null);
            cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, Base64.decode(p.getString("iv", ""), Base64.NO_WRAP)));
        } catch (KeyPermanentlyInvalidatedException e) {
            call.reject("the phone key can no longer be unlocked (the screen lock changed): create a new one and revoke the old one", "INVALIDATED"); return;
        } catch (Exception e) { call.reject("cannot open the key: " + e.getMessage(), "FAILED"); return; }
        final String expected = p.getString("address", "");
        final byte[] ct = Base64.decode(p.getString("ct", ""), Base64.NO_WRAP);
        authenticate(call, cipher, (c) -> {
            byte[] priv = c.doFinal(ct);
            try {
                byte[] sig = Secp256k1.sign(priv, digest);
                // The signature must recover to the stored address: a wrong key never leaves this method.
                if (!expected.equals(Secp256k1.recoverAddress(digest, sig))) { call.reject("signature check failed", "FAILED"); return; }
                JSObject ret = new JSObject();
                ret.put("signature", toHex(sig));
                call.resolve(ret);
            } finally { Arrays.fill(priv, (byte) 0); }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
            ks.load(null);
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        } catch (Exception e) { /* the stored data goes anyway */ }
        prefs().edit().clear().commit();
        call.resolve();
    }

    private interface WithCipher { void run(Cipher c) throws Exception; }

    // The system prompt (fingerprint, face, or the screen lock's PIN on Android 11+), bound to the cipher:
    // the Keystore releases the AES key for this one operation only after it succeeds.
    private void authenticate(PluginCall call, Cipher cipher, WithCipher then) {
        if (busy) { call.reject("another signature is waiting", "BUSY"); return; }
        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) { call.reject("no activity", "FAILED"); return; }
        busy = true;
        String title = clip(call.getString("title", "UP Wallet"), 60);
        String subtitle = clip(call.getString("subtitle", ""), 120);
        String description = clip(call.getString("description", ""), 300);
        String cancel = clip(call.getString("cancel", "Cancel"), 30);
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    busy = false;
                    try {
                        BiometricPrompt.CryptoObject co = result.getCryptoObject();
                        if (co == null || co.getCipher() == null) { call.reject("no key after authentication", "FAILED"); return; }
                        then.run(co.getCipher());
                    } catch (Exception e) { call.reject("failed: " + e.getMessage(), "FAILED"); }
                }
                @Override
                public void onAuthenticationError(int code, CharSequence msg) {
                    busy = false;
                    boolean canceled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                    boolean noAuth = code == BiometricPrompt.ERROR_NO_BIOMETRICS || code == BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL || code == BiometricPrompt.ERROR_HW_NOT_PRESENT || code == BiometricPrompt.ERROR_HW_UNAVAILABLE;
                    call.reject(String.valueOf(msg), canceled ? "CANCELED" : noAuth ? "NO_AUTH" : "FAILED");
                }
                // A finger not recognised: the prompt stays open and says so; nothing to do here.
            });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title).setConfirmationRequired(true)
                .setAllowedAuthenticators(authenticators());
            if (!subtitle.isEmpty()) info.setSubtitle(subtitle);
            if (!description.isEmpty()) info.setDescription(description);
            if (Build.VERSION.SDK_INT < 30) info.setNegativeButtonText(cancel);
            try { prompt.authenticate(info.build(), new BiometricPrompt.CryptoObject(cipher)); }
            catch (Exception e) { busy = false; call.reject("cannot ask for the fingerprint: " + e.getMessage(), "FAILED"); }
        });
    }

    private boolean keyExists() {
        try { KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE); ks.load(null); return ks.containsAlias(ALIAS); }
        catch (Exception e) { return false; }
    }

    // An AES-256-GCM key in the Keystore, usable only right after authentication, once per use.
    private SecretKey newAesKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        boolean strongBox = Build.VERSION.SDK_INT >= 28 && getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE);
        try { return generate(strongBox); }
        catch (Exception e) {
            if (strongBox && (Build.VERSION.SDK_INT >= 28 && e instanceof StrongBoxUnavailableException)) return generate(false);
            throw e;
        }
    }
    private SecretKey generate(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
            // A new fingerprint added later does not lock the key out (the screen lock already protects
            // adding one); removing the screen lock does (INVALIDATED).
            .setInvalidatedByBiometricEnrollment(false);
        if (Build.VERSION.SDK_INT >= 30) b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        else b.setUserAuthenticationValidityDurationSeconds(-1);
        if (strongBox && Build.VERSION.SDK_INT >= 28) b.setIsStrongBoxBacked(true);
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        kg.init(b.build());
        return kg.generateKey();
    }

    // Where the AES key lives: "strongbox", "tee" (the phone's trusted environment) or "software".
    private String hardware() {
        try {
            KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
            ks.load(null);
            SecretKey k = (SecretKey) ks.getKey(ALIAS, null);
            KeyInfo info = (KeyInfo) SecretKeyFactory.getInstance(k.getAlgorithm(), ANDROID_KEYSTORE).getKeySpec(k, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= 31) {
                int level = info.getSecurityLevel();
                return level == KeyProperties.SECURITY_LEVEL_STRONGBOX ? "strongbox" : level == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ? "tee" : "software";
            }
            return info.isInsideSecureHardware() ? "tee" : "software";
        } catch (Exception e) { return null; }
    }

    private static String clip(String s, int n) { return s == null ? "" : s.length() > n ? s.substring(0, n) : s; }

    private static byte[] hex(String h) {
        if (h == null) return null;
        if (h.startsWith("0x") || h.startsWith("0X")) h = h.substring(2);
        if (h.length() % 2 != 0 || !h.matches("[0-9a-fA-F]*")) return null;
        byte[] b = new byte[h.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(h.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
    private static String toHex(byte[] b) {
        StringBuilder sb = new StringBuilder("0x");
        for (byte x : b) sb.append(String.format("%02x", x & 0xff));
        return sb.toString();
    }
}
