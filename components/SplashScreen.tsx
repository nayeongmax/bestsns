
import React, { useEffect, useState, useMemo } from 'react';

const LOGO_ASSETS = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png',
  'https://img.icons8.com/ios-filled/512/tiktok.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/600px-Facebook_Logo_%282019%29.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/512px-X_icon_2.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/600px-LinkedIn_logo_initials.png',
  'https://upload.wikimedia.org/wikipedia/commons/2/23/Naver_Logotype.svg'
];

interface Props {
  onComplete: () => void;
}

const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(10);

  // 로고 폭발 위치 미리 계산 (중앙 50% 에서 사방으로 흩어짐)
  const burstLogos = useMemo(() => {
    return LOGO_ASSETS.map((src, i) => {
      // 랜덤 각도 및 거리 계산
      const angle = (i / LOGO_ASSETS.length) * 360 + Math.random() * 20;
      const radius = 35 + Math.random() * 15; // 화면 중앙 50% 기준에서 흩어지는 거리
      const left = 50 + radius * Math.cos((angle * Math.PI) / 180);
      const top = 50 + radius * Math.sin((angle * Math.PI) / 180);
      const rotate = Math.random() * 40 - 20;
      const size = 80 + Math.random() * 80; // 사이즈도 랜덤하게
      const delay = 0.1 + (i * 0.1); // 순차적으로 팡팡 터짐

      return {
        id: i,
        src,
        left: `${left}%`,
        top: `${top}%`,
        rotate: `${rotate}deg`,
        size: `${size}px`,
        delay: `${delay}s`
      };
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] splash-container flex flex-col items-center justify-center select-none overflow-hidden bg-black">
      {/* 배경 조명 효과 */}
      <div className="absolute top-0 left-0 w-full h-full opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-blue-800/20 blur-[180px] rounded-full animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-900/20 blur-[140px] rounded-full animate-pulse" style={{ animationDelay: '-2s' }}></div>
      </div>

      {/* Burst Logos - 폭죽처럼 퍼지는 로고들 */}
      {burstLogos.map((logo) => (
        <div
          key={logo.id}
          className="animate-logo-burst pointer-events-none"
          style={{
            '--left-end': logo.left,
            '--top-end': logo.top,
            '--rotate-end': logo.rotate,
            width: logo.size,
            height: logo.size,
            animationDelay: logo.delay,
            zIndex: 10
          } as React.CSSProperties}
        >
          <img 
            src={logo.src} 
            className="w-full h-full object-contain filter brightness-110 drop-shadow-[0_20px_30px_rgba(0,0,0,1)]" 
            alt="logo" 
          />
        </div>
      )}

      {/* 중앙 타이틀 */}
      <div className="relative z-20 text-center space-y-8" style={{ transformStyle: 'preserve-3d' }}>
        <div className="inline-block px-12 py-3 bg-white/5 border border-white/10 rounded-full backdrop-blur-3xl mb-4 animate-pulse shadow-2xl">
           <span className="text-blue-400 text-[14px] font-black tracking-[1.4em] uppercase italic">System Explosion Initialized</span>
        </div>
        
        <h1 className="text-[80px] md:text-[220px] leading-none animate-punch-3d neon-text-3d">
          THEBEST<span className="text-glow-blue">SNS</span>
        </h1>
        
        <div className="pt-12 opacity-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-1000 flex flex-col items-center">
            <p className="text-blue-200/40 font-black tracking-[1em] uppercase italic text-lg md:text-2xl">
              Legacy Of Social Growth
            </p>
            <div className="h-1 w-64 bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-8 shadow-[0_0_30px_rgba(59,130,246,1)]"></div>
        </div>
      </div>

      {/* 컨트롤 인터페이스 */}
      <div className="absolute bottom-16 left-16 right-16 flex justify-between items-end z-30">
        <div className="space-y-5">
           <div className="flex items-center gap-6">
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-full animate-ping"></div>
              <span className="text-white/20 font-black text-[16px] italic uppercase tracking-[0.6em]">Core Synchronizing...</span>
           </div>
           <div className="w-[450px] h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-blue-900 via-blue-400 to-blue-900 transition-all duration-1000 ease-linear shadow-[0_0_25px_rgba(59,130,246,1)]" 
                style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
              ></div>
           </div>
        </div>
        
        <button 
          onClick={onComplete}
          className="group relative flex items-center gap-10 bg-white/5 hover:bg-blue-600/30 border border-white/10 px-14 py-7 rounded-[40px] transition-all active:scale-95 shadow-2xl overflow-hidden backdrop-blur-2xl"
        >
          <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-full transition-all duration-1000"></div>
          
          <span className="text-white/40 font-black italic text-xl group-hover:text-white uppercase tracking-[0.5em] transition-colors relative z-10">Access Platform</span>
          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white text-lg font-black italic border border-white/20 relative z-10">
            {timeLeft}
          </div>
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_500px_rgba(0,0,0,1)] bg-gradient-to-t from-black via-transparent to-black opacity-80"></div>
    </div>
  );
};

export default SplashScreen;
