import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, logout } from './services/firebase'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '20px' }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {user ? (
        <>
          <header className="header">
            <h1>帳票データ化システム</h1>
            <nav className="header-nav">
              <Link to="/">ホーム</Link>
              <Link to="/settings">設定</Link>
              <span style={{ marginLeft: '10px' }}>{user.email}</span>
              <button className="btn btn-outline" onClick={handleLogout}>
                ログアウト
              </button>
            </nav>
          </header>
          <main className="container">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}

export default App
