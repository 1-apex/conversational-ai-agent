"use client";

import { CallBriefData } from "@/lib/types";

interface Props {
  brief: CallBriefData;
  onNewCall: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallBrief({ brief, onNewCall }: Props) {
  const { summary, entities, actionItems, duration } = brief;

  const entitySections: { label: string; items: string[]; color: string }[] = [
    { label: "People",    items: entities.names,     color: "text-blue-600" },
    { label: "Companies", items: entities.companies, color: "text-purple-600" },
    { label: "Products",  items: entities.products,  color: "text-orange-600" },
    { label: "Contacts",  items: entities.contacts,  color: "text-gray-600" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Call Brief</h2>
          <p className="text-xs text-gray-400 mt-0.5">Duration: {formatDuration(duration)}</p>
        </div>
        <button
          onClick={onNewCall}
          className="text-xs px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-600 transition-all"
        >
          New Call
        </button>
      </div>

      {/* Summary */}
      <section className="glass-panel rounded-xl p-4 space-y-1.5">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-medium">Summary</p>
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      </section>

      {/* Entities */}
      {entitySections.length > 0 && (
        <section className="glass-panel rounded-xl p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-medium">Key Entities</p>
          {entitySections.map(({ label, items, color }) => (
            <div key={label} className="space-y-1">
              <p className={`text-xs font-semibold ${color}`}>{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span key={item} className="text-xs bg-white/70 border border-white/40 rounded-full px-2.5 py-0.5 text-gray-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <section className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-medium">Action Items</p>
          <ul className="space-y-2">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="shrink-0 w-4 h-4 rounded border-2 border-teal-400 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
