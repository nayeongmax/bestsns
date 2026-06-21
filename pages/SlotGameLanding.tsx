import React, { useState, useCallback, useRef, useEffect } from 'react';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🔔', '⭐'];
const WINNING_COMBOS: Record<string, { multiplier: number; name: string }> = {
  '7️⃣7️⃣7️⃣': { multiplier: 100, name: 'MEGA JACKPOT' },
  '💎💎💎': { multiplier: 50, name: 'DIAMOND WIN' },
  '⭐⭐⭐': { multiplier: 30, name: 'STAR BONUS' },
  '🔔🔔🔔': { multiplier: 20, name: 'BELL RUSH' },
  '🍇🍇🍇': { multiplier: 15, name: 'GRAPE COMBO' },
  '🍊🍊🍊': { multiplier: 10, name: 'ORANGE BLAST' },
  '🍋🍋🍋': { multiplier: 8, name: 'LEMON DROP' },
  '🍒🍒🍒': { multiplier: 5, name: 'CHERRY TRIPLE' },
};

function getRandomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function SlotReel({ symbol, spinning, delay }: { symbol: string; spinning: boolean; delay: number }) {
  const [displaySymbol, setDisplaySymbol] = useState(symbol);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (spinning) {
      intervalRef.current = setInterval(() => {
        setDisplaySymbol(getRandomSymbol());
      }, 80);
      const timeout = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplaySymbol(symbol);
      }, 1000 + delay);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearTimeout(timeout);
      };
    } else {
      setDisplaySymbol(symbol);
    }
  }, [spinning, symbol, delay]);

  return (
    <div style={{
      width: 100, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 56, background: spinning ? 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(180deg, #0f0f23 0%, #1a1a3e 100%)',
      borderRadius: 16, border: '3px solid #ffd700',
      boxShadow: spinning ? '0 0 20px rgba(255,215,0,0.5), inset 0 0 20px rgba(0,0,0,0.5)' : '0 0 15px rgba(255,215,0,0.3), inset 0 0 15px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
      transform: spinning ? 'scale(1.05)' : 'scale(1)',
    }}>
      {displaySymbol}
    </div>
  );
}

