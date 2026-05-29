"use client";

export interface CallSettings {
  silenceDebounceMs: number;
  silenceWatcherMs: number;
  maxCheckins: number;
  pushToTalk: boolean;
}

interface Props {
  open: boolean;
  settings: CallSettings;
  onClose: () => void;
  onChange: (patch: Partial<CallSettings>) => void;
}

function Slider({ label, unit, min, max, step, value, onChange, hint }: {
  label: string; unit: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs text-teal-600 font-mono tabular-nums">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        className="w-full h-1.5 accent-teal-500 rounded-lg cursor-pointer"
        onChange={e => onChange(+e.target.value)} />
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );
}

export default function SettingsPanel({ open, settings, onClose, onChange }: Props) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-72 bg-white/95 backdrop-blur-xl border-l border-gray-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Call Settings</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <Slider label="Speech debounce" unit="ms" min={400} max={3000} step={100}
            value={settings.silenceDebounceMs}
            onChange={v => onChange({ silenceDebounceMs: v })}
            hint="Wait after user stops speaking before sending to agent" />

          <Slider label="Silence check-in" unit="s" min={3} max={20} step={1}
            value={settings.silenceWatcherMs / 1000}
            onChange={v => onChange({ silenceWatcherMs: v * 1000 })}
            hint="Seconds of silence before 'are you still there?'" />

          <Slider label="Max check-ins" unit="" min={1} max={3} step={1}
            value={settings.maxCheckins}
            onChange={v => onChange({ maxCheckins: v })}
            hint="How many check-ins before stopping" />

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium text-gray-700">Push to talk</p>
              <p className="text-[10px] text-gray-400">Hold Space to speak, release to send</p>
            </div>
            <button
              onClick={() => onChange({ pushToTalk: !settings.pushToTalk })}
              className={`relative w-10 h-6 rounded-full transition-colors ${settings.pushToTalk ? "bg-teal-500" : "bg-gray-200"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.pushToTalk ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">Settings apply immediately and persist across sessions.</p>
        </div>
      </div>
    </div>
  );
}
