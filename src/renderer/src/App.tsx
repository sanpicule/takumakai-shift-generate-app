import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import HomePage from './pages/HomePage'
import StaffPage from './pages/StaffPage'
import RequestPage from './pages/RequestPage'
import ResultPage from './pages/ResultPage'

const NAV_ITEMS = [
  { path: '/', label: 'シフト生成', icon: '📅' },
  { path: '/staff', label: 'スタッフ管理', icon: '👥' },
  { path: '/requests', label: '希望休入力', icon: '📆' },
  { path: '/result', label: 'シフト結果', icon: '📊' }
]

function Sidebar() {
  const location = useLocation()
  const { selectedYear, selectedMonth, shiftResult } = useAppStore()

  return (
    <aside className="w-56 bg-slate-900 flex flex-col h-full flex-shrink-0">
      {/* ヘッダー */}
      <div className="mt-12 px-5 py-5 titlebar-drag">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🏥</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">看護シフト生成</p>
            <p className="text-slate-400 text-xs">卓麻会</p>
          </div>
        </div>
      </div>

      {/* 対象月表示 */}
      <div className="mx-3 mb-3 bg-slate-800 rounded-lg px-3 py-2">
        <p className="text-slate-400 text-xs mb-0.5">対象月</p>
        <p className="text-white font-bold text-base">
          {selectedYear}年{selectedMonth}月
        </p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
          const isResult = item.path === '/result'
          const hasResult = !!shiftResult

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : isResult && !hasResult
                  ? 'text-slate-600 cursor-not-allowed pointer-events-none'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {isResult && hasResult && (
                <span className="ml-auto w-2 h-2 bg-green-400 rounded-full" />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* フッター */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-slate-600 text-xs text-center">v1.0.0</p>
      </div>
    </aside>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  )
}

export default function App() {
  const { loadFromStore } = useAppStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadFromStore().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-4xl mb-3">🏥</p>
          <p className="text-white text-lg font-medium">看護シフト生成</p>
          <p className="text-slate-400 text-sm mt-1">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/requests" element={<RequestPage />} />
          <Route path="/result" element={<ResultPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
