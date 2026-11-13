package ch.duartesantos.opengym;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * CARGA: a run, walk or ride recorded by the phone itself (not the WebView), so the GPS keeps
 * going with the screen locked. Every fix and every Pause / Resume / Stop tapped on the panel is
 * queued (drain()) for the page's recorder (lib/run-native.js), which rebuilds the track from them
 * in order; meanwhile this service works out pace, distance and time on its own for the
 * lock-screen panel (layout/run_panel_big.xml, the "Preto com laranja" design). Foreground type
 * location, started while the app is on screen.
 */
public class RunTrackService extends Service {
    static final String ACTION_START = "carga.run.START";
    static final String ACTION_PAUSE = "carga.run.PAUSE";
    static final String ACTION_RESUME = "carga.run.RESUME";
    static final String ACTION_STOP = "carga.run.STOP";
    static final String ACTION_END = "carga.run.END";      // from the page: it finished or discarded
    private static final String CHANNEL = "carga_run";
    private static final int NOTIFICATION_ID = 7201;

    // the queue the page drains, shared with RunTrackerPlugin (same process)
    private static final List<JSONObject> QUEUE = new ArrayList<>();
    static volatile RunTrackService current;
    static volatile Runnable onQueued;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager locations;
    private PowerManager.WakeLock cpu;
    private String type = "run";
    private String title = "Corrida";
    private boolean running, paused, stopped;
    private long movingMs;              // closed running stretches
    private long runningSince;          // elapsedRealtime of the current stretch
    private double distM;
    private Location last;
    private final ArrayDeque<double[]> recent = new ArrayDeque<>(); // [elapsedRealtime, distM] of the last minute

