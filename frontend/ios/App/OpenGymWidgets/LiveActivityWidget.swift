import ActivityKit
import SwiftUI
import WidgetKit

/*
 * The running workout on the Lock Screen and in the Dynamic Island (and, through the compact
 * views, in an Apple Watch's Smart Stack). The app starts and updates it (LiveActivityPlugin.swift);
 * its buttons are WorkoutActivity.swift's DoneSetIntent, NextExerciseIntent and SkipRestIntent.
 * The views are App/WidgetViews.swift's.
 */
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LiveLockView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(CargaColor.panel)
                .activitySystemActionForegroundColor(CargaColor.orange)
        } dynamicIsland: { context in
            let accent = Color(hex: context.attributes.accent) ?? .green
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.cur?.exName ?? context.attributes.noSetText(context.state))
                            .font(.headline).lineLimit(1).minimumScaleFactor(0.75)
                        if let c = context.state.cur {
                            Text(c.setLine).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.holding || context.state.restRange != nil || context.state.restLeft != nil {
                        LiveRest(attributes: context.attributes, state: context.state, font: .title3)
                            .frame(maxWidth: 80, alignment: .trailing)
                            .padding(.trailing, 4)
                    } else if let c = context.state.cur {
                        Text(c.target).font(.subheadline.weight(.semibold)).lineLimit(1).padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 10) {
                        ProgressBar(value: Double(context.state.done) / Double(max(1, context.state.total)), accent: accent)
                        Text("\(context.state.done)/\(context.state.total)").font(.caption.weight(.semibold)).monospacedDigit()
                        LiveSecondaryButton(attributes: context.attributes, state: context.state)
                        if let c = context.state.cur { LiveDoneButton(attributes: context.attributes, cur: c) }
                    }
                }
            } compactLeading: {
                CargaMark(size: 18)
            } compactTrailing: {
                LiveCompactTrailing(attributes: context.attributes, state: context.state)
            } minimal: {
                LiveMinimal(attributes: context.attributes, state: context.state)
            }
            .keylineTint(accent)
        }
    }
}

/*
 * CARGA: the run on the Lock Screen and in the Dynamic Island (RunActivity.swift): black, the mark in
 * the middle, pace · distance · time, Pausar / Retomar and Parar. The approved "Preto com laranja".
 */
@available(iOS 17.0, *)
struct RunLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunActivityAttributes.self) { context in
            RunLockView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(CargaColor.panel)
                .activitySystemActionForegroundColor(CargaColor.orange)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    RunStat(label: "PACE", value: runPace(context.state, context.attributes), unit: context.attributes.type == "ride" ? "km/h" : "/km")
                }
                DynamicIslandExpandedRegion(.center) {
                    RunStat(label: "DISTÂNCIA", value: runKm(context.state.distM), unit: "km")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(spacing: 1) {
                        Text("TEMPO").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
                        RunClock(state: context.state).font(.title3.weight(.heavy)).foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) { RunButtons(state: context.state) }
            } compactLeading: {
                CargaMark(size: 18)
            } compactTrailing: {
                Text(runKm(context.state.distM) + " km").font(.caption.weight(.bold)).foregroundStyle(CargaColor.orange).monospacedDigit()
            } minimal: {
                CargaMark(size: 16)
            }
            .keylineTint(CargaColor.orange)
        }
    }
}

func runKm(_ m: Double) -> String { String(format: "%.2f", m / 1000).replacingOccurrences(of: ".", with: ",") }
func runPace(_ s: RunActivityAttributes.ContentState, _ a: RunActivityAttributes) -> String {
    if a.type == "ride" {
        let h = s.movingSec / 3600
        return h > 0 && s.distM > 0 ? String(format: "%.1f", s.distM / 1000 / h).replacingOccurrences(of: ".", with: ",") : "0,0"
    }
    guard s.paceSec > 0, s.paceSec < 3600 else { return "--:--" }
    return String(format: "%d:%02d", Int(s.paceSec) / 60, Int(s.paceSec) % 60)
}

@available(iOS 16.2, *)
struct RunClock: View {
    let state: RunActivityAttributes.ContentState
    var body: some View {
        if let start = state.clockStart {
            Text(timerInterval: start...Date.distantFuture, countsDown: false, showsHours: true).monospacedDigit()
        } else {
            let t = Int(state.movingSec)
            Text(t >= 3600 ? String(format: "%d:%02d:%02d", t / 3600, t / 60 % 60, t % 60) : String(format: "%d:%02d", t / 60, t % 60)).monospacedDigit()
        }
    }
}

struct RunStat: View {
    let label: String
    let value: String
    let unit: String
    var body: some View {
        VStack(spacing: 1) {
            Text(label).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value).font(.title2.weight(.heavy)).foregroundStyle(.white).monospacedDigit()
                Text(unit).font(.caption2).foregroundStyle(.white.opacity(0.7))
            }
        }
    }
}

@available(iOS 17.0, *)
struct RunButtons: View {
    let state: RunActivityAttributes.ContentState
    var body: some View {
        HStack(spacing: 8) {
            if !state.stopped {
                if state.paused {
                    Button(intent: ResumeRunIntent()) { Label("Retomar", systemImage: "play.fill").frame(maxWidth: .infinity) }
                        .tint(CargaColor.orange)
                } else {
                    Button(intent: PauseRunIntent()) { Label("Pausar", systemImage: "pause.fill").frame(maxWidth: .infinity) }
                        .tint(CargaColor.orange)
                }
                Button(intent: StopRunIntent()) { Label("Parar", systemImage: "stop.fill").frame(maxWidth: .infinity) }
                    .tint(Color(white: 0.22))
            } else {
                Text("Corrida encerrada · abra o CARGA").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.8))
            }
        }
        .buttonStyle(.borderedProminent)
        .font(.subheadline.weight(.bold))
    }
}

@available(iOS 17.0, *)
struct RunLockView: View {
    let attributes: RunActivityAttributes
    let state: RunActivityAttributes.ContentState
    var body: some View {
        VStack(spacing: 10) {
            CargaHeader(left: attributes.title.uppercased(), right: state.stopped ? "ENCERRADA" : state.paused ? "PAUSADA" : "● AO VIVO")
            HStack {
                RunStat(label: attributes.type == "ride" ? "VELOCIDADE" : "PACE", value: runPace(state, attributes), unit: attributes.type == "ride" ? "km/h" : "/km")
                    .frame(maxWidth: .infinity)
                RunStat(label: "DISTÂNCIA", value: runKm(state.distM), unit: "km").frame(maxWidth: .infinity)
                VStack(spacing: 1) {
                    Text("TEMPO").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
                    RunClock(state: state).font(.title2.weight(.heavy)).foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity)
            }
            RunButtons(state: state)
        }
        .padding(14)
    }
}
