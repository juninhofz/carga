import AVFoundation
import Foundation

/**
 * CARGA: the voice with the iPhone locked. iOS stops the page the moment the app leaves the screen,
 * and an app in the background cannot speak; a notification can play a sound, though. So the line
 * ("Acabou o descanso. Próxima série: agachamento, 8 repetições com 100 quilos.") is spoken into
 * a sound file in Library/Sounds while the app is awake, and the rest's notification plays it
 * (RestAlertPlugin.post): in the earphones, Bluetooth included, with the phone in the pocket.
 * A guided hold's alerts get their own titles the same way ("Prepare-se: …", "Já! …").
 */
enum CargaVoice {
    static var on = false
    static var rate: Float = 1
    /// The rest end's line and the file it was spoken into (two names in turn: iOS may keep a
    /// sound it already played under the same name).
    private(set) static var restFile: String?
    private static var flip = false
    /// What each cue title was spoken into, by its text.
    private(set) static var cueFiles: [String: String] = [:]
    /// The line a rest started from the Lock Screen says (the next set is not known there).
    static let generalName = "carga-voz-geral.caf"
    private static var busy: [AVSpeechSynthesizer] = []

    static var soundsDir: URL? {
        guard let lib = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else { return nil }
        let dir = lib.appendingPathComponent("Sounds", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// The page's call: on or off, and the rest end's line.
    static func set(on: Bool, line: String, rate: Float) {
        self.on = on
        self.rate = rate
        guard on else {
            // switched off: the Lock Screen's rests go back to the plain sound
            if let dir = soundsDir { try? FileManager.default.removeItem(at: dir.appendingPathComponent(generalName)) }
            restFile = nil
            return
        }
        if let dir = soundsDir, !FileManager.default.fileExists(atPath: dir.appendingPathComponent(generalName).path) {
            render("Acabou o descanso. Próxima série!", name: generalName) { _ in }
        }
        guard !line.isEmpty else { restFile = nil; return }
        flip.toggle()
        let name = flip ? "carga-voz-a.caf" : "carga-voz-b.caf"
        render(line, name: name) { ok in if ok { restFile = name } }
    }

    /// Speaks each cue title into a file of its own (a guided hold's steps), once per text.
    static func prepare(cues titles: [String]) {
        guard on else { return }
        for (i, t) in titles.prefix(16).enumerated() where cueFiles[t] == nil && !t.isEmpty {
            let name = "carga-voz-cue-\(i)-\(abs(t.hashValue) % 100000).caf"
            render(t, name: name) { ok in if ok { cueFiles[t] = name } }
        }
    }

    /// `text` in Brazilian Portuguese into Library/Sounds/`name` (16-bit PCM, what a notification plays).
    static func render(_ text: String, name: String, done: @escaping (Bool) -> Void) {
        guard let dir = soundsDir else { done(false); return }
        let url = dir.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: url)
        let synth = AVSpeechSynthesizer()
        busy.append(synth)
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "pt-BR")
        u.rate = AVSpeechUtteranceDefaultSpeechRate * max(0.6, min(1.6, rate))
        u.preUtteranceDelay = 0.15
        var file: AVAudioFile?
        var wrote = false
        synth.write(u) { buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            if pcm.frameLength == 0 {
                // the end of the utterance
                file = nil
                busy.removeAll { $0 === synth }
                done(wrote)
                return
            }
            if file == nil {
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatLinearPCM,
                    AVSampleRateKey: pcm.format.sampleRate,
                    AVNumberOfChannelsKey: pcm.format.channelCount,
                    AVLinearPCMBitDepthKey: 16,
                    AVLinearPCMIsFloatKey: false,
                    AVLinearPCMIsBigEndianKey: false,
                ]
                file = try? AVAudioFile(forWriting: url, settings: settings, commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved)
            }
            do { try file?.write(from: pcm); wrote = true } catch { }
        }
    }

    /// The sound for a notification, or nil to keep the usual one.
    static func sound(for title: String, rest: Bool) -> String? {
        guard on, let dir = soundsDir else { return nil }
        let name = rest ? (restFile ?? generalName) : cueFiles[title]
        guard let n = name, FileManager.default.fileExists(atPath: dir.appendingPathComponent(n).path) else { return nil }
        return n
    }
}