    private final LocationListener listener = new LocationListener() {
        @Override public void onLocationChanged(Location l) { onFix(l); }
        @Override public void onStatusChanged(String p, int s, Bundle b) { }
        @Override public void onProviderEnabled(String p) { }
        @Override public void onProviderDisabled(String p) { }
    };
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            if (!running) return;
            show();
            handler.postDelayed(this, 5000);
        }
    };

    // ---------------- the queue ----------------
    // Also written to a file, one event a line, so a run survives Android closing the app while the
    // phone is locked: drain() reads the file and empties it once the page has the events.
    static volatile java.io.File queueFile;

    static void queue(JSONObject e) {
        synchronized (QUEUE) {
            QUEUE.add(e);
            java.io.File f = queueFile;
            if (f != null) {
                try (java.io.FileWriter w = new java.io.FileWriter(f, true)) { w.write(e.toString()); w.write("\n"); } catch (Exception ignored) { }
            }
        }
        Runnable r = onQueued;
        if (r != null) r.run();
    }

    static JSONArray drain(Context ctx) {
        JSONArray out = new JSONArray();
        synchronized (QUEUE) {
            java.io.File f = queueFile != null ? queueFile : new java.io.File(ctx.getFilesDir(), "carga-run-queue.jsonl");
            if (f.exists()) {
                // the file holds everything (also what the memory holds): read it, then empty both
                try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader(f))) {
                    String line;
                    while ((line = r.readLine()) != null) { if (!line.trim().isEmpty()) out.put(new JSONObject(line)); }
                } catch (Exception ignored) { }
                f.delete();
            } else {
                for (JSONObject e : QUEUE) out.put(e);
            }
            QUEUE.clear();
        }
        return out;
    }

    private static JSONObject event(String kind, long t) {
        JSONObject e = new JSONObject();
        try { e.put("kind", kind); e.put("t", t); } catch (Exception ignored) { }
        return e;
    }

    // ---------------- lifecycle ----------------
    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START.equals(action)) {
            type = intent.getStringExtra("type") != null ? intent.getStringExtra("type") : "run";
            title = intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Corrida";
            begin();
        } else if (ACTION_PAUSE.equals(action)) {
            pause(true);
        } else if (ACTION_RESUME.equals(action)) {
            resume(true);
        } else if (ACTION_STOP.equals(action)) {
            // from the panel: the run ends here; the page saves it when it next runs
            pause(false);
            stopped = true;
            queue(event("stop", System.currentTimeMillis()));
            show();
            end();
        } else if (ACTION_END.equals(action)) {
            end();
        } else if (!running) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @SuppressLint("MissingPermission")
    private void begin() {
        current = this;
        queueFile = new java.io.File(getFilesDir(), "carga-run-queue.jsonl");
        running = true; paused = false; stopped = false;
        movingMs = 0; distM = 0; last = null; recent.clear();
        runningSince = SystemClock.elapsedRealtime();
        channel();
        Notification n = build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(NOTIFICATION_ID, n);
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "carga:run");
            cpu.acquire(6 * 60 * 60 * 1000L);
        } catch (Exception ignored) { }
        locations = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, listener, Looper.getMainLooper());
        } catch (Exception e) {
            queue(event("error", System.currentTimeMillis()));
        }
        handler.postDelayed(refresh, 5000);
    }

    private void pause(boolean fromPanel) {
        if (!running || paused) return;
        paused = true;
        movingMs += SystemClock.elapsedRealtime() - runningSince;
        last = null;
        if (fromPanel) queue(event("pause", System.currentTimeMillis()));
        show();
    }

    private void resume(boolean fromPanel) {
        if (!running || !paused || stopped) return;
        paused = false;
        runningSince = SystemClock.elapsedRealtime();
        recent.clear();
        if (fromPanel) queue(event("resume", System.currentTimeMillis()));
        show();
    }

    /** The page paused or resumed in the app: the panel follows, nothing is queued. */
    void follow(boolean pausedNow) { if (pausedNow) pause(false); else resume(false); }

    private void end() {
        running = false;
        handler.removeCallbacks(refresh);
        try { if (locations != null) locations.removeUpdates(listener); } catch (Exception ignored) { }
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception ignored) { }
        if (current == this) current = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacks(refresh);
        try { if (locations != null) locations.removeUpdates(listener); } catch (Exception ignored) { }
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception ignored) { }
        if (current == this) current = null;
        super.onDestroy();
    }

    // ---------------- the fixes ----------------
    private void onFix(Location l) {
        long t = l.getTime() > 0 ? l.getTime() : System.currentTimeMillis();
        JSONObject e = event("fix", t);
        try {
            e.put("lat", l.getLatitude()); e.put("lng", l.getLongitude());
            e.put("acc", l.hasAccuracy() ? l.getAccuracy() : 99);
            if (l.hasAltitude()) e.put("alt", l.getAltitude());
        } catch (Exception ignored) { }
        queue(e);
        if (!running || paused) return;
        // the panel's own count: good fixes only, no jumps
        if (l.hasAccuracy() && l.getAccuracy() > 30) return;
        if (last != null) {
            float d = last.distanceTo(l);
            double dt = Math.max(0.5, (l.getElapsedRealtimeNanos() - last.getElapsedRealtimeNanos()) / 1e9);
            double max = "ride".equals(type) ? 30 : 12;
            if (d / dt > max) return;
            if (d >= 1.5) distM += d; else return;
        }
        last = l;
        long now = SystemClock.elapsedRealtime();
        recent.addLast(new double[]{now, distM});
        while (!recent.isEmpty() && now - recent.peekFirst()[0] > 60000) recent.removeFirst();
        show();
    }

    private long movingNow() { return movingMs + (paused || !running ? 0 : SystemClock.elapsedRealtime() - runningSince); }

    /** Seconds per km over the last minute, or the average, or 0 when there is too little to say. */
    private double paceSec() {
        if (recent.size() >= 2) {
            double[] a = recent.peekFirst(), b = recent.peekLast();
            double dd = b[1] - a[1], dt = (b[0] - a[0]) / 1000.0;
            if (dd > 20 && dt > 5) return dt / dd * 1000;
        }
        return distM > 50 ? movingNow() / 1000.0 / distM * 1000 : 0;
    }

    /** The numbers the panel shows, for the page (RunTrackerPlugin.snapshot): the app and the lock screen agree. */
    JSONObject snapshotJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("running", running);
            o.put("distM", distM);
            o.put("paceSec", paceSec());
            o.put("movingSec", movingNow() / 1000.0);
            o.put("paused", paused);
            o.put("stopped", stopped);
        } catch (Exception ignored) { }
        return o;
    }

    // ---------------- the panel ----------------
    private void channel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Corrida em andamento", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Pace, distância e tempo na tela de bloqueio, com pausar e parar.");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(false);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
    }

    private PendingIntent action(String a, int code) {
        Intent i = new Intent(this, RunTrackService.class).setAction(a);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void fill(RemoteViews v, boolean big) {
        boolean ride = "ride".equals(type);
        double p = paceSec();
        String paceText;
        if (ride) paceText = movingNow() > 0 && distM > 0 ? String.format(Locale.US, "%.1f", distM / (movingNow() / 1000.0) * 3.6).replace('.', ',') : "0,0";
        else paceText = p > 0 && p < 3600 ? String.format(Locale.US, "%d:%02d", (int) (p / 60), (int) (p % 60)) : "--:--";
        v.setTextViewText(R.id.pace, paceText);
        v.setTextViewText(R.id.pace_label, ride ? "VELOCIDADE" : "PACE");
        v.setTextViewText(R.id.dist, String.format(Locale.US, "%.2f", distM / 1000.0).replace('.', ','));
        long base = SystemClock.elapsedRealtime() - movingNow();
        v.setChronometer(R.id.time, base, null, running && !paused);
        if (big) {
            v.setTextViewText(R.id.pace_unit, ride ? "km/h" : "/km");
            v.setTextViewText(R.id.kind, title.toUpperCase(new Locale("pt", "BR")));
            v.setTextViewText(R.id.state, stopped ? "ENCERRADA" : paused ? "❚❚ PAUSADA" : "● AO VIVO");
            v.setImageViewResource(R.id.btn_pause_icon, paused ? R.drawable.ic_run_play : R.drawable.ic_run_pause);
            v.setTextViewText(R.id.btn_pause_text, paused ? "Retomar" : "Pausar");
            v.setOnClickPendingIntent(R.id.btn_stop, action(ACTION_STOP, 3));
        } else {
            v.setImageViewResource(R.id.btn_pause, paused ? R.drawable.ic_run_play_w : R.drawable.ic_run_pause_w);
        }
        v.setOnClickPendingIntent(R.id.btn_pause, paused ? action(ACTION_RESUME, 2) : action(ACTION_PAUSE, 1));
    }

    private Notification build() {
        RemoteViews small = new RemoteViews(getPackageName(), R.layout.run_panel_small);
        RemoteViews big = new RemoteViews(getPackageName(), R.layout.run_panel_big);
        fill(small, false);
        fill(big, true);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String km = String.format(Locale.US, "%.2f", distM / 1000.0).replace('.', ',');
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_dumbbell)
            .setColor(0xFFFF6B00)
            .setContentTitle(title + " · " + km + " km")
            .setContentText(paused ? "Pausada" : "Em andamento")
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setCustomHeadsUpContentView(small)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setOngoing(!stopped)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(tap)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private void show() {
        try {
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, build());
        } catch (Exception ignored) { }
    }
}
