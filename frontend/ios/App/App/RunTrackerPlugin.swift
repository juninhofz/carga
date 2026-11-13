import ActivityKit
import Capacitor
import CoreLocation
import Foundation

/**
 * CARGA: a run, walk or ride recorded by the iPhone itself (lib/run-native.js), so the GPS keeps
 * going with the screen locked (background location, the blue pill in the status bar), and its
 * Live Activity on the Lock Screen (RunActivity.swift) shows pace, distance and time with Pausar
 * and Parar. The same calls as Android's RunTrackerPlugin.java: status, start, pause, resume, end,
 * drain → { events } (fixes and panel taps in order, kept in a file until the page has them), and
 * a "queued" event while the page is awake.
 */
@objc(RunTrackerPlugin)
public class RunTrackerPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RunTrackerPlugin"
    public let jsName = "RunTracker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
    ]

    private let manager = CLLocationManager()
    private var running = false, paused = false, stopped = false
    private var type = "run", title = "Corrida"
    private var movingSec: Double = 0
    private var runningSince: Date?
    private var distM: Double = 0
    private var last: CLLocation?
    private var recent: [(Date, Double)] = []
    private var lastPush = Date.distantPast
    private var pendingStart: CAPPluginCall?
    private let lock = NSLock()

    private var queueURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("carga-run-queue.jsonl")
    }

    override public func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = false
        try? FileManager.default.createDirectory(at: queueURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        RunControl.handler = { [weak self] what in self?.panel(what) }
    }

    // ---------------- the queue ----------------
    private var mem: [[String: Any]] = []   // the same events in memory, in case the file fails

    private func queue(_ e: [String: Any]) {
        lock.lock()
        mem.append(e)
        if mem.count > 20000 { mem.removeFirst(mem.count - 20000) }
        try? FileManager.default.createDirectory(at: queueURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONSerialization.data(withJSONObject: e), var line = String(data: data, encoding: .utf8) {
            line += "\n"
            if let h = try? FileHandle(forWritingTo: queueURL) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); try? h.close() }
            else { try? line.write(to: queueURL, atomically: true, encoding: .utf8) }
        }
        lock.unlock()
        notifyListeners("queued", data: [:])
    }

    @objc func drain(_ call: CAPPluginCall) {
        lock.lock()
        var out: [[String: Any]] = []
        if let text = try? String(contentsOf: queueURL, encoding: .utf8) {
            for line in text.split(separator: "\n") {
                if let d = line.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] { out.append(o) }
            }
            try? FileManager.default.removeItem(at: queueURL)
        }
        // the file holds everything memory holds; without it (it could not be written) memory answers
        if out.isEmpty { out = mem }
        mem = []
        lock.unlock()
        call.resolve(["events": out])
    }

    private static func ms(_ d: Date = Date()) -> Double { (d.timeIntervalSince1970 * 1000).rounded() }

    // ---------------- the page's calls ----------------
    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["supported": true, "running": running])
    }

    @objc func start(_ call: CAPPluginCall) {
        type = call.getString("type") ?? "run"
        title = call.getString("title") ?? "Corrida"
        DispatchQueue.main.async {
            let s = self.manager.authorizationStatus
            if s == .notDetermined {
                self.pendingStart = call
                self.manager.requestWhenInUseAuthorization()
                return
            }
            if s == .denied || s == .restricted { call.reject("Sem permissão de localização"); return }
            self.begin()
            call.resolve()
        }
    }

    public func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        guard let call = pendingStart, m.authorizationStatus != .notDetermined else { return }
        pendingStart = nil
        if m.authorizationStatus == .denied || m.authorizationStatus == .restricted { call.reject("Sem permissão de localização"); return }
        begin()
        call.resolve()
    }

    private func begin() {
        // again here, not only at load: without the delegate the GPS runs and nobody hears it
        manager.delegate = self
        RunControl.handler = { [weak self] what in self?.panel(what) }
        running = true; paused = false; stopped = false
        movingSec = 0; distM = 0; last = nil; recent = []
        runningSince = Date()
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        startActivity()
    }

    @objc func pause(_ call: CAPPluginCall) { DispatchQueue.main.async { self.doPause(fromPanel: false); call.resolve() } }
    @objc func resume(_ call: CAPPluginCall) { DispatchQueue.main.async { self.doResume(fromPanel: false); call.resolve() } }
    @objc func end(_ call: CAPPluginCall) { DispatchQueue.main.async { self.finish(); call.resolve() } }

    private func doPause(fromPanel: Bool) {
        guard running, !paused else { return }
        paused = true
        if let s = runningSince { movingSec += Date().timeIntervalSince(s) }
        runningSince = nil
        last = nil
        if fromPanel { queue(["kind": "pause", "t": RunTrackerPlugin.ms()]) }
        push(force: true)
    }

    private func doResume(fromPanel: Bool) {
        guard running, paused, !stopped else { return }
        paused = false
        runningSince = Date()
        recent = []
        if fromPanel { queue(["kind": "resume", "t": RunTrackerPlugin.ms()]) }
        push(force: true)
    }

    /// A tap on the Lock Screen (RunActivity.swift intents).
    private func panel(_ what: String) {
        switch what {
        case "pause": doPause(fromPanel: true)
        case "resume": doResume(fromPanel: true)
        case "stop":
            doPause(fromPanel: false)
            stopped = true
            queue(["kind": "stop", "t": RunTrackerPlugin.ms()])
            push(force: true)
            finish(keepPanelFor: 4)
        default: break
        }
    }

    private func finish(keepPanelFor seconds: Double = 0) {
        running = false
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        guard #available(iOS 16.2, *) else { return }
        Task {
            if seconds > 0 { try? await Task.sleep(nanoseconds: UInt64(seconds * 1e9)) }
            for a in Activity<RunActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
        }
    }

    // ---------------- the GPS ----------------
    public func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for l in locations {
            var e: [String: Any] = ["kind": "fix", "t": RunTrackerPlugin.ms(l.timestamp), "lat": l.coordinate.latitude, "lng": l.coordinate.longitude, "acc": l.horizontalAccuracy]
            if l.verticalAccuracy >= 0 { e["alt"] = l.altitude }
            queue(e)
            guard running, !paused, l.horizontalAccuracy >= 0, l.horizontalAccuracy <= 30 else { continue }
            if let p = last {
                let d = l.distance(from: p)
                let dt = max(0.5, l.timestamp.timeIntervalSince(p.timestamp))
                if d / dt > (type == "ride" ? 30 : 12) { continue }
                if d < 1.5 { continue }
                distM += d
            }
            last = l
            recent.append((Date(), distM))
            recent.removeAll { Date().timeIntervalSince($0.0) > 60 }
        }
        push(force: false)
    }

    private func movingNow() -> Double { movingSec + (runningSince.map { Date().timeIntervalSince($0) } ?? 0) }

    private func paceSec() -> Double {
        if let a = recent.first, let b = recent.last {
            let dd = b.1 - a.1, dt = b.0.timeIntervalSince(a.0)
            if dd > 20 && dt > 5 { return dt / dd * 1000 }
        }
        return distM > 50 ? movingNow() / distM * 1000 : 0
    }

    // ---------------- the Live Activity ----------------
    @available(iOS 16.1, *)
    private func content() -> RunActivityAttributes.ContentState {
        RunActivityAttributes.ContentState(distM: distM, paceSec: paceSec(),
                                           runningSince: runningSince.map { RunTrackerPlugin.ms($0) },
                                           movingSec: movingSec, paused: paused, stopped: stopped)
    }

    private func startActivity() {
        guard #available(iOS 16.2, *) else { return }
        Task {
            for a in Activity<RunActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            _ = try? Activity.request(attributes: RunActivityAttributes(title: title, type: type),
                                      content: ActivityContent(state: content(), staleDate: nil), pushType: nil)
        }
    }

    /// Updates the panel: at most every 5 seconds from the GPS, right away after a tap.
    private func push(force: Bool) {
        guard force || Date().timeIntervalSince(lastPush) >= 5 else { return }
        lastPush = Date()
        guard #available(iOS 16.2, *) else { return }
        let state = content()
        Task { for a in Activity<RunActivityAttributes>.activities { await a.update(ActivityContent(state: state, staleDate: nil)) } }
    }
}
