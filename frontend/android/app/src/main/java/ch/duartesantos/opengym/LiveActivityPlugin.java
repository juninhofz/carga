package ch.duartesantos.opengym;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.HashSet;
import java.util.Set;

/**
 * CARGA: the Android side of the workout's lock-screen activity (lib/live-activity.js), the same
 * calls the iPhone's LiveActivityPlugin.swift answers: status, update({ wid, attributes, state }),
 * end, drain → { events }, ack({ ids }), and a "liveActivityEvent" when the panel queued a tap.
 * The panel itself is WorkoutPanelService. The queue is a file, so a tap survives Android closing
 * the app while the phone is locked; an event leaves it once the page acknowledged it.
 */
@CapacitorPlugin(name = "LiveActivity")
public class LiveActivityPlugin extends Plugin {
    private static volatile LiveActivityPlugin self;
    private static volatile File queueFile;
    private static final Object LOCK = new Object();

    @Override
    public void load() {
        self = this;
        queueFile = new File(getContext().getFilesDir(), "carga-live-queue.jsonl");
    }

    static void queue(JSONObject e) {
        synchronized (LOCK) {
            try {
                e.put("id", "a" + System.currentTimeMillis() + "-" + (int) (Math.random() * 1e6));
                File f = queueFile;
                if (f != null) try (FileWriter w = new FileWriter(f, true)) { w.write(e.toString()); w.write("\n"); }
            } catch (Exception ignored) { }
        }
        LiveActivityPlugin p = self;
        if (p != null) p.notifyListeners("liveActivityEvent", new JSObject());
    }

    private static JSONArray read() {
        JSONArray out = new JSONArray();
        File f = queueFile;
        if (f == null || !f.exists()) return out;
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = r.readLine()) != null) if (!line.trim().isEmpty()) out.put(new JSONObject(line));
        } catch (Exception ignored) { }
        return out;
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", Build.VERSION.SDK_INT >= 26);
        call.resolve(r);
    }

    @PluginMethod
    public void update(PluginCall call) {
        try {
            WorkoutPanelService.attributes = new JSONObject(call.getString("attributes", "{}"));
            WorkoutPanelService.state = new JSONObject(call.getString("state", "{}"));
        } catch (Exception e) { call.reject("bad activity"); return; }
        Context ctx = getContext();
        WorkoutPanelService s = WorkoutPanelService.current;
        if (s != null) s.show();
        else {
            try { ContextCompat.startForegroundService(ctx, new Intent(ctx, WorkoutPanelService.class).setAction(WorkoutPanelService.ACTION_SHOW)); }
            catch (Exception e) { call.reject("panel not started"); return; }
        }
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        if (WorkoutPanelService.current != null) {
            Context ctx = getContext();
            ctx.startService(new Intent(ctx, WorkoutPanelService.class).setAction(WorkoutPanelService.ACTION_END));
        }
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSObject r = new JSObject();
        synchronized (LOCK) {
            JSONArray ev = read();
            r.put("events", ev);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void ack(PluginCall call) {
        JSArray ids = call.getArray("ids");
        Set<String> done = new HashSet<>();
        try { if (ids != null) for (int i = 0; i < ids.length(); i++) done.add(ids.getString(i)); } catch (Exception ignored) { }
        synchronized (LOCK) {
            JSONArray all = read();
            File f = queueFile;
            if (f != null) {
                try (FileWriter w = new FileWriter(f, false)) {
                    for (int i = 0; i < all.length(); i++) {
                        JSONObject e = all.optJSONObject(i);
                        if (e != null && !done.contains(e.optString("id"))) { w.write(e.toString()); w.write("\n"); }
                    }
                } catch (Exception ignored) { }
            }
        }
        call.resolve();
    }
}
