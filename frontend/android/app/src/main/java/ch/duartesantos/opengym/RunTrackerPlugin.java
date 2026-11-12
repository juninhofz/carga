package ch.duartesantos.opengym;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * CARGA: the page's side of RunTrackService (lib/run-native.js). start / pause / resume / end,
 * drain() for the fixes and panel taps in order, and a "queued" event when there is something to
 * drain while the page is awake.
 */
@CapacitorPlugin(
    name = "RunTracker",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class RunTrackerPlugin extends Plugin {
    @Override
    public void load() {
        RunTrackService.onQueued = () -> notifyListeners("queued", new JSObject());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", true);
        r.put("running", RunTrackService.current != null);
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "afterLocation");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotifications");
            return;
        }
        launch(call);
    }

    @PermissionCallback
    private void afterLocation(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("Sem permissão de localização"); return; }
        start(call);
    }

    @PermissionCallback
    private void afterNotifications(PluginCall call) {
        // without it the run still records; only the panel does not show
        launch(call);
    }

    private void launch(PluginCall call) {
        Intent i = new Intent(getContext(), RunTrackService.class).setAction(RunTrackService.ACTION_START);
        i.putExtra("type", call.getString("type", "run"));
        i.putExtra("title", call.getString("title", "Corrida"));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        RunTrackService s = RunTrackService.current;
        if (s != null) s.follow(true);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        RunTrackService s = RunTrackService.current;
        if (s != null) s.follow(false);
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        if (RunTrackService.current != null) {
            Intent i = new Intent(getContext(), RunTrackService.class).setAction(RunTrackService.ACTION_END);
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSObject r = new JSObject();
        r.put("events", RunTrackService.drain(getContext()));
        call.resolve(r);
    }
}
