export default function AtlasLoading() {
  return <main className="mx-auto w-full max-w-[90rem] motion-safe:animate-pulse px-5 py-16 sm:px-8 lg:px-12 lg:py-24" aria-busy="true">
    <p role="status" className="sr-only">Загрузка раздела</p>
    <div className="h-6 w-36 rounded-full bg-white/[0.07]" />
    <div className="mt-8 h-16 max-w-3xl rounded-2xl bg-white/[0.07]" />
    <div className="mt-5 h-7 max-w-xl rounded-xl bg-white/[0.045]" />
    <div className="mt-16 grid gap-5 md:grid-cols-3">
      {[0, 1, 2].map((item) => <div key={item} className="h-64 rounded-3xl border border-white/[0.06] bg-white/[0.035]" />)}
    </div>
  </main>;
}
