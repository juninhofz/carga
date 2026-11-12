package ch.duartesantos.opengym;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * CARGA: the running workout on the Android lock screen, the same activity the iPhone shows
 * (lib/live-activity.js builds it for both; LiveActivityPlugin.java is this side's plugin). The set
 * to do now, or the rest or the hold counting down, the next one, and two buttons:
 *   during a set   Concluir série (setDone) · Próximo exercício (next)
 *   in a rest      Pular descanso (restSkip) · +15s (restAdd)
 *   in a hold      Próximo (setDone) · Pausar (autoStop)
 * A tap is queued for the page (it applies it through the workout screen when it wakes) and the
 * panel moves on by itself, as the iPhone's does: the next set, a rest started here with its own
 * end alarm (RestAlert.bookFromPanel), so a phone that stays locked keeps going.
 */
public class WorkoutPanelService extends Service {
    static final String ACTION_SHOW = "carga.workout.SHOW";
    static final String ACTION_TAP = "carga.workout.TAP";
    static final String ACTION_END = "carga.workout.END";
    private static final String CHANNEL = "carga_workout";
    private static final int NOTIFICATION_ID = 7202;

    static volatile WorkoutPanelService current;
    static volatile JSONObject attributes = new JSONObject();
    static volatile JSONObject state = new JSONObject();

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean foreground;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        current = this;
        if (ACTION_END.equals(action)) { end(); return START_NOT_STICKY; }
        if (ACTION_TAP.equals(action)) tap(intent.getStringExtra("what"));
        show();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (current == this) current = null;
        super.onDestroy();
    }

    private void end() {
        if (current == this) current = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    // ---------------- the taps ----------------
    private static long restEndsAt() { long v = state.optLong("restEndsAt", 0); return v > System.currentTimeMillis() ? v : 0; }
    private static long holdEndsAt() { long v = state.optLong("holdEndsAt", 0); return v > System.currentTimeMillis() ? v : 0; }
    private static String wid() { return attributes.optString("wid", ""); }

    private void tap(String what) {
        if (what == null) return;
        long now = System.currentTimeMillis();
        JSONObject cur = state.optJSONObject("cur");
        try {
            if ("done".equals(what) && cur != null) {
                LiveActivityPlugin.queue(new JSONObject().put("type", "setDone").put("wid", wid()).put("exId", cur.optString("exId"))
                        .put("entryIdx", cur.optInt("entryIdx")).put("setIdx", cur.optInt("setIdx")).put("at", now));
                // on to the next set, and its rest
                JSONArray ahead = state.optJSONArray("ahead");
                JSONObject next = ahead != null && ahead.length() > 0 ? ahead.getJSONObject(0) : null;
                JSONArray rest = new JSONArray();
                if (ahead != null) for (int i = 1; i < ahead.length(); i++) rest.put(ahead.get(i));
                state.put("ahead", rest);
                state.put("cur", next == null ? JSONObject.NULL : next);
                state.put("done", state.optInt("done") + 1);
                state.put("holdEndsAt", JSONObject.NULL);
                int restSec = cur.optInt("restAfter", 0);
                if (restSec > 0 && next != null) {
                    long at = now + restSec * 1000L;
                    state.put("restEndsAt", at);
                    state.put("restTotal", restSec);
                    RestAlert.bookFromPanel(this, at, attributes.optJSONObject("labels") != null ? attributes.optJSONObject("labels").optString("restOver", "Descanso acabou") : "Descanso acabou",
                            "Acabou o descanso. Próxima série: " + spoken(next) + ".");
                } else state.put("restEndsAt", JSONObject.NULL);
            } else if ("next".equals(what) && cur != null) {
                LiveActivityPlugin.queue(new JSONObject().put("type", "next").put("wid", wid()).put("fromEntryIdx", cur.optInt("unit", cur.optInt("entryIdx"))).put("at", now));
                JSONArray starts = state.optJSONArray("unitStarts");
                if (starts != null && starts.length() > 0) {
                    JSONObject to = starts.getJSONObject(0);
                    JSONArray rest = new JSONArray();
                    for (int i = 1; i < starts.length(); i++) rest.put(starts.get(i));
                    state.put("unitStarts", rest);
                    state.put("cur", to);
                    // the sets after it: those of the same exercise from the old list, if any
                    JSONArray ahead = state.optJSONArray("ahead"), keep = new JSONArray();
                    if (ahead != null) for (int i = 0; i < ahead.length(); i++) { JSONObject x = ahead.getJSONObject(i); if (x.optInt("unit") == to.optInt("unit") && x.optInt("setIdx") > to.optInt("setIdx")) keep.put(x); }
                    state.put("ahead", keep);
                }
            } else if ("skip".equals(what)) {
                LiveActivityPlugin.queue(new JSONObject().put("type", "restSkip").put("wid", wid()).put("at", now));
                state.put("restEndsAt", JSONObject.NULL);
                RestAlert.cancelAlarmOnly(this, 42);
            } else if ("plus".equals(what)) {
                LiveActivityPlugin.queue(new JSONObject().put("type", "restAdd").put("wid", wid()).put("sec", 15).put("at", now));
                long at = restEndsAt();
                if (at > 0) {
                    at += 15000;
                    state.put("restEndsAt", at);
                    RestAlert.bookFromPanel(this, at, "Descanso acabou", null);
                }
            } else if ("autoStop".equals(what)) {
                LiveActivityPlugin.queue(new JSONObject().put("type", "autoStop").put("wid", wid()).put("at", now));
                state.put("holdEndsAt", JSONObject.NULL);
                state.put("auto", false);
            }
        } catch (Exception ignored) { }
    }

    /** "agachamento, 8 × 100 kg" as the voice says it. */
    private static String spoken(JSONObject set) {
        String name = set.optString("exName", "");
        String target = set.optString("target", "").replace("×", "vezes");
        return target.isEmpty() ? name : name + ", " + target;
    }

    // ---------------- the panel ----------------
    private void channel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Treino em andamento", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("A série, o descanso e os botões na tela de bloqueio.");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(false);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
    }

    private PendingIntent tapIntent(String what, int code) {
        Intent i = new Intent(this, WorkoutPanelService.class).setAction(ACTION_TAP).putExtra("what", what);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String line(JSONObject set) {
        if (set == null) return "";
        String a = set.optString("setLine", ""), b = set.optString("target", "");
        return b.isEmpty() ? a : a + " · " + b;
    }

    private void fill(RemoteViews v, boolean big) {
        JSONObject cur = state.optJSONObject("cur");
        JSONObject labels = attributes.optJSONObject("labels");
        if (labels == null) labels = new JSONObject();
        long rest = restEndsAt(), hold = holdEndsAt();
        boolean resting = rest > 0, holding = !resting && hold > 0;
        int done = state.optInt("done"), total = Math.max(1, state.optInt("total"));
        if (cur == null) {
            v.setTextViewText(R.id.wk_name, labels.optString("allDone", "Todas as séries feitas"));
            v.setTextViewText(R.id.wk_line, "Abra o CARGA para terminar o treino");
        } else {
            v.setTextViewText(R.id.wk_name, cur.optString("exName"));
            v.setTextViewText(R.id.wk_line, line(cur));
        }
        // the clock: the rest or the hold, counting down
        if (resting || holding) {
            long at = resting ? rest : hold;
            v.setChronometer(R.id.wk_clock, SystemClock.elapsedRealtime() + (at - System.currentTimeMillis()), null, true);
            if (Build.VERSION.SDK_INT >= 24) v.setChronometerCountDown(R.id.wk_clock, true);
            v.setViewVisibility(R.id.wk_clock, View.VISIBLE);
        } else v.setViewVisibility(R.id.wk_clock, View.GONE);
        if (big) {
            boolean stretch = holding && attributes.optString("name", "").toLowerCase(Locale.ROOT).contains("along");
            v.setTextViewText(R.id.wk_kind, resting ? "DESCANSO" : holding ? (stretch ? "ALONGAMENTO" : "SEGURE") : "TREINO");
            v.setTextViewText(R.id.wk_count, Math.min(total, done + 1) + " de " + total);
            v.setViewVisibility(R.id.wk_set, resting || holding ? View.GONE : View.VISIBLE);
            v.setViewVisibility(R.id.wk_clock_row, resting || holding ? View.VISIBLE : View.GONE);
            if (resting || holding) {
                v.setTextViewText(R.id.wk_clock_label, resting ? "PRÓXIMA SÉRIE" : "AGORA");
                v.setTextViewText(R.id.wk_clock_name, cur != null ? cur.optString("exName") : "");
                v.setTextViewText(R.id.wk_clock_line, cur != null ? line(cur) : "");
            }
            v.setProgressBar(R.id.wk_progress, 100, Math.round(done * 100f / total), false);
            JSONArray ahead = state.optJSONArray("ahead");
            JSONObject after = ahead != null && ahead.length() > 0 ? ahead.optJSONObject(0) : null;
            if (after != null && cur != null && after.optInt("unit") == cur.optInt("unit")) {
                // the next of the same exercise is not news: the next exercise is
                JSONArray starts = state.optJSONArray("unitStarts");
                after = starts != null && starts.length() > 0 ? starts.optJSONObject(0) : after;
            }
            v.setTextViewText(R.id.wk_next, after != null ? "Depois: " + after.optString("exName") + " · " + after.optString("target") : "");
            v.setViewVisibility(R.id.wk_next, after != null ? View.VISIBLE : View.GONE);
            if (resting) {
                setButton(v, R.id.wk_b1, R.id.wk_b1_icon, R.id.wk_b1_text, R.drawable.ic_wk_skip, labels.optString("skipRest", "Pular descanso"), tapIntent("skip", 21));
                setButton(v, R.id.wk_b2, R.id.wk_b2_icon, R.id.wk_b2_text, R.drawable.ic_wk_plus, "15s", tapIntent("plus", 22));
            } else if (holding) {
                setButton(v, R.id.wk_b1, R.id.wk_b1_icon, R.id.wk_b1_text, R.drawable.ic_wk_skip, "Próximo", tapIntent("done", 23));
                setButton(v, R.id.wk_b2, R.id.wk_b2_icon, R.id.wk_b2_text, R.drawable.ic_wk_pause, "Pausar", tapIntent("autoStop", 24));
            } else {
                setButton(v, R.id.wk_b1, R.id.wk_b1_icon, R.id.wk_b1_text, R.drawable.ic_wk_check, labels.optString("done", "Concluir série"), tapIntent("done", 25));
                setButton(v, R.id.wk_b2, R.id.wk_b2_icon, R.id.wk_b2_text, R.drawable.ic_wk_next, labels.optString("nextExercise", "Próximo exercício"), tapIntent("next", 26));
            }
            v.setViewVisibility(R.id.wk_b1, cur != null ? View.VISIBLE : View.GONE);
            v.setViewVisibility(R.id.wk_b2, cur != null ? View.VISIBLE : View.GONE);
        } else {
            if (resting) setButton(v, R.id.wk_b1, R.id.wk_b1_icon, R.id.wk_b1_text, R.drawable.ic_wk_skip, "Pular", tapIntent("skip", 31));
            else setButton(v, R.id.wk_b1, R.id.wk_b1_icon, R.id.wk_b1_text, R.drawable.ic_wk_check, holding ? "Próximo" : "Concluir", tapIntent("done", 32));
            v.setViewVisibility(R.id.wk_b1, cur != null ? View.VISIBLE : View.GONE);
        }
    }

    private static void setButton(RemoteViews v, int box, int icon, int text, int iconRes, String label, PendingIntent pi) {
        v.setImageViewResource(icon, iconRes);
        v.setTextViewText(text, label);
        v.setOnClickPendingIntent(box, pi);
    }

    private Notification build() {
        RemoteViews small = new RemoteViews(getPackageName(), R.layout.workout_panel_small);
        RemoteViews big = new RemoteViews(getPackageName(), R.layout.workout_panel_big);
        fill(small, false);
        fill(big, true);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        JSONObject cur = state.optJSONObject("cur");
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_dumbbell)
            .setColor(0xFFFF6B00)
            .setContentTitle(state.optString("name", "Treino"))
            .setContentText(cur != null ? cur.optString("exName") + " · " + line(cur) : "")
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(tap)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private final Runnable rest = new Runnable() {
        @Override public void run() {
            // when the rest or the hold ran out, the panel goes back to the set
            show();
        }
    };

    void show() {
        channel();
        Notification n = build();
        try {
            if (!foreground) {
                if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
                else startForeground(NOTIFICATION_ID, n);
                foreground = true;
            } else {
                ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, n);
            }
        } catch (Exception ignored) { }
        handler.removeCallbacks(rest);
        long at = Math.max(restEndsAt(), holdEndsAt());
        if (at > 0) handler.postDelayed(rest, at - System.currentTimeMillis() + 300);
    }
}
