import { useState, useMemo, useEffect } from 'react'
import { calculateBaccaratEV, DeckCounts, Payouts } from './logic'

const CARD_LABELS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const INITIAL_DECK_COUNT = 32 // 8 decks

type BetType = 'banker' | 'player' | 'tie' | 'bankerPair' | 'playerPair' | 'super6'

export default function App() {
  // 設定
  const [showSettings, setShowSettings] = useState(false)
  const [capital, setCapital] = useState(10000000) // 1000萬
  const [commission, setCommission] = useState(2.0) // 退水 2.0%

  // 牌組狀態
  const [counts, setCounts] = useState<DeckCounts>(() => {
    const initial: DeckCounts = {}
    for (let i = 1; i <= 13; i++) {
      initial[i] = INITIAL_DECK_COUNT
    }
    return initial
  })

  // 輸入歷史
  const [history, setHistory] = useState<string[]>([])

  // 計算結果
  const results = useMemo(() => {
    const payouts: Payouts = {
      banker: 0.95,
      player: 1.0,
      tie: 8.0,
      playerPair: 11.0,
      bankerPair: 11.0,
      super6: 12.0
    }
    return calculateBaccaratEV(counts, payouts, commission)
  }, [counts, commission])

  // 計算推薦投注 (使用凱莉定理)
  const recommendations = useMemo(() => {
    const kellyFraction = 0.25 // 凱莉分數，通常用1/4凱莉來降低波動
    const bets = [results.banker, results.player, results.tie, results.bankerPair, results.playerPair, results.super6]
    
    return bets.map(bet => {
      const winProb = bet.probability
      const lossProb = 1 - winProb
      
      // 凱莉公式: Kelly % = (bp - q) / b
      // b = 淨赔率 (payout - 1)
      // p = 獲勝機率
      // q = 失敗機率 (1-p)
      
      let kellyPercent = 0
      if (winProb > 0) {
        const payout = bet.payout
        const b = payout - 1 // 淨赔率
        kellyPercent = (b * winProb - lossProb) / b
      }
      
      const amount = kellyPercent > 0 ? Math.floor(kellyPercent * kellyFraction * capital) : 0
      
      return {
        type: bet.label,
        label: bet.label,
        probability: winProb,
        ev: bet.ev,
        amount: amount,
        shouldBet: kellyPercent > 0 && winProb > 0.01
      }
    }).sort((a, b) => b.amount - a.amount)
  }, [results, capital])

  // 處理數字輸入
  const handleNumber = (value: number) => {
    // 計算不包含分隔線的歷史來決定莊閒
    const realHistory = history.filter(h => h !== '|')
    const side = realHistory.length % 2 === 0 ? '莊' : '閒'
    setHistory(prev => [...prev, `${side}${CARD_LABELS[value - 1]}`])
    setCounts(prev => ({
      ...prev,
      [value]: Math.max(0, prev[value] - 1)
    }))
  }

  // 分隔線
  const handleSeparator = () => {
    setHistory(prev => ['|', ...prev].slice(0, 100))
  }

  // 清除
  const handleClear = () => {
    if (confirm('確定要清除所有資料嗎？')) {
      setHistory([])
      setCounts(() => {
        const initial: DeckCounts = {}
        for (let i = 1; i <= 13; i++) {
          initial[i] = INITIAL_DECK_COUNT
        }
        return initial
      })
    }
  }

  // 倒退
  const handleBack = () => {
    if (history.length === 0) return
    const last = history[history.length - 1]
    if (last === '|') {
      // 分隔線
      setHistory(prev => prev.slice(0, -1))
      return
    }
    const label = last.replace('莊', '').replace('閒', '')
    const value = CARD_LABELS.indexOf(label) + 1
    setCounts(prev => ({
      ...prev,
      [value]: Math.min(INITIAL_DECK_COUNT, prev[value] + 1)
    }))
    setHistory(prev => prev.slice(0, -1))
  }

  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 數字鍵 1-9
      const numMap: Record<string, number> = {
        '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
        '6': 6, '7': 7, '8': 8, '9': 9
      }
      
      if (numMap.hasOwnProperty(e.key)) {
        e.preventDefault()
        handleNumber(numMap[e.key])
      }
      
      // 0 鍵：移除 10
      if (e.key === '0') {
        e.preventDefault()
        handleNumber(10)
      }
      
      // A 鍵：移除 Ace (1)
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleNumber(1)
      }
      
      // T 鍵：移除 10
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        handleNumber(10)
      }
      
      // J, Q, K 鍵
      const faceMap: Record<string, number> = {
        'j': 11, 'J': 11,
        'q': 12, 'Q': 12,
        'k': 13, 'K': 13
      }
      if (faceMap.hasOwnProperty(e.key)) {
        e.preventDefault()
        handleNumber(faceMap[e.key])
      }
      
      // 空格鍵：分隔線
      if (e.key === ' ') {
        e.preventDefault()
        setHistory(prev => ['|', ...prev].slice(0, 100))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [history, counts])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      padding: 'env(safe-area-inset-top) 12px env(safe-area-inset-bottom)'
    }}>
      {/* 頂部 */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(10px)',
        margin: '-12px -12px 12px',
        padding: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100
      }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: '#333',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 16px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          ⚙️
        </button>

        {/* 剩餘牌數 + 分隔線按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            background: '#333', 
            borderRadius: '8px', 
            padding: '8px 12px',
            color: '#22c55e',
            fontSize: '14px',
            fontWeight: 600
          }}>
            剩餘 {Object.values(counts).reduce((a, b) => a + b, 0)}
          </span>
          <button
            onClick={handleSeparator}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 16px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            |
          </button>
        </div>
      </div>

      {/* 設定選單 */}
      {showSettings && (
        <div style={{
          background: '#1a1a1a',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px'
        }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '6px' }}>本金 (萬)</label>
            <input
              type="text"
              inputMode="numeric"
              value={capital / 10000}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d+$/.test(val)) {
                  setCapital(val === '' ? 0 : parseInt(val) * 10000)
                }
              }}
              style={{
                width: '100%',
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '16px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '6px' }}>退水 (%)</label>
            <input
              type="text"
              inputMode="decimal"
              value={commission}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setCommission(val === '' ? 0 : parseFloat(val))
                }
              }}
              style={{
                width: '100%',
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '16px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '6px' }}>操作</label>
            <button
              onClick={handleClear}
              style={{
                width: '100%',
                background: '#ef4444',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              清除資料
            </button>
          </div>
        </div>
      )}

      {/* 推薦投注 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '12px'
      }}>
        {recommendations.map(bet => (
          <button
            key={bet.type}
            disabled={!bet.shouldBet}
            onClick={() => {}}
            style={{
              background: bet.shouldBet ? (bet.ev > 0.02 ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)') : 'rgba(100,100,100,0.2)',
              border: `2px solid ${bet.shouldBet ? (bet.ev > 0.02 ? '#22c55e' : '#fbbf24') : '#444'}`,
              borderRadius: '12px',
              padding: '12px 8px',
              color: '#fff',
              cursor: bet.shouldBet ? 'pointer' : 'not-allowed',
              opacity: bet.shouldBet ? 1 : 0.5
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{bet.label}</div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
              {bet.probability < 0.01 ? '-' : `${(bet.probability * 100).toFixed(1)}%`}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: bet.ev > 0 ? '#22c55e' : bet.ev < 0 ? '#ef4444' : '#888',
              marginTop: '4px'
            }}>
              {bet.ev > 0 ? '+' : ''}{(bet.ev * 100).toFixed(2)}%
            </div>
            {bet.shouldBet && (
              <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>
                ${(bet.amount / 10000).toFixed(0)}萬
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 已出牌 */}
      <div style={{
        background: '#1a1a1a',
        borderRadius: '16px',
        padding: '12px',
        marginBottom: '12px',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap'
      }}>
        {history.map((card, i) => {
          if (card === '|') {
            return (
              <div key={i} style={{
                background: '#fbbf24',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#000'
              }}>
                |
              </div>
            )
          }
          const label = card.replace('莊', '').replace('閒', '')
          return (
            <div key={i} style={{
              background: '#555',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '14px',
              fontWeight: 700
            }}>
              {label}
            </div>
          )
        })}
        {history.length === 0 && <span style={{ color: '#555', fontSize: '12px' }}>無</span>}
      </div>

      {/* 牌庫顯示 */}
      <div style={{
        background: '#1a1a1a',
        borderRadius: '16px',
        padding: '12px',
        marginBottom: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(13, 1fr)',
        gap: '4px'
      }}>
        {Object.entries(counts).map(([rank, count]) => (
          <div key={rank} style={{
            background: '#333',
            borderRadius: '6px',
            padding: '6px 2px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '10px', color: '#888' }}>{CARD_LABELS[parseInt(rank) - 1]}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: count < 8 ? '#ef4444' : '#22c55e' }}>
              {count}
            </div>
          </div>
        ))}
      </div>

      {/* 按鍵區 */}
      <div style={{
        background: '#0a0a0a',
        borderRadius: '24px 24px 0 0',
        padding: '16px'
      }}>
        {/* 輸入顯示 */}
        <div style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '12px',
          fontSize: '18px',
          fontFamily: 'monospace',
          color: '#fff',
          textAlign: 'right',
          minHeight: '44px'
        }}>
          {history.filter(h => h !== '|').slice(-8).join(' ') || '0'}
        </div>

        {/* 按鍵 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px'
        }}>
          {/* 7, 8, 9 */}
          {[7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              style={{
                background: '#333',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                fontSize: '20px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {CARD_LABELS[num - 1]}
            </button>
          ))}
          <button
            onClick={() => handleNumber(11)}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            J
          </button>

          {/* 4, 5, 6 */}
          {[4, 5, 6].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              style={{
                background: '#333',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                fontSize: '20px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {CARD_LABELS[num - 1]}
            </button>
          ))}
          <button
            onClick={() => handleNumber(12)}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Q
          </button>

          {/* 1, 2, 3 */}
          {[1, 2, 3].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              style={{
                background: '#333',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                fontSize: '20px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {CARD_LABELS[num - 1]}
            </button>
          ))}
          <button
            onClick={() => handleNumber(13)}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            K
          </button>

          {/* 10 */}
          <button
            onClick={() => handleNumber(10)}
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              gridColumn: 'span 2'
            }}
          >
            10
          </button>

          {/* 倒退 */}
          <button
            onClick={handleBack}
            style={{
              background: '#f59e0b',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '16px',
              fontWeight: 600,
              color: '#000',
              cursor: 'pointer'
            }}
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