const SlotGameLanding: React.FC = () => {
  const [reels, setReels] = useState(['🍒', '💎', '7️⃣']);
  const [spinning, setSpinning] = useState(false);
  const [credits, setCredits] = useState(1000);
  const [bet, setBet] = useState(10);
  const [message, setMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [biggestWin, setBiggestWin] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const [jackpotAnim, setJackpotAnim] = useState(false);

  const spin = useCallback(() => {
    if (spinning || credits < bet) return;
    setSpinning(true);
    setCredits(prev => prev - bet);
    setMessage('');
    setWinAmount(0);
    setTotalSpins(prev => prev + 1);

    const newReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    setReels(newReels);

    setTimeout(() => {
      setSpinning(false);
      const combo = newReels.join('');
      const win = WINNING_COMBOS[combo];
      if (win) {
        const amount = bet * win.multiplier;
        setCredits(prev => prev + amount);
        setWinAmount(amount);
        setMessage(`${win.name}! +${amount.toLocaleString()} 크레딧`);
        if (amount > biggestWin) setBiggestWin(amount);
        if (win.multiplier >= 50) setJackpotAnim(true);
      } else if (newReels[0] === newReels[1] || newReels[1] === newReels[2]) {
        const amount = bet * 2;
        setCredits(prev => prev + amount);
        setWinAmount(amount);
        setMessage(`2매치! +${amount.toLocaleString()} 크레딧`);
        if (amount > biggestWin) setBiggestWin(amount);
      }
    }, 1800);
  }, [spinning, credits, bet, biggestWin]);

  useEffect(() => {
    if (jackpotAnim) {
      const t = setTimeout(() => setJackpotAnim(false), 3000);
      return () => clearTimeout(t);
    }
  }, [jackpotAnim]);

  const refillCredits = () => {
    setCredits(1000);
    setMessage('크레딧이 충전되었습니다!');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 30%, #0a1a3e 60%, #0a0a2a 100%)', color: '#fff', fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 16px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 14, color: '#ffd700', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>Premium Online Casino</div>
        <h1 style={{
          fontSize: 42, fontWeight: 900, margin: '0 0 8px',
          background: 'linear-gradient(90deg, #ffd700, #ffaa00, #ffd700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textShadow: 'none', letterSpacing: -1,
        }}>
          MEGA SLOTS
        </h1>
        <p style={{ fontSize: 16, color: '#b0b0d0', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
          지금 바로 무료 1,000 크레딧으로 슬롯게임을 체험하세요
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '12px 16px', flexWrap: 'wrap' }}>
        {[
          { label: '크레딧', value: credits.toLocaleString(), color: '#ffd700' },
          { label: '총 스핀', value: totalSpins.toString(), color: '#88f' },
          { label: '최대 당첨', value: biggestWin.toLocaleString(), color: '#4f4' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Slot Machine */}
      <div style={{
        maxWidth: 440, margin: '0 auto', padding: '0 16px',
      }}>
        <div style={{
          background: 'linear-gradient(180deg, #1e1e3a 0%, #12122a 100%)',
          borderRadius: 24, padding: '32px 20px 24px',
          border: '2px solid rgba(255,215,0,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.1)',
          position: 'relative',
        }}>
          {jackpotAnim && (
            <div style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, #ff0, #f80, #ff0)', color: '#000',
              padding: '6px 24px', borderRadius: 20, fontWeight: 900, fontSize: 14,
              animation: 'pulse 0.5s ease infinite alternate',
              zIndex: 10, whiteSpace: 'nowrap',
            }}>
              JACKPOT!
            </div>
          )}

          {/* Reels */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            {reels.map((sym, i) => (
              <SlotReel key={i} symbol={sym} spinning={spinning} delay={i * 300} />
            ))}
          </div>

          {/* Win Message */}
          <div style={{
            height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            {message && (
              <div style={{
                fontSize: winAmount > 0 ? 18 : 14, fontWeight: 800,
                color: winAmount > 0 ? '#ffd700' : '#88f',
                textShadow: winAmount > 0 ? '0 0 20px rgba(255,215,0,0.5)' : 'none',
              }}>
                {message}
              </div>
            )}
          </div>

          {/* Bet Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#aaa' }}>BET</span>
            {[10, 25, 50, 100].map(b => (
              <button key={b} onClick={() => !spinning && setBet(b)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: bet === b ? 'linear-gradient(135deg, #ffd700, #ff8c00)' : 'rgba(255,255,255,0.1)',
                color: bet === b ? '#000' : '#aaa',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {b}
              </button>
            ))}
          </div>

          {/* Spin Button */}
          <button
            onClick={credits >= bet ? spin : refillCredits}
            disabled={spinning}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
              background: spinning
                ? 'linear-gradient(135deg, #333, #444)'
                : credits < bet
                  ? 'linear-gradient(135deg, #4488ff, #2266dd)'
                  : 'linear-gradient(135deg, #ffd700, #ff8c00, #ff6600)',
              color: spinning ? '#666' : credits < bet ? '#fff' : '#000',
              fontSize: 20, fontWeight: 900, cursor: spinning ? 'not-allowed' : 'pointer',
              letterSpacing: 2, textTransform: 'uppercase',
              boxShadow: spinning ? 'none' : '0 4px 20px rgba(255,215,0,0.4)',
              transition: 'all 0.3s',
            }}
          >
            {spinning ? 'SPINNING...' : credits < bet ? 'REFILL CREDITS' : 'SPIN'}
          </button>
        </div>
      </div>

      {/* Paytable */}
      <div style={{ maxWidth: 440, margin: '24px auto 0', padding: '0 16px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 16,
          padding: '20px', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ffd700', textAlign: 'center', letterSpacing: 2 }}>PAYTABLE</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {Object.entries(WINNING_COMBOS).map(([combo, info]) => (
              <div key={combo} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
              }}>
                <span style={{ fontSize: 20 }}>{combo}</span>
                <span style={{ fontSize: 13, color: '#aaa' }}>{info.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: info.multiplier >= 50 ? '#ffd700' : info.multiplier >= 20 ? '#88f' : '#8f8' }}>
                  x{info.multiplier}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            }}>
              <span style={{ fontSize: 14, color: '#aaa' }}>2개 매치</span>
              <span style={{ fontSize: 13, color: '#aaa' }}>ANY PAIR</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#8f8' }}>x2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 440, margin: '24px auto 0', padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: '🎰', title: '100+ 슬롯게임', desc: '다양한 테마의 프리미엄 슬롯' },
            { icon: '💰', title: '높은 RTP', desc: '업계 최고 수준 97.5% RTP' },
            { icon: '🎁', title: '무료 보너스', desc: '매일 무료 크레딧 지급' },
            { icon: '🔒', title: '안전한 플레이', desc: '공정성 인증 완료' },
          ].map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '20px 14px',
              textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ maxWidth: 440, margin: '32px auto 0', padding: '0 16px 48px', textAlign: 'center' }}>
        <button onClick={() => setShowSignup(true)} style={{
          width: '100%', padding: '18px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg, #ff3366, #ff6633)',
          color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255,51,102,0.4)',
          letterSpacing: 1,
        }}>
          무료 회원가입하고 보너스 받기
        </button>
        <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
          가입 즉시 5,000 보너스 크레딧 지급 | 만 19세 이상
        </p>
      </div>

      {/* Signup Modal */}
      {showSignup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }} onClick={() => setShowSignup(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'linear-gradient(180deg, #1e1e3a, #12122a)',
            borderRadius: 24, padding: 32, maxWidth: 380, width: '100%',
            border: '1px solid rgba(255,215,0,0.2)',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, textAlign: 'center',
              background: 'linear-gradient(90deg, #ffd700, #ff8c00)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>회원가입</h2>
            <p style={{ textAlign: 'center', color: '#888', fontSize: 13, margin: '0 0 24px' }}>
              가입하고 5,000 보너스 크레딧을 받으세요
            </p>
            {['이메일', '비밀번호', '닉네임'].map(label => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type={label === '비밀번호' ? 'password' : 'text'}
                  placeholder={`${label}을 입력하세요`}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <button style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #ffd700, #ff8c00)', color: '#000',
              fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8,
            }} onClick={() => { setShowSignup(false); setCredits(prev => prev + 5000); setMessage('5,000 보너스 크레딧이 지급되었습니다!'); }}>
              가입하기
            </button>
            <button style={{
              width: '100%', padding: '10px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', marginTop: 8,
            }} onClick={() => setShowSignup(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          from { transform: translateX(-50%) scale(1); }
          to { transform: translateX(-50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default SlotGameLanding;
