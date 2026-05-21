import type { CadDocumentKind } from "../types";

type WelcomePageProps = {
  onCreate: (kind: CadDocumentKind) => void;
};

const recentProjects = [
  { name: "Assembly-A12", meta: "装配体 / 4 parts / WebGL" },
  { name: "Robot-Gripper", meta: "零件 / parametric sketch" },
  { name: "Cloud-CAD-Bench", meta: "装配体 / LOD preview" }
];

export function WelcomePage({ onCreate }: WelcomePageProps) {
  return (
    <section className="bg-[#101418] p-7 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-104px)] w-full max-w-7xl grid-cols-[minmax(0,1fr)_420px] gap-10 max-[980px]:grid-cols-1">
        <div className="flex flex-col justify-between">
          <header className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center border border-emerald-400/60 bg-emerald-950/40 text-2xl font-black text-emerald-300">
              D
            </div>
            <div>
              <h1 className="m-0 text-xl font-bold tracking-normal">CAD Workbench</h1>
              <p className="m-0 mt-1 text-sm text-slate-400">Electron / React / Three.js 工业设计工作台</p>
            </div>
          </header>

          <section className="py-16">
            <span className="block text-xs font-bold uppercase text-emerald-300">Start Design</span>
            <h2 className="m-0 mt-4 max-w-3xl text-5xl font-black leading-tight tracking-normal text-slate-50">
              新建设计文档，开始零件建模或装配验证
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
              这个 Demo 参考 CAD 的基础工作流：先创建零件，再在装配体中放置、组合和检查零件关系。
            </p>

            <div className="mt-9 grid max-w-3xl grid-cols-2 gap-4 max-[720px]:grid-cols-1">
              <button
                className="group border border-emerald-400/50 bg-emerald-400 p-5 text-left text-emerald-950 transition hover:bg-emerald-300"
                onClick={() => onCreate("assembly")}
                type="button"
              >
                <span className="block text-sm font-bold uppercase">New Assembly</span>
                <strong className="mt-3 block text-2xl">新建装配</strong>
                <span className="mt-3 block text-sm leading-6">
                  创建装配体，添加多个零件并查看空间关系、尺寸层级和实时渲染状态。
                </span>
              </button>

              <button
                className="group border border-slate-700 bg-slate-900 p-5 text-left text-slate-100 transition hover:border-blue-400/70 hover:bg-slate-800"
                onClick={() => onCreate("part")}
                type="button"
              >
                <span className="block text-sm font-bold uppercase text-blue-300">New Part</span>
                <strong className="mt-3 block text-2xl">新建零件</strong>
                <span className="mt-3 block text-sm leading-6 text-slate-400">
                  创建单个零件，预览基础实体、边线、坐标轴和后续参数化建模入口。
                </span>
              </button>
            </div>
          </section>

          <footer className="grid grid-cols-3 gap-3 text-sm text-slate-400 max-[720px]:grid-cols-1">
            {["Three.js WebGL", "Electron IPC", "CAD Assembly Flow"].map((item) => (
              <div className="border border-slate-800 bg-slate-900/60 px-4 py-3" key={item}>
                {item}
              </div>
            ))}
          </footer>
        </div>

        <aside className="self-center border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-bold uppercase text-emerald-300">Recent</span>
            <span className="text-xs text-slate-500">Local workspace</span>
          </div>
          <div className="mt-5 grid gap-3">
            {recentProjects.map((project) => (
              <button
                className="border border-slate-800 bg-[#141a1f] px-4 py-4 text-left transition hover:border-slate-600"
                key={project.name}
                onClick={() => onCreate(project.meta.includes("装配体") ? "assembly" : "part")}
                type="button"
              >
                <strong className="block">{project.name}</strong>
                <span className="mt-1 block text-sm text-slate-400">{project.meta}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
