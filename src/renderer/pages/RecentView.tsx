type RecentViewProps = {
  onOpenAssembly: () => void;
  onOpenPart: () => void;
};

const recentItems = [
  { name: "Assembly-A12", type: "装配体", time: "今天 16:20" },
  { name: "Part-P01", type: "零件", time: "今天 15:48" },
  { name: "Robot-Gripper", type: "零件", time: "昨天 19:12" }
];

export function RecentView({ onOpenAssembly, onOpenPart }: RecentViewProps) {
  return (
    <section className="p-7">
      <span className="block text-xs font-bold uppercase text-emerald-300">Recent Documents</span>
      <h2 className="m-0 mt-2 text-[26px] font-bold tracking-normal">最近文档</h2>
      <div className="mt-6 grid gap-3">
        {recentItems.map((item) => (
          <button
            className="border border-slate-700 bg-slate-900 px-5 py-4 text-left hover:border-slate-500"
            key={item.name}
            onClick={item.type === "装配体" ? onOpenAssembly : onOpenPart}
            type="button"
          >
            <strong className="block">{item.name}</strong>
            <span className="mt-1 block text-sm text-slate-400">
              {item.type} / {item.time}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
