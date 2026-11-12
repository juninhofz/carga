import ActivityKit
import AppIntents
import Foundation

/*
 * CARGA: the run, walk or ride on the iPhone's Lock Screen and in the Dynamic Island (and in an
 * Apple Watch's Smart Stack): pace, distance and time, with Pausar / Retomar and Parar. Compiled
 * into the app and the widget extension (ios/ci/add-widgets.rb): the extension draws it
 * (OpenGymWidgets/LiveActivityWidget.swift RunLiveActivity), the app starts and updates it from
 * its own GPS (RunTrackerPlugin.swift) and runs the buttons' intents.
 */
@available(iOS 16.1, *)
struct RunActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Metres so far.
        var distM: Double
        /// Seconds per km now (the last minute), 0 when there is too little to say.
        var paceSec: Double
        /// The clock: running since this moment (ms since 1970) after `movingSec` already done; nil while paused.
        var runningSince: Double?
        var movingSec: Double
        var paused: Bool
        var stopped: Bool

        /// The moving time as Text(timerInterval:) counts it up while running.
        var clockStart: Date? {
            guard let since = runningSince, !paused else { return nil }
            return Date(timeIntervalSince1970: since / 1000).addingTimeInterval(-movingSec)
        }
    }
    var title: String     // "Corrida", "Caminhada", "Pedal"
    var type: String      // run | walk | ride
}

/// What a tap on the panel does, set by the app (RunTrackerPlugin) at launch. The intents run in
/// the app's process; in the extension this stays nil and is never reached.
enum RunControl {
    static var handler: ((String) -> Void)?
}

@available(iOS 17.0, *)
struct PauseRunIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Pausar"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        await MainActor.run { RunControl.handler?("pause") }
        return .result()
    }
}

@available(iOS 17.0, *)
struct ResumeRunIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Retomar"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        await MainActor.run { RunControl.handler?("resume") }
        return .result()
    }
}

@available(iOS 17.0, *)
struct StopRunIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Parar"
    static let isDiscoverable = false
    init() {}
    func perform() async throws -> some IntentResult {
        await MainActor.run { RunControl.handler?("stop") }
        return .result()
    }
}
