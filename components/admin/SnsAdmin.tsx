import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SMMProvider, SMMProduct, SMMSource, SMMOrder, SMMPriceAlert, NotificationType, BannerAd } from '@/types';
import { SNS_PLATFORMS } from '../../constants.tsx';
import { upsertSmmOrder } from '../../smmDb';
import { fetchProfileRow, updateProfile } from '../../profileDb';
import { fetchBannerAds, upsertBannerAd, deleteBannerAd } from '../../bannerDb';

interface Props {
  smmProviders: SMMProvider[];
  setSmmProviders: React.Dispatch<React.SetStateAction<SMMProvider[]>>;
  smmProducts: SMMProduct[];
  setSmmProducts: React.Dispatch<React.SetStateAction<SMMProduct[]>>;
  onDeleteSmmProducts?: (ids: string[]) => void;
  smmOrders: SMMOrder[];
  setSmmOrders: React.Dispatch<React.SetStateAction<SMMOrder[]>>;
  addNotif: (userId: string, type: NotificationType, title: string, message: string) => void;
}

type SnsTab = 'provider' | 'manage' | 'list' | 'order' | 'monitor' | 'banner';
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const SnsAdmin: React.FC<Props> = ({ smmProviders, setSmmProviders, smmProducts, setSmmProducts, onDeleteSmmProducts, smmOrders, setSmmOrders, addNotif }) => {
  const [activeTab, setActiveTab] = useState<SnsTab>('list');
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>(localStorage.getItem('smm_last_sync_full') || '미실행');

  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({ id: '', name: '', apiUrl: '' });

  const initialProductState: SMMProduct = {
    id: '', name: '', platform: '인스타그램', category: '', sellingPrice: 0, minQuantity: 10, maxQuantity: 100000, sources: []
  };
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<SMMProduct>(initialProductState);
  
  const [tempSource, setTempSource] = useState<SMMSource>({ providerId: '', serviceId: '', costPrice: 0, estimatedMinutes: undefined, minQuantity: undefined, maxQuantity: undefined });
  const [editingSourceIdx, setEditingSourceIdx] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('전체 플랫폼');
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  /** 인벤토리 상세에서 소스 수정 시: 해당 소스 식별 + 입력값 */
  const [editingSourceInList, setEditingSourceInList] = useState<{ platform: string; name: string; category: string; providerId: string; serviceId: string } | null>(null);
  const [editSourceForm, setEditSourceForm] = useState({ costPrice: 0, estimatedMinutes: undefined as number | undefined });

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('전체 상태');
  const [orderMonthFilter, setOrderMonthFilter] = useState('전체 기간');

  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // JAP 주문 상태 (orderId → { status, remains })
  // 배너 광고 관리
  const [bannerAds, setBannerAds] = useState<BannerAd[]>([]);
  const initialBannerForm: BannerAd = { id: '', companyName: '', imageUrl: '', linkUrl: '', startDate: '', endDate: '', isActive: true, displayMode: 'random', location: 'sns', memo: '', createdAt: '' };
  const [bannerForm, setBannerForm] = useState<BannerAd>(initialBannerForm);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const handleBannerImageUpload = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowed.includes(file.type)) { alert('jpg, png, gif 파일만 업로드 가능합니다.'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('파일 크기는 3MB 이하여야 합니다.'); return; }
    setBannerUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setBannerForm(p => ({ ...p, imageUrl: base64 }));
      setBannerUploading(false);
    };
    reader.onerror = () => {
      alert('파일 읽기 실패. 다시 시도해주세요.');
      setBannerUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const BANNER_LS_KEY = 'banner_ads_local';

  const saveBannersToLocal = (list: BannerAd[]) => {
    // base64 이미지는 용량이 크므로 id/meta만 localStorage에 저장하고 전체는 state로만 관리
    localStorage.setItem(BANNER_LS_KEY, JSON.stringify(list));
  };

  useEffect(() => {
    fetchBannerAds()
      .then(data => {
        if (data.length > 0) {
          setBannerAds(data);
        } else {
          // DB에 데이터 없으면 localStorage 폴백
          try { const local = JSON.parse(localStorage.getItem(BANNER_LS_KEY) || '[]'); setBannerAds(local); } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // DB 연결 실패 시 localStorage 사용
        try { const local = JSON.parse(localStorage.getItem(BANNER_LS_KEY) || '[]'); setBannerAds(local); } catch { /* ignore */ }
      });
  }, []);

  const handleSaveBanner = async () => {
    if (!bannerForm.companyName || !bannerForm.imageUrl || !bannerForm.linkUrl || !bannerForm.startDate || !bannerForm.endDate) {
      alert('업체명, 배너 이미지, 링크 URL, 광고 기간은 필수입니다.'); return;
    }
    const now = new Date().toISOString();
    const saved: BannerAd = { ...bannerForm, id: bannerForm.id || `BNR${Date.now()}`, createdAt: bannerForm.createdAt || now };
    // UI 즉시 업데이트
    const next = bannerAds.some(b => b.id === saved.id)
      ? bannerAds.map(b => b.id === saved.id ? saved : b)
      : [saved, ...bannerAds];
    setBannerAds(next);
    saveBannersToLocal(next);
    setBannerForm(initialBannerForm);
    setEditingBannerId(null);
    // DB 저장 시도 (실패해도 localStorage에는 저장됨)
    upsertBannerAd(saved).catch(e => console.warn('배너 DB 저장 실패 (localStorage에는 저장됨):', e));
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('배너를 삭제하시겠습니까?')) return;
    const next = bannerAds.filter(b => b.id !== id);
    setBannerAds(next);
    saveBannersToLocal(next);
    deleteBannerAd(id).catch(e => console.warn('배너 DB 삭제 실패:', e));
  };

  const [japStatuses, setJapStatuses] = useState<Record<string, { status: string; remains: number; startCount?: number }>>({});
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // 원가 모니터링 알림
  const [priceAlerts, setPriceAlerts] = useState<SMMPriceAlert[]>(() => {
    try { return JSON.parse(localStorage.getItem('smm_price_alerts') || '[]'); } catch { return []; }
  });
  const [isCheckingPrices, setIsCheckingPrices] = useState(false);

  useEffect(() => {
    localStorage.setItem('smm_price_alerts', JSON.stringify(priceAlerts));
  }, [priceAlerts]);

  const activeProviderIds = useMemo(() =>
    new Set(smmProviders.filter(p => !p.isHidden).map(p => p.id)),
  [smmProviders]);

  const unreadAlertsCount = useMemo(() => priceAlerts.filter(a => !a.isRead).length, [priceAlerts]);

  // --- Netlify Functions 원가 동기화 (JS 버전) ---
  const handleBatchSync = useCallback(async (isAuto = false) => {
    if (syncStatus === 'syncing' || smmProviders.length === 0) return;
    
    setSyncStatus('syncing');
    try {
      // PHP 주소 대신 Netlify Function 주소 사용
      const response = await fetch('/.netlify/functions/smm-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: smmProviders })
      });
      const result = await response.json();

      if (result.status === 'success') {
        const latestRates = result.data;
        const avgTimes    = result.avgTimes || {};
        setSmmProducts(prevProducts => prevProducts.map(prod => ({
          ...prod,
          sources: (prod.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null).map(src => {
            const newPrice   = latestRates[src.providerId]?.[src.serviceId];
            const newAvgTime = avgTimes[src.providerId]?.[src.serviceId];
            return {
              ...src,
              ...(newPrice   != null ? { costPrice: newPrice }            : {}),
              ...(newAvgTime != null ? { estimatedMinutes: newAvgTime }   : {}),
            };
          })
        })));
        const now = new Date();
        const timeStr = now.toLocaleString();
        setLastSyncTime(timeStr);
        localStorage.setItem('smm_last_sync_full', timeStr);
        setSyncStatus('success');
        if(!isAuto) alert('모든 연결 소스의 원가 동기화가 완료되었습니다.');
      }
    } catch (err) {
      setSyncStatus('error');
      console.error("동기화 실패:", err);
      alert('동기화 처리 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [smmProviders, syncStatus, setSmmProducts]);

  // 원가 변동 감지 및 자동 업데이트
  const handlePriceCheck = useCallback(async (isAuto = false) => {
    if (isCheckingPrices || smmProviders.length === 0 || smmProducts.length === 0) return;

    setIsCheckingPrices(true);
    try {
      // 등록된 모든 (providerId, serviceId) 수집
      const sourceMap = new Map<string, { providerId: string; serviceId: string; currentCostPrice: number; productNames: string[] }>();
      smmProducts.forEach(prod => {
        (prod.sources || []).forEach(src => {
          if (!src.providerId || !src.serviceId) return;
          const key = `${src.providerId}_${src.serviceId}`;
          if (!sourceMap.has(key)) {
            sourceMap.set(key, { providerId: src.providerId, serviceId: src.serviceId, currentCostPrice: src.costPrice, productNames: [prod.name] });
          } else {
            const ex = sourceMap.get(key)!;
            if (!ex.productNames.includes(prod.name)) ex.productNames.push(prod.name);
          }
        });
      });

      const activeSources = Array.from(sourceMap.values()).filter(s =>
        smmProviders.some(p => p.id === s.providerId && !p.isHidden)
      );
      if (activeSources.length === 0) {
        if (!isAuto) alert('확인할 활성 소스가 없습니다.');
        return;
      }

      const response = await fetch('/.netlify/functions/smm-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkPrices',
          providers: smmProviders.filter(p => !p.isHidden),
          sources: activeSources,
        }),
      });
      const result = await response.json();

      if (result.status === 'success') {
        // 원가 자동 업데이트
        if (result.latestRates && Object.keys(result.latestRates).length > 0) {
          const avgTimes = result.avgTimes || {};
          setSmmProducts(prev => prev.map(prod => ({
            ...prod,
            sources: (prod.sources || []).map(src => {
              const newPrice   = result.latestRates[src.providerId]?.[src.serviceId];
              const newAvgTime = avgTimes[src.providerId]?.[src.serviceId];
              return {
                ...src,
                ...(newPrice   != null ? { costPrice: newPrice }          : {}),
                ...(newAvgTime != null ? { estimatedMinutes: newAvgTime } : {}),
              };
            }),
          })));
        }

        // 변동 알림 생성
        if (result.changes && result.changes.length > 0) {
          const newAlerts: SMMPriceAlert[] = result.changes.map((c: { providerId: string; serviceId: string; type: 'price_changed' | 'unavailable'; oldPrice: number; newPrice?: number; productNames: string[] }) => ({
            id: `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            providerId: c.providerId,
            providerName: smmProviders.find(p => p.id === c.providerId)?.name || c.providerId,
            serviceId: c.serviceId,
            type: c.type,
            oldPrice: c.oldPrice,
            newPrice: c.newPrice,
            productNames: c.productNames || [],
            detectedAt: new Date().toLocaleString(),
            isRead: false,
          }));
          setPriceAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        }

        const timeStr = new Date().toLocaleString();
        setLastSyncTime(timeStr);
        localStorage.setItem('smm_last_sync_full', timeStr);

        if (!isAuto) {
          if (result.changes?.length > 0) {
            alert(`원가 변동 ${result.changes.length}건 감지! 원가가 자동 업데이트되었습니다. 원가 모니터링 탭에서 확인하세요.`);
          } else {
            alert('원가 변동 없음: 모든 소스의 원가가 정상입니다.');
          }
        }
      }
    } catch (err) {
      console.error('원가 체크 실패:', err);
      if (!isAuto) alert('원가 조회 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingPrices(false);
    }
  }, [smmProviders, smmProducts, isCheckingPrices, setSmmProducts]);

  // JAP 공급처에서 주문 상태 일괄 조회
  const handleCheckOrderStatuses = useCallback(async () => {
    if (isCheckingStatus) return;
    const pending = smmOrders.filter(o =>
      o.status !== '작업완료' && o.externalOrderId && o.externalOrderId !== 'PENDING'
    );
    if (pending.length === 0) { alert('조회할 진행 중인 주문이 없습니다.'); return; }

    setIsCheckingStatus(true);
    try {
      // 공급처별로 묶기 (providerName → provider 매칭)
      const groups = new Map<string, { provider: SMMProvider; extIds: string[]; extToOurId: Map<string, string> }>();
      for (const order of pending) {
        const provider = smmProviders.find(p => p.name === order.providerName);
        if (!provider) continue;
        if (!groups.has(provider.id)) groups.set(provider.id, { provider, extIds: [], extToOurId: new Map() });
        const g = groups.get(provider.id)!;
        g.extIds.push(order.externalOrderId);
        g.extToOurId.set(order.externalOrderId, order.id);
      }

      const next: Record<string, { status: string; remains: number }> = { ...japStatuses };
      for (const [, g] of groups) {
        try {
          const resp = await fetch('/.netlify/functions/smm-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'orderStatus', providerId: g.provider.id, apiUrl: g.provider.apiUrl, orderIds: g.extIds }),
          });
          const result = await resp.json();
          if (result.status === 'success' && result.orders) {
            for (const [extId, data] of Object.entries(result.orders as Record<string, { status?: string; remains?: number; start_count?: number }>)) {
              const ourId = g.extToOurId.get(extId);
              if (ourId) next[ourId] = { status: data.status || '', remains: Number(data.remains ?? 0), startCount: Number(data.start_count ?? 0) };
            }
          }
        } catch (e) { console.error('orderStatus fetch error:', e); }
      }

      // start_count > 0인 주문의 initialCount 업데이트
      for (const [ourId, jap] of Object.entries(next)) {
        if ((jap.startCount ?? 0) > 0) {
          const order = pending.find(o => o.id === ourId);
          if (order && order.initialCount === 0) {
            const updated = { ...order, initialCount: jap.startCount! };
            setSmmOrders(prev => prev.map(o => o.id === ourId ? updated : o));
            upsertSmmOrder(updated).catch(e => console.warn('initialCount 업데이트 실패:', e));
          }
        }
      }

      // 공급처에서 Canceled/Refunded된 주문: 다른 serviceId로 재시도, 전부 실패 시 포인트 환불 + 주문취소
      const canceledOurIds = Object.entries(next)
        .filter(([, v]) => v.status === 'Canceled' || v.status === 'Refunded')
        .map(([id]) => id);

      for (const ourId of canceledOurIds) {
        const order = pending.find(o => o.id === ourId);
        if (!order) continue;

        const product = smmProducts.find(p => p.name === order.productName);
        if (!product?.sources?.length) {
          // 상품 정보 없음 → 즉시 취소 + 환불
          const canceledOrder = { ...order, status: '주문취소', externalOrderId: 'FAILED' };
          setSmmOrders(prev => prev.map(o => o.id === ourId ? canceledOrder : o));
          upsertSmmOrder(canceledOrder).catch(e => console.warn('주문취소 DB 실패:', e));
          const refundAmount = order.sellingPrice * order.quantity;
          fetchProfileRow(order.userId).then(row => {
            const cur = Number(row?.points ?? 0);
            return updateProfile(order.userId, { points: cur + refundAmount });
          }).catch(e => console.warn('환불 포인트 DB 실패:', e));
          addNotif(order.userId, 'sns_activation', '❌ 주문 취소 및 환불', `[${order.productName}] 공급처 주문 취소로 ${(order.sellingPrice * order.quantity).toLocaleString()}P가 환불되었습니다.`);
          delete next[ourId];
          continue;
        }

        // 현재 실패한 소스를 제외한 대안 소스 수집 (수량 범위 체크)
        const currentProvider = smmProviders.find(p => p.name === order.providerName);
        const altSources = product.sources.filter(s => {
          if (currentProvider && s.providerId === currentProvider.id) return false;
          const srcMin = s.minQuantity ?? product.minQuantity ?? 0;
          const srcMax = s.maxQuantity ?? product.maxQuantity ?? 999999999;
          return order.quantity >= srcMin && order.quantity <= srcMax;
        }).sort((a, b) => {
          const costA = a.costPrice ?? 0;
          const costB = b.costPrice ?? 0;
          if (costA !== costB) return costA - costB;
          return (a.estimatedMinutes ?? 999999) - (b.estimatedMinutes ?? 999999);
        });

        let retried = false;
        for (const source of altSources) {
          const provider = smmProviders.find(p => p.id === source.providerId);
          if (!provider) continue;
          try {
            const retryResp = await fetch('/.netlify/functions/smm-api', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'submit', providerId: source.providerId, apiUrl: provider.apiUrl, serviceId: source.serviceId, link: order.link, quantity: order.quantity }),
            });
            const retryResult = await retryResp.json();
            if (retryResult.status === 'success' && retryResult.orderId) {
              const updatedOrder = { ...order, externalOrderId: retryResult.orderId, status: '진행중', providerName: provider.name, costPrice: source.costPrice || 0 };
              setSmmOrders(prev => prev.map(o => o.id === ourId ? updatedOrder : o));
              upsertSmmOrder(updatedOrder).catch(e => console.warn('재시도 주문 DB 실패:', e));
              next[ourId] = { status: 'In progress', remains: order.quantity };
              addNotif(order.userId, 'sns_activation', '🔄 주문 재시도 성공', `[${order.productName}] 다른 공급처(${provider.name})로 주문이 재접수되었습니다.`);
              retried = true;
              break;
            } else {
              console.error('[재시도 실패] serviceId:', source.serviceId, '|', retryResult.message);
            }
          } catch (e) { console.error('[재시도 네트워크 오류] serviceId:', source.serviceId, e); }
        }

        if (!retried) {
          // 모든 소스 실패 → 주문취소 + 포인트 환불
          const canceledOrder = { ...order, status: '주문취소', externalOrderId: 'FAILED' };
          setSmmOrders(prev => prev.map(o => o.id === ourId ? canceledOrder : o));
          upsertSmmOrder(canceledOrder).catch(e => console.warn('주문취소 DB 실패:', e));
          const refundAmount = order.sellingPrice * order.quantity;
          fetchProfileRow(order.userId).then(row => {
            const cur = Number(row?.points ?? 0);
            return updateProfile(order.userId, { points: cur + refundAmount });
          }).catch(e => console.warn('환불 포인트 DB 실패:', e));
          addNotif(order.userId, 'sns_activation', '❌ 주문 취소 및 환불', `[${order.productName}] 모든 공급처 주문 실패로 ${refundAmount.toLocaleString()}P가 환불되었습니다.`);
          delete next[ourId];
        }
      }

      setJapStatuses(next);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [smmOrders, smmProviders, isCheckingStatus, japStatuses]);

  // 작업완료 처리: 상태 업데이트 + 주문자에게 알림
  const handleMarkComplete = useCallback((order: SMMOrder) => {
    setSmmOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: '작업완료' } : o));
    addNotif(order.userId, 'sns_activation', '✅ 작업 완료', `[${order.productName}] 주문하신 작업이 완료되었습니다. 링크를 확인해주세요.`);
    setJapStatuses(prev => { const n = { ...prev }; delete n[order.id]; return n; });
  }, [setSmmOrders, addNotif]);

  // 한국어 로케일 날짜 문자열 파싱 ("2024. 11. 1. 오전 9:30:00")
  const parseOrderTime = (timeStr: string): number | null => {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) return d.getTime();
    const m = timeStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    let h = parseInt(m[5]);
    if (m[4] === '오후' && h < 12) h += 12;
    if (m[4] === '오전' && h === 12) h = 0;
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), h, parseInt(m[6])).getTime();
  };

  // 상품 소스에서 예상 소요시간(분) 조회
  const getEstimatedMinsForOrder = useCallback((order: SMMOrder): number | undefined => {
    const product = smmProducts.find(p => p.name === order.productName);
    const provider = smmProviders.find(p => p.name === order.providerName);
    if (!product || !provider) return undefined;
    return product.sources.find(s => s.providerId === provider.id)?.estimatedMinutes;
  }, [smmProducts, smmProviders]);

  // 지연 알림 전송 이력 (localStorage - 중복 알림 방지)
  const [delayNotifiedIds, setDelayNotifiedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('smm_delay_notified') || '[]')); } catch { return new Set(); }
  });

  // 5분마다 지연 감지 → 구매자에게 자동 알림
  useEffect(() => {
    const checkDelays = () => {
      const active = smmOrders.filter(o => o.status === '진행중' && o.externalOrderId && o.externalOrderId !== 'PENDING');
      const toNotify: string[] = [];
      for (const order of active) {
        if (delayNotifiedIds.has(order.id)) continue;
        const estimatedMins = getEstimatedMinsForOrder(order);
        if (!estimatedMins) continue;
        const startMs = parseOrderTime(order.orderTime);
        if (!startMs) continue;
        if ((Date.now() - startMs) / 60000 > estimatedMins) {
          addNotif(order.userId, 'sns_activation', '⏳ 작업 지연 안내', '주문이 폭주하여 작업이 지연되고 있습니다. 조금만 기다려주세요.');
          toNotify.push(order.id);
        }
      }
      if (toNotify.length > 0) {
        setDelayNotifiedIds(prev => {
          const next = new Set(prev);
          toNotify.forEach(id => next.add(id));
          localStorage.setItem('smm_delay_notified', JSON.stringify(Array.from(next)));
          return next;
        });
      }
    };
    checkDelays();
    const interval = setInterval(checkDelays, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [smmOrders, delayNotifiedIds, getEstimatedMinsForOrder, addNotif]);

  // 자동 스케줄: 매일 자정(0시), 정오(12시) 원가 체크
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      if (now.getMinutes() === 0 && [0, 12].includes(now.getHours())) {
        handlePriceCheck(true);
        handleBatchSync(true);
      }
    };
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [handleBatchSync, handlePriceCheck]);

  const fetchSinglePrice = async () => {
    if (!tempSource.providerId || !tempSource.serviceId) return alert('공급처와 서비스 ID를 입력하세요.');
    const provider = smmProviders.find(p => p.id === tempSource.providerId);
    if (!provider) return;

    setIsFetchingSingle(true);
    try {
      // PHP 주소 대신 Netlify Function 주소 사용 (GET 방식)
      const response = await fetch(`/.netlify/functions/smm-api?providerId=${provider.id}&serviceId=${tempSource.serviceId}&apiUrl=${encodeURIComponent(provider.apiUrl)}`);
      const result = await response.json();
      if (result.status === 'success') {
        setTempSource(prev => ({
          ...prev,
          costPrice: result.price,
          ...(result.avgTime != null ? { estimatedMinutes: result.avgTime } : {}),
        }));
      } else {
        throw new Error(result.message || "API Error");
      }
    } catch (error) {
      console.error("조회 실패:", error);
      alert('공급처 API에 접근할 수 없습니다. Netlify 환경 변수 설정을 확인하세요.');
    } finally {
      setIsFetchingSingle(false);
    }
  };

  const handleSaveProvider = () => {
    if(!providerForm.id || !providerForm.name || !providerForm.apiUrl) return alert('모든 정보를 입력하세요.');
    if (editingProviderId) {
      setSmmProviders(prev => prev.map(p => p.id === editingProviderId ? { ...p, ...providerForm } : p));
      setEditingProviderId(null);
    } else {
      if (smmProviders.some(p => p.id === providerForm.id)) return alert('이미 존재하는 공급처 ID입니다.');
      setSmmProviders(prev => [...prev, { ...providerForm, isHidden: false }]);
    }
    setProviderForm({ id: '', name: '', apiUrl: '' });
  };

  const startEditProvider = (p: SMMProvider) => {
    setProviderForm({ id: p.id, name: p.name, apiUrl: p.apiUrl });
    setEditingProviderId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProvider = (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setSmmProviders(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleSaveProduct = () => {
    if (!productForm.name) return alert('상품명을 입력하세요.');
    setSmmProducts(prev => {
      const sameKey = (i: SMMProduct) =>
        i.platform === productForm.platform &&
        i.name === productForm.name &&
        (i.category || '') === (productForm.category || '');
      const toMerge = prev.filter(sameKey);
      const filtered = prev.filter(i => !sameKey(i));
      // null/잘못된 소스 제거 후 저장 (providerId 읽기 오류 방지)
      const validSources = (productForm.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null && s.serviceId != null);
      const finalProduct = { ...productForm, id: editingProductId || toMerge[0]?.id || `prod_${Date.now()}`, sources: validSources };
      return [...filtered, finalProduct];
    });
    setProductForm(initialProductState);
    setEditingProductId(null);
    setActiveTab('list');
    alert('마스터 상품 통합 데이터 저장이 완료되었습니다.');
  };

  const handleAddOrUpdateSource = () => {
    if (!tempSource.providerId || !tempSource.serviceId) return alert('공급처와 서비스 ID를 입력하세요.');
    if (editingSourceIdx !== null) {
      const updated = [...productForm.sources];
      updated[editingSourceIdx] = { ...tempSource };
      setProductForm({ ...productForm, sources: updated });
      setEditingSourceIdx(null);
    } else {
      setProductForm({ ...productForm, sources: [...productForm.sources, { ...tempSource }] });
    }
    setTempSource({ providerId: '', serviceId: '', costPrice: 0, estimatedMinutes: undefined, minQuantity: undefined, maxQuantity: undefined });
  };

  const startEditProduct = (p: SMMProduct) => {
    setEditingProductId(p.id);
    const validSources = (p.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null && s.serviceId != null);
    setProductForm({ ...p, sources: validSources });
    setActiveTab('manage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpand = (id: string) => {
    setExpandedProductIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    setEditingSourceInList(null);
  };

  const sameProductKey = (a: SMMProduct, b: SMMProduct) =>
    a.platform === b.platform && a.name === b.name && (a.category || '') === (b.category || '');

  const deleteSourceFromInventory = (p: SMMProduct, src: SMMSource) => {
    if (!window.confirm(`소스 #${src.serviceId}를 삭제하시겠습니까?`)) return;
    setSmmProducts(prev =>
      prev
        .map(prod => {
          if (!sameProductKey(prod, p)) return prod;
          return { ...prod, sources: (prod.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null && !(s.providerId === src.providerId && s.serviceId === src.serviceId)) };
        })
        // 소스가 0개여도 직접 작업 상품일 수 있으므로 삭제하지 않음
    );
    setEditingSourceInList(null);
  };

  const startEditSourceInList = (p: SMMProduct, src: SMMSource) => {
    setEditingSourceInList({ platform: p.platform, name: p.name, category: p.category || '', providerId: src.providerId, serviceId: src.serviceId });
    setEditSourceForm({ costPrice: src.costPrice ?? 0, estimatedMinutes: src.estimatedMinutes });
  };

  const saveEditSourceInList = () => {
    if (!editingSourceInList) return;
    setSmmProducts(prev =>
      prev.map(prod => {
        if (prod.platform !== editingSourceInList.platform || prod.name !== editingSourceInList.name || (prod.category || '') !== editingSourceInList.category)
          return prod;
        return {
          ...prod,
          sources: (prod.sources || []).map(s =>
            s.providerId === editingSourceInList.providerId && s.serviceId === editingSourceInList.serviceId
              ? { ...s, costPrice: editSourceForm.costPrice, estimatedMinutes: editSourceForm.estimatedMinutes }
              : s
          ),
        };
      })
    );
    setEditingSourceInList(null);
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    smmOrders.forEach(o => {
      if (o.orderTime) {
        const month = o.orderTime.substring(0, 7);
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [smmOrders]);

  const filteredOrders = useMemo(() => {
    return smmOrders.filter(o => {
      const q = orderSearch.toLowerCase();
      const matchSearch = 
        o.id.toLowerCase().includes(q) || 
        o.userId.toLowerCase().includes(q) || 
        o.userNickname.toLowerCase().includes(q) || 
        o.productName.toLowerCase().includes(q);
      const matchPlatform = filterPlatform === '전체 플랫폼' || o.platform === filterPlatform;
      const matchStatus = orderStatusFilter === '전체 상태' || o.status === orderStatusFilter;
      const matchMonth = orderMonthFilter === '전체 기간' || (o.orderTime && o.orderTime.startsWith(orderMonthFilter));
      
      return matchSearch && matchPlatform && matchStatus && matchMonth;
    });
  }, [smmOrders, orderSearch, filterPlatform, orderStatusFilter, orderMonthFilter]);

  const orderStats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.sellingPrice * o.quantity), 0);
    const totalProfit = filteredOrders.reduce((sum, o) => sum + o.profit, 0);
    return { count: filteredOrders.length, revenue: totalRevenue, profit: totalProfit };
  }, [filteredOrders]);

  const groupedInventory = useMemo(() => {
    const map = new Map<string, SMMProduct>();
    [...smmProducts].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)).filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchPlatform = filterPlatform === '전체 플랫폼' || p.platform === filterPlatform;
      return matchSearch && matchPlatform;
    }).forEach(p => {
      const key = `${p.platform}_${p.name}_${p.category || ''}`;
      if (!map.has(key)) {
        const clone = JSON.parse(JSON.stringify(p));
        clone.sources = (clone.sources || []).filter((s: SMMSource) => s != null && s.providerId != null);
        map.set(key, clone);
      } else {
        const existing = map.get(key)!;
        (p.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null).forEach(newSrc => {
          if (!existing.sources.find(s => s && s.providerId === newSrc.providerId && s.serviceId === newSrc.serviceId)) existing.sources.push(newSrc);
        });
      }
    });
    return Array.from(map.values());
  }, [smmProducts, searchQuery, filterPlatform]);

  // ▲▼ 버튼으로 상품 순서 변경 후 즉시 저장
  const moveProduct = useCallback(async (currentIdx: number, direction: 'up' | 'down') => {
    const arr = [...groupedInventory];
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    // swap
    [arr[currentIdx], arr[targetIdx]] = [arr[targetIdx], arr[currentIdx]];
    // 새 sortOrder 배정
    const keyToOrder = new Map(arr.map((p, i) => [`${p.platform}_${p.name}_${p.category || ''}`, i]));
    const updated = smmProducts.map(p => ({
      ...p,
      sortOrder: keyToOrder.get(`${p.platform}_${p.name}_${p.category || ''}`) ?? p.sortOrder ?? 9999,
    }));
    setSmmProducts(updated);
    setIsSavingOrder(true);
    try {
      const { upsertSmmProducts } = await import('../../smmDb');
      await upsertSmmProducts(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingOrder(false);
    }
  }, [groupedInventory, smmProducts, setSmmProducts]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white border-2 border-blue-50 p-8 rounded-[48px] shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-all">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest italic mb-2">Total Orders ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-gray-900 italic tracking-tighter">{orderStats.count.toLocaleString()}</span>
               <span className="text-lg font-bold text-gray-300">건</span>
            </div>
         </div>
         <div className="bg-white border-2 border-blue-50 p-8 rounded-[48px] shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-all">
            <span className="text-[11px] font-black text-green-500 uppercase tracking-widest italic mb-2">Total Revenue ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-gray-900 italic tracking-tighter">{orderStats.revenue.toLocaleString()}</span>
               <span className="text-lg font-bold text-gray-300">P</span>
            </div>
         </div>
         <div className="bg-gray-900 p-8 rounded-[48px] shadow-2xl flex flex-col justify-between text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
            <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest italic mb-2 relative z-10">Real-time Net Profit ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2 relative z-10">
               <span className="text-4xl font-black text-blue-400 italic tracking-tighter">{orderStats.profit.toLocaleString()}</span>
               <span className="text-lg font-bold text-blue-900">P</span>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px]"></div>
         </div>
      </div>

      <div className="bg-gray-900 p-2.5 rounded-[40px] flex gap-2 shadow-2xl flex-wrap">
        {[
          { id: 'provider', label: '📡 공급처 설정' },
          { id: 'manage', label: '🛠️ 상품 등록' },
          { id: 'list', label: '📋 상품 인벤토리' },
          { id: 'order', label: '📈 주문 분석' },
          { id: 'monitor', label: `🔔 원가 모니터링${unreadAlertsCount > 0 ? ` (${unreadAlertsCount})` : ''}` },
          { id: 'banner', label: '🖼️ 배너 광고 관리' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as SnsTab); if (tab.id !== 'manage') setEditingProductId(null); if (tab.id === 'monitor') setPriceAlerts(prev => prev.map(a => ({ ...a, isRead: true }))); }}
            className={`flex-1 py-5 rounded-[28px] font-black text-[14px] transition-all relative ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {tab.label}
            {tab.id === 'monitor' && unreadAlertsCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'provider' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-12 md:p-16 rounded-[60px] shadow-sm border border-gray-100 space-y-12">
             <h3 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">공급처(Provider) 신규 시스템 등록</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">공급처 ID (Key매칭용)</label>
                 <input value={providerForm.id} onChange={e => setProviderForm({...providerForm, id: e.target.value})} placeholder="p1, p2 등" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" disabled={!!editingProviderId} />
              </div>
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">공급처 별칭</label>
                 <input value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} placeholder="예: JAP 메인서버" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" />
              </div>
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">API URL</label>
                 <input value={providerForm.apiUrl} onChange={e => setProviderForm({...providerForm, apiUrl: e.target.value})} placeholder="https://api-endpoint.com" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" />
              </div>
            </div>
            <button onClick={handleSaveProvider} className="w-full py-8 bg-gray-900 text-white rounded-[40px] font-black text-xl hover:bg-blue-600 transition-all uppercase italic">
              {editingProviderId ? '공급처 정보 업데이트' : '신규 공급처 시스템 등록하기'}
            </button>
          </div>
          <div className="space-y-6 px-4">
             <h4 className="text-xl font-black text-gray-900 italic uppercase">시스템 등록 공급처 목록 ({smmProviders.length})</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {smmProviders.map(p => (
                  <div key={p.id} className={`bg-white p-8 rounded-[40px] shadow-sm border-2 transition-all group ${p.isHidden ? 'grayscale opacity-50 bg-gray-50 border-gray-300' : 'border-gray-100 hover:border-blue-200'}`}>
                     <div className="flex justify-between items-start mb-6">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase italic ${p.isHidden ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>ID: {p.id}</span>
                        <div className="flex gap-2">
                           {!p.isHidden && <button onClick={() => startEditProvider(p)} className="text-gray-300 hover:text-blue-500 font-black text-sm">수정</button>}
                           <button onClick={() => handleDeleteProvider(p.id)} className="text-gray-300 hover:text-red-500 font-black text-sm">삭제</button>
                        </div>
                     </div>
                     <h5 className="text-2xl font-black text-gray-900 mb-2 italic">{p.name}</h5>
                     <p className="text-[11px] font-bold text-gray-400 truncate opacity-60 mb-6">{p.apiUrl}</p>
                     <button onClick={() => setSmmProviders(prev => prev.map(item => item.id === p.id ? { ...item, isHidden: !item.isHidden } : item))} className={`w-full py-3 rounded-2xl font-black text-[11px] transition-all italic uppercase ${p.isHidden ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-900 text-white'}`}>
                        {p.isHidden ? '⚠️ 시스템 중지됨 (재가동)' : '현재 정상 운영 중 (중지)'}
                     </button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white p-12 md:p-20 rounded-[80px] shadow-sm border border-gray-100 space-y-20 animate-in zoom-in-95">
           <div className="flex justify-between items-center pb-10 border-b border-gray-100">
             <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-[16px]">
               <span className="mr-4">💎</span>마스터 상품 통합 데이터 등록
             </h3>
             {editingProductId && <button onClick={() => { setEditingProductId(null); setProductForm(initialProductState); }} className="text-sm font-black text-gray-400 hover:text-red-500">취소</button>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
             <div className="lg:col-span-6 space-y-12">
                <div className="space-y-8">
                   <div className="space-y-3">
                     <label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">사용자 노출 상품명</label>
                     <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="예: 한국인 팔로워" className="w-full p-8 bg-gray-50 border-none rounded-[40px] font-black text-2xl shadow-inner outline-none focus:ring-4 focus:ring-blue-50" />
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">대상 플랫폼</label><select value={productForm.platform} onChange={e => setProductForm({...productForm, platform: e.target.value})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black text-lg shadow-inner outline-none">{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">카테고리 분류</label><input value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} placeholder="팔로워" className="w-full p-6 bg-gray-50 rounded-[32px] font-black text-lg shadow-inner outline-none" /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">최소 주문량 (Min)</label><input type="number" value={productForm.minQuantity} onChange={e => setProductForm({...productForm, minQuantity: Number(e.target.value)})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black shadow-inner outline-none text-right px-10" /></div>
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">최대 주문량 (Max)</label><input type="number" value={productForm.maxQuantity} onChange={e => setProductForm({...productForm, maxQuantity: Number(e.target.value)})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black shadow-inner outline-none text-right px-10" /></div>
                   </div>
                   <div className="bg-[#F0F7FF] p-10 rounded-[56px] border-2 border-blue-100 flex flex-col gap-6 shadow-sm">
                      <label className="text-[12px] font-black text-blue-500 px-4 uppercase italic block tracking-widest leading-none">최종 판매 단가 (1개 기준 Point)</label>
                      <div className="flex items-center gap-6 w-full min-w-0">
                         <input type="number" value={productForm.sellingPrice || ''} onChange={e => setProductForm({...productForm, sellingPrice: Number(e.target.value)})} className="w-full min-w-[8rem] max-w-[20rem] p-8 bg-white rounded-[32px] font-black text-4xl text-blue-600 shadow-sm text-right outline-none ring-4 ring-blue-50/50" />
                         <span className="text-3xl font-black text-blue-300 italic shrink-0">P</span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-6 space-y-10">
                <div className="bg-[#0f172a] p-12 rounded-[64px] shadow-2xl space-y-12 text-white relative overflow-hidden">
                   <div className="relative z-10">
                      <h4 className="text-xl font-black italic uppercase tracking-[0.2em] text-blue-400 mb-10 flex items-center gap-4">
                         <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_15px_#3b82f6]"></span>
                         공급처 소스 매핑 및 원가 통제 센터
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase px-2 italic tracking-widest">공급처 선택</label>
                            <select value={tempSource.providerId} onChange={e => setTempSource({...tempSource, providerId: e.target.value})} className="w-full p-5 bg-white/5 rounded-[24px] font-black text-white outline-none border border-white/10 text-[15px] focus:ring-2 focus:ring-blue-500/50">
                               <option value="" className="text-black">공급처 선택</option>
                               {smmProviders.map(p => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}
                            </select>
                         </div>
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase px-2 italic tracking-widest">공급처 서비스 ID</label>
                            <div className="grid grid-cols-[1.4fr_0.6fr] gap-2">
                               <input 
                                 value={tempSource.serviceId} 
                                 onChange={e => setTempSource({...tempSource, serviceId: e.target.value})} 
                                 placeholder="ID 입력" 
                                 className="w-full p-5 bg-white/5 rounded-[24px] font-black text-white outline-none border border-white/10 text-[15px] focus:border-blue-500/50" 
                               />
                               <button 
                                 onClick={fetchSinglePrice} 
                                 disabled={isFetchingSingle} 
                                 className="w-full bg-blue-600 rounded-[20px] text-[13px] font-black hover:bg-blue-500 transition-all shrink-0 shadow-lg active:scale-95 disabled:bg-gray-700"
                               >
                                 {isFetchingSingle ? '⏳' : '조회'}
                               </button>
                            </div>
                         </div>
                      </div>
                      <div className="bg-white/5 p-5 rounded-[32px] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                         <div className="flex items-center gap-6 flex-wrap">
                            <div className="space-y-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">실시간 원가 정보</span>
                               <div className="flex items-baseline gap-2">
                                  <input type="number" value={tempSource.costPrice || 0} onChange={e => setTempSource({...tempSource, costPrice: Number(e.target.value)})} className="bg-transparent text-4xl font-black text-green-400 italic outline-none w-28 border-b border-white/10" />
                                  <span className="text-xl font-black text-green-400/30 italic">P</span>
                               </div>
                            </div>
                            <div className="space-y-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">
                                 예상 소요(분)
                                 {tempSource.estimatedMinutes != null && (
                                   <span className="ml-1 text-green-400 normal-case not-italic">(JAP 자동)</span>
                                 )}
                               </span>
                               <input type="number" min={0} placeholder="조회 시 자동입력" value={tempSource.estimatedMinutes ?? ''} onChange={e => setTempSource({...tempSource, estimatedMinutes: e.target.value === '' ? undefined : Number(e.target.value)})} className="bg-transparent text-xl font-black text-white italic outline-none w-24 border-b border-white/10" />
                            </div>
                            <div className="space-y-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">소스별 수량(선택)</span>
                               <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="text-[9px] text-gray-400">최소</span>
                                  <input type="number" min={0} placeholder="상품" value={tempSource.minQuantity ?? ''} onChange={e => setTempSource({...tempSource, minQuantity: e.target.value === '' ? undefined : Number(e.target.value)})} className="bg-transparent text-lg font-black text-white italic outline-none w-14 border-b border-white/10" />
                                  <span className="text-[9px] text-gray-400">~ 최대</span>
                                  <input type="number" min={0} placeholder="상품" value={tempSource.maxQuantity ?? ''} onChange={e => setTempSource({...tempSource, maxQuantity: e.target.value === '' ? undefined : Number(e.target.value)})} className="bg-transparent text-lg font-black text-white italic outline-none w-14 border-b border-white/10" />
                               </div>
                            </div>
                         </div>
                         <button onClick={handleAddOrUpdateSource} className="w-full md:w-auto px-6 py-3.5 bg-white text-[#0f172a] rounded-[20px] font-black text-[13px] hover:bg-blue-400 transition-all uppercase italic shadow-lg shrink-0">
                            {editingSourceIdx !== null ? '소스 수정 완료' : '+ 리스트에 추가'}
                         </button>
                      </div>
                   </div>
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none"></div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 no-scrollbar border-t border-gray-50 pt-4">
                   <p className="text-[11px] font-black text-gray-400 uppercase italic px-4 mb-2">현재 연결된 다중 소스 목록 ({productForm.sources.length}) — 직접 작업 시 공급처 없이 등록 가능</p>
                   {(productForm.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null).map((s, idx) => (
                     <div key={`${s.providerId}_${s.serviceId}_${idx}`} className="flex items-center justify-between p-6 bg-gray-50 rounded-[32px] border border-gray-100 group transition-all hover:border-blue-200">
                        <div className="flex items-center gap-6">
                           <span className="bg-gray-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase italic tracking-tighter">{s.providerId}</span>
                           <div>
                              <p className="font-black text-gray-800 text-sm">Service ID: <span className="text-blue-600">#{s.serviceId}</span></p>
                              <p className="text-[11px] font-bold text-gray-400 italic">원가: {s.costPrice.toLocaleString()}P{s.estimatedMinutes != null ? ` · ${s.estimatedMinutes}분` : ''} · 최소~최대: {(s.minQuantity ?? productForm.minQuantity).toLocaleString()}~{(s.maxQuantity ?? productForm.maxQuantity).toLocaleString()}</p>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingSourceIdx(idx); setTempSource({...s}); }} className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-500 shadow-sm border border-gray-100 hover:bg-blue-50">수정</button>
                           <button onClick={() => setProductForm({...productForm, sources: productForm.sources.filter((_, i) => i !== idx)})} className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black text-red-300 shadow-sm border border-gray-100 hover:text-red-500">✕</button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
          <button onClick={handleSaveProduct} className="w-full py-12 bg-gray-900 text-white rounded-[50px] font-black text-4xl shadow-2xl hover:bg-blue-600 transition-all italic tracking-[0.3em] uppercase">마스터 상품 통합 데이터 저장 완료 💾</button>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-10 animate-in fade-in max-w-[1600px] mx-auto">
           <div className="bg-white p-10 rounded-[56px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-10">
              <h3 className="text-3xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8 px-6">통합 상품 인벤토리 리얼타임 대시보드</h3>
              <div className="flex gap-4 items-center flex-wrap">
                 <div className="flex gap-4 bg-gray-50 p-2 rounded-[32px] shadow-inner">
                    <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="p-4 bg-white border-none rounded-[24px] font-black text-sm shadow-sm outline-none cursor-pointer">
                       <option>전체 플랫폼</option>{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <div className="relative">
                       <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="상품명 검색..." className="pl-8 pr-16 py-4 bg-white border-none rounded-[24px] font-bold text-[15px] shadow-sm outline-none w-80" />
                       <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300">🔍</span>
                    </div>
                 </div>
                 {isSavingOrder && <span className="text-[12px] font-black text-purple-500 italic animate-pulse">저장 중...</span>}
              </div>
           </div>
           <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest italic">
                       <tr>
                          <th className="px-6 py-6 text-center">순서</th>
                          <th className="px-10 py-6">플랫폼</th>
                          <th className="px-10 py-6">노출 상품명 / 연결 ID</th>
                          <th className="px-10 py-6">카테고리</th>
                          <th className="px-10 py-6">주문수량(Min/Max)</th>
                          <th className="px-10 py-6 text-right">최종 판매가</th>
                          <th className="px-10 py-6 text-center">관리 / 소스</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {groupedInventory.length === 0 ? (
                         <tr><td colSpan={7} className="py-40 text-center text-gray-300 font-black italic">등록된 상품이 없습니다.</td></tr>
                       ) : groupedInventory.map((p, idx) => {
                         const safeSources = (p.sources || []).filter((s): s is SMMSource => s != null && s.providerId != null);
                         const allSourcesDisabled = safeSources.length > 0 && safeSources.every(s => !activeProviderIds.has(s.providerId));
                         return (
                           <React.Fragment key={p.id}>
                             <tr className={`transition-all hover:bg-blue-50/30 ${expandedProductIds.includes(p.id) ? 'bg-blue-50/50' : ''} ${allSourcesDisabled ? 'grayscale opacity-40 bg-gray-50' : ''}`}>
                                <td className="px-6 py-8 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <button
                                      onClick={() => moveProduct(idx, 'up')}
                                      disabled={idx === 0 || isSavingOrder}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-600 text-gray-400 font-black text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    >▲</button>
                                    <span className="text-[11px] font-black text-gray-300">{idx + 1}</span>
                                    <button
                                      onClick={() => moveProduct(idx, 'down')}
                                      disabled={idx === groupedInventory.length - 1 || isSavingOrder}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-600 text-gray-400 font-black text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    >▼</button>
                                  </div>
                                </td>
                                <td className="px-10 py-8 whitespace-nowrap"><span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase italic tracking-tighter shadow-md whitespace-nowrap ${allSourcesDisabled ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white'}`}>{p.platform}</span></td>
                                <td className="px-10 py-8"><div className="flex items-center gap-3"><p className="font-black text-gray-900 text-xl italic tracking-tight">{p.name}</p>{allSourcesDisabled && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black italic shadow-sm uppercase animate-pulse">공급중단</span>}</div><div className="flex flex-wrap gap-1 mt-2">{safeSources.map((s, si) => (<span key={si} className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${activeProviderIds.has(s.providerId) ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-red-50 text-red-500 border-red-100'}`}>#{s.serviceId}</span>))}</div></td>
                                <td className="px-10 py-8"><span className="text-sm font-black text-gray-500 uppercase italic tracking-widest">{p.category}</span></td>
                                <td className="px-10 py-8"><p className="text-[13px] font-black text-gray-600 italic">{p.minQuantity.toLocaleString()} ~ {p.maxQuantity.toLocaleString()}</p></td>
                                <td className="px-10 py-8 text-right"><p className="text-2xl font-black text-blue-600 italic tracking-tighter">{p.sellingPrice.toLocaleString()}<span className="text-sm not-italic opacity-40 ml-1">P</span></p></td>
                                <td className="px-10 py-8 text-center"><div className="flex justify-center gap-3"><button onClick={() => toggleExpand(p.id)} className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all shadow-sm ${expandedProductIds.includes(p.id) ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{expandedProductIds.includes(p.id) ? '상세 닫기 ▲' : `소스(${safeSources.length}) ▼`}</button><button onClick={() => startEditProduct(p)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black hover:bg-black transition-all shadow-md italic">그룹수정</button><button onClick={() => { if(!window.confirm('정말 삭제하시겠습니까?')) return; const idsToDelete = smmProducts.filter(i => sameProductKey(i, p)).map(i => i.id); if (onDeleteSmmProducts) onDeleteSmmProducts(idsToDelete); else setSmmProducts(prev => prev.filter(i => !sameProductKey(i, p))); }} className="text-red-200 hover:text-red-500 font-black text-xl px-2">✕</button></div></td>
                             </tr>
                             {expandedProductIds.includes(p.id) && (
                               <tr className="bg-gray-50/50 animate-in slide-in-from-top-2 duration-300">
                                 <td colSpan={6} className="px-12 py-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                       {safeSources.map((src, sidx) => {
                                         const provider = smmProviders.find(sp => sp.id === src.providerId);
                                         const isProviderDisabled = provider?.isHidden;
                                         const margin = p.sellingPrice - src.costPrice;
                                         const isEditing = editingSourceInList?.providerId === src.providerId && editingSourceInList?.serviceId === src.serviceId && editingSourceInList?.platform === p.platform && editingSourceInList?.name === p.name && (editingSourceInList?.category || '') === (p.category || '');
                                         return (
                                           <div key={`${src.providerId}_${src.serviceId}_${sidx}`} className={`bg-white border rounded-[32px] p-8 shadow-sm flex flex-col gap-6 transition-all ${isProviderDisabled ? 'grayscale opacity-50 border-red-200 bg-red-50/20' : 'border-gray-100 hover:border-blue-200'}`}>
                                              <div className="flex justify-between items-start"><div><span className={`px-3 py-1 rounded-lg text-[9px] font-black italic uppercase tracking-widest ${isProviderDisabled ? 'bg-gray-400 text-white' : 'bg-gray-900 text-white'}`}>{src.providerId}</span><h5 className="font-black text-gray-900 text-lg mt-2 italic">{provider?.name || '공급처 미확인'}{isProviderDisabled && <span className="ml-2 text-red-500 text-[10px] font-black">(잠김)</span>}</h5></div><div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic mb-1">Service ID</p><p className={`text-2xl font-black ${isProviderDisabled ? 'text-gray-400' : 'text-blue-600'}`}>#{src.serviceId}</p></div></div>
                                              {isEditing ? (
                                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                                  <div className="grid grid-cols-2 gap-4">
                                                    <div><label className="text-[10px] font-black text-gray-400 uppercase italic">원가(P)</label><input type="number" value={editSourceForm.costPrice} onChange={e => setEditSourceForm(f => ({ ...f, costPrice: Number(e.target.value) }))} className="w-full mt-1 p-3 rounded-xl border border-gray-200 font-black text-green-600" /></div>
                                                    <div><label className="text-[10px] font-black text-gray-400 uppercase italic">예상 소요(분)</label><input type="number" min={0} placeholder="선택" value={editSourceForm.estimatedMinutes ?? ''} onChange={e => setEditSourceForm(f => ({ ...f, estimatedMinutes: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-full mt-1 p-3 rounded-xl border border-gray-200 font-black" /></div>
                                                  </div>
                                                  <div className="flex gap-2"><button onClick={saveEditSourceInList} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[12px] font-black">저장</button><button onClick={() => setEditingSourceInList(null)} className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-[12px] font-black">취소</button></div>
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-50"><div className="space-y-1"><p className="text-[10px] font-black text-gray-400 uppercase italic">원가</p><p className={`text-lg font-black italic ${isProviderDisabled ? 'text-gray-400' : 'text-green-500'}`}>{src.costPrice.toLocaleString()}P</p></div><div className="space-y-1 text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic">마진</p><p className={`text-lg font-black italic ${isProviderDisabled ? 'text-gray-300' : (margin > 0 ? 'text-blue-500' : 'text-red-500')}`}>{margin.toLocaleString()}P</p></div></div>
                                                  <div className="flex gap-2 pt-2"><button onClick={() => startEditSourceInList(p, src)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-[11px] font-black hover:bg-blue-100">수정</button><button onClick={() => deleteSourceFromInventory(p, src)} className="flex-1 py-2 bg-red-50 text-red-500 rounded-xl text-[11px] font-black hover:bg-red-100">삭제</button></div>
                                                </>
                                              )}
                                           </div>
                                         );
                                       })}
                                       <button type="button" onClick={() => { startEditProduct(p); setActiveTab('manage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-[32px] p-8 flex flex-col items-center justify-center gap-3 hover:bg-blue-100 hover:border-blue-400 transition-all min-h-[180px] group">
                                         <span className="text-4xl text-blue-400 group-hover:text-blue-600">➕</span>
                                         <span className="text-[13px] font-black text-blue-600 italic uppercase tracking-wider">소스 추가</span>
                                         <span className="text-[10px] text-gray-500">클릭 시 그룹수정에서 추가</span>
                                       </button>
                                    </div>
                                 </td>
                               </tr>
                             )}
                           </React.Fragment>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'monitor' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* 상단 컨트롤 */}
          <div className="bg-white p-10 rounded-[56px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="text-3xl font-black text-gray-900 italic uppercase underline decoration-orange-500 underline-offset-8">원가 모니터링 센터</h3>
              <p className="text-[13px] font-bold text-gray-400 mt-2">매일 자정(00:00) · 정오(12:00) 자동 체크 · 변동 시 원가 자동 반영</p>
              <p className="text-[12px] font-bold text-gray-300 mt-1">마지막 체크: {lastSyncTime}</p>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <button
                onClick={() => handlePriceCheck(false)}
                disabled={isCheckingPrices}
                className="px-8 py-4 bg-orange-500 text-white rounded-[28px] font-black text-[15px] hover:bg-orange-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCheckingPrices ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>조회 중...</>
                ) : '🔍 수동 원가 실시간 조회'}
              </button>
              {priceAlerts.length > 0 && (
                <button
                  onClick={() => { if (window.confirm('모든 알림을 삭제하시겠습니까?')) setPriceAlerts([]); }}
                  className="px-6 py-4 bg-gray-100 text-gray-500 rounded-[28px] font-black text-[13px] hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  전체 삭제
                </button>
              )}
            </div>
          </div>

          {/* 알림 목록 */}
          {priceAlerts.length === 0 ? (
            <div className="bg-white rounded-[48px] border border-gray-100 py-40 flex flex-col items-center gap-4 text-center shadow-sm">
              <span className="text-6xl">✅</span>
              <p className="text-2xl font-black text-gray-300 italic">변동 없음</p>
              <p className="text-[14px] font-bold text-gray-300">수동 조회 버튼을 누르거나 자동 스케줄(00:00 / 12:00) 결과를 기다리세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {priceAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`bg-white rounded-[40px] border-2 p-8 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all ${
                    !alert.isRead ? (alert.type === 'unavailable' ? 'border-red-300 bg-red-50/30' : 'border-orange-300 bg-orange-50/30') : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-6 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-md ${alert.type === 'unavailable' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}`}>
                      {alert.type === 'unavailable' ? '🚫' : '💰'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase italic ${alert.type === 'unavailable' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                          {alert.type === 'unavailable' ? '서비스 중단' : '원가 변동'}
                        </span>
                        <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-[10px] font-black italic">{alert.providerName}</span>
                        <span className="text-[13px] font-black text-blue-600 italic">#{alert.serviceId}</span>
                        {!alert.isRead && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                      </div>
                      <p className="text-[14px] font-black text-gray-900 truncate">
                        {alert.type === 'price_changed'
                          ? `원가 변동: ${alert.oldPrice.toLocaleString()}P → ${(alert.newPrice ?? 0).toLocaleString()}P`
                          : `서비스 중단 감지 (기존 원가: ${alert.oldPrice.toLocaleString()}P)`
                        }
                      </p>
                      {alert.productNames.length > 0 && (
                        <p className="text-[11px] font-bold text-gray-400 mt-1 truncate">
                          연결 상품: {alert.productNames.join(', ')}
                        </p>
                      )}
                      <p className="text-[10px] font-bold text-gray-300 mt-1 italic">{alert.detectedAt}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPriceAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="text-gray-300 hover:text-red-500 font-black text-xl px-3 py-1 shrink-0 transition-all"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'banner' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* 배너 등록/수정 폼 */}
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xl font-black text-gray-900 italic uppercase">{editingBannerId ? '✏️ 배너 수정' : '➕ 배너 광고 등록'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">업체명 *</label><input type="text" value={bannerForm.companyName} onChange={e => setBannerForm(p => ({...p, companyName: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-200 text-sm" placeholder="예: 나이키코리아" /></div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">링크 URL *</label><input type="text" value={bannerForm.linkUrl} onChange={e => setBannerForm(p => ({...p, linkUrl: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-200 text-sm" placeholder="https://..." /></div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">배너 이미지 * <span className="normal-case text-gray-300 font-bold">(jpg · png · gif, 최대 5MB)</span></label>
                {/* 이미지 사이즈 안내 */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-[11px] text-blue-700 font-bold space-y-0.5">
                  <p className="font-black text-blue-800">📐 권장 이미지 사이즈 (잘림·여백 없이 딱 맞게)</p>
                  <p>• SNS활성화 (2열) → <span className="font-black">1400 × 260px</span> (비율 약 16:3)</p>
                  <p>• 자유게시판 (3열) → <span className="font-black">900 × 260px</span> (비율 약 7:2)</p>
                  <p className="text-blue-500 font-normal">이미지 비율이 다르면 검정 여백이 생길 수 있습니다.</p>
                </div>
                <label className={`flex items-center gap-4 p-4 bg-gray-50 rounded-2xl cursor-pointer border-2 border-dashed transition-all ${bannerUploading ? 'border-blue-300 opacity-60' : 'border-gray-200 hover:border-blue-400'}`}>
                  <input type="file" accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif" className="hidden" disabled={bannerUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageUpload(f); e.target.value = ''; }} />
                  {bannerUploading ? (
                    <span className="flex items-center gap-2 text-blue-500 font-black text-sm"><span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span>업로드 중...</span>
                  ) : bannerForm.imageUrl ? (
                    <span className="flex items-center gap-2 text-green-600 font-black text-sm">✅ 이미지 업로드 완료 <span className="text-gray-400 font-bold text-[11px]">(클릭해서 교체)</span></span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-400 font-bold text-sm">📁 파일 선택 (jpg · png · gif)</span>
                  )}
                </label>
              </div>
              {/* 노출 유형 선택 */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">노출 유형 *</label>
                <div className="flex gap-3">
                  {([['fixed', '고정형', '항상 같은 자리에 노출 (새로고침해도 유지)'], ['random', '자유형', '새로고침마다 랜덤으로 노출']] as const).map(([val, label, desc]) => (
                    <label key={val} className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all ${bannerForm.displayMode === val ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}>
                      <input type="radio" name="displayMode" value={val} checked={bannerForm.displayMode === val} onChange={() => setBannerForm(p => ({...p, displayMode: val}))} className="hidden" />
                      <p className="font-black text-sm text-gray-800">{label}</p>
                      <p className="text-[11px] text-gray-400 font-bold mt-0.5">{desc}</p>
                    </label>
                  ))}
                </div>
              </div>
              {/* 노출 위치 선택 */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">노출 위치 *</label>
                <div className="flex gap-3">
                  {([
                    ['sns',       'SNS활성화',  '월 30만원', 'bg-blue-50 border-blue-500', 'text-blue-700'],
                    ['freeboard', '자유게시판', '월 10만원', 'bg-green-50 border-green-500', 'text-green-700'],
                    ['both',      '전체',       '월 40만원', 'bg-purple-50 border-purple-500', 'text-purple-700'],
                  ] as const).map(([val, label, price, activeBg, priceColor]) => (
                    <label key={val} className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all ${bannerForm.location === val ? activeBg : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                      <input type="radio" name="location" value={val} checked={bannerForm.location === val} onChange={() => setBannerForm(p => ({...p, location: val}))} className="hidden" />
                      <p className="font-black text-sm text-gray-800">{label}</p>
                      <p className={`text-[12px] font-black mt-0.5 ${bannerForm.location === val ? priceColor : 'text-gray-400'}`}>{price}</p>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">광고 시작일 *</label><input type="date" value={bannerForm.startDate} onChange={e => setBannerForm(p => ({...p, startDate: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-200 text-sm" /></div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">광고 종료일 *</label><input type="date" value={bannerForm.endDate} onChange={e => setBannerForm(p => ({...p, endDate: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-200 text-sm" /></div>
              <div className="space-y-2 md:col-span-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">메모 (내부용)</label><input type="text" value={bannerForm.memo || ''} onChange={e => setBannerForm(p => ({...p, memo: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-200 text-sm" placeholder="광고비 금액, 담당자 등 메모" /></div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={bannerForm.isActive} onChange={e => setBannerForm(p => ({...p, isActive: e.target.checked}))} className="w-4 h-4 rounded accent-blue-600" />
                <span className="font-black text-sm text-gray-700">광고 활성화</span>
              </label>
            </div>
            {bannerForm.imageUrl && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">미리보기</p>
                <a href={bannerForm.linkUrl || '#'} target="_blank" rel="noopener noreferrer" className="block max-w-lg rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <img src={bannerForm.imageUrl} alt="미리보기" className="w-full h-auto object-cover" />
                </a>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleSaveBanner} className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-md">{editingBannerId ? '✅ 수정 저장' : '➕ 배너 등록'}</button>
              {editingBannerId && <button onClick={() => { setBannerForm(initialBannerForm); setEditingBannerId(null); }} className="px-8 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all">취소</button>}
            </div>
          </div>

          {/* 배너 목록 */}
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xl font-black text-gray-900 italic uppercase">등록된 배너 목록 ({bannerAds.length}개)</h3>
            {bannerAds.length === 0 ? (
              <p className="text-gray-300 font-black text-center py-16">등록된 배너가 없습니다.</p>
            ) : (
              <div className="space-y-5">
                {bannerAds.map(b => {
                  const _d = new Date();
                  const today = [_d.getFullYear(), String(_d.getMonth()+1).padStart(2,'0'), String(_d.getDate()).padStart(2,'0')].join('-');
                  const isLive = b.isActive && b.startDate <= today && b.endDate >= today;
                  return (
                    <div key={b.id} className="flex flex-col sm:flex-row gap-5 p-5 bg-gray-50/60 rounded-3xl border border-gray-100 group">
                      <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={b.imageUrl} alt={b.companyName} className="w-full sm:w-48 h-24 object-cover rounded-2xl shadow-sm" />
                      </a>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-gray-900 text-[15px]">{b.companyName}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{isLive ? '● 노출중' : '○ 비활성'}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${b.location === 'sns' ? 'bg-blue-100 text-blue-600' : b.location === 'freeboard' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'}`}>
                            {b.location === 'sns' ? 'SNS활성화' : b.location === 'freeboard' ? '자유게시판' : '전체'}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-500 font-bold truncate">{b.linkUrl}</p>
                        <p className="text-[11px] text-gray-400 font-bold">{b.startDate} ~ {b.endDate}</p>
                        {b.memo && <p className="text-[11px] text-gray-400 italic">{b.memo}</p>}
                      </div>
                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button onClick={() => { setBannerForm({...b}); setEditingBannerId(b.id); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[12px] hover:bg-blue-100 transition-all">수정</button>
                        <button onClick={() => handleDeleteBanner(b.id)} className="px-4 py-2 bg-red-50 text-red-500 rounded-xl font-black text-[12px] hover:bg-red-100 transition-all">삭제</button>
                        <button onClick={async () => { const updated = {...b, isActive: !b.isActive}; await upsertBannerAd(updated); setBannerAds(prev => prev.map(x => x.id === b.id ? updated : x)); }} className={`px-4 py-2 rounded-xl font-black text-[12px] transition-all ${b.isActive ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>{b.isActive ? '비활성화' : '활성화'}</button>
                        <button onClick={async () => {
                          const newStart = new Date(b.endDate);
                          newStart.setDate(newStart.getDate() + 1);
                          const newEnd = new Date(newStart);
                          newEnd.setDate(newEnd.getDate() + 29);
                          const fmt = (d: Date) => d.toISOString().slice(0, 10);
                          const updated = { ...b, startDate: fmt(newStart), endDate: fmt(newEnd), isActive: true };
                          await upsertBannerAd(updated);
                          setBannerAds(prev => prev.map(x => x.id === b.id ? updated : x));
                        }} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[12px] hover:bg-emerald-100 transition-all">재연장</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'order' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                 <div className="relative">
                    <input 
                       type="text" 
                       value={orderSearch}
                       onChange={e => setOrderSearch(e.target.value)}
                       placeholder="주문번호, 닉네임, 상품명..." 
                       className="w-full pl-10 pr-4 py-4 bg-gray-50 border-none rounded-full font-bold text-sm shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
                 </div>
                 
                 <select value={orderMonthFilter} onChange={e => setOrderMonthFilter(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 기간</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                 </select>

                 <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 플랫폼</option>{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                 </select>

                 <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 상태</option><option>준비중</option><option>진행중</option><option>작업완료</option>
                 </select>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleCheckOrderStatuses}
                  disabled={isCheckingStatus}
                  className="px-5 py-4 bg-blue-600 text-white rounded-full font-black text-[12px] hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCheckingStatus ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>조회중</> : '🔄 공급처 상태 조회'}
                </button>
                <button onClick={() => { setOrderSearch(''); setFilterPlatform('전체 플랫폼'); setOrderStatusFilter('전체 상태'); setOrderMonthFilter('전체 기간'); }} className="px-5 py-4 bg-gray-100 text-gray-400 rounded-full font-black text-[11px] hover:bg-gray-200 transition-all uppercase italic">Reset</button>
              </div>
           </div>

           <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left" style={{minWidth: '1200px'}}>
                    <thead className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest italic">
                       <tr>
                          <th className="px-6 py-5 whitespace-nowrap">일시 / 주문ID</th>
                          <th className="px-6 py-5 whitespace-nowrap">구매자</th>
                          <th className="px-6 py-5 whitespace-nowrap">구매 상품</th>
                          <th className="px-6 py-5 whitespace-nowrap">작업 링크</th>
                          <th className="px-6 py-5 text-center whitespace-nowrap">주문량</th>
                          <th className="px-6 py-5 text-right whitespace-nowrap">포인트 / 수익</th>
                          <th className="px-6 py-5 text-center whitespace-nowrap" style={{minWidth:'200px'}}>상태</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredOrders.length === 0 ? (
                         <tr><td colSpan={7} className="py-40 text-center text-gray-300 font-black italic text-lg">기록된 주문 데이터가 없습니다.</td></tr>
                       ) : filteredOrders.map(o => (
                         <tr key={o.id} className="hover:bg-blue-50/20 transition-all group">
                            <td className="px-6 py-6">
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-[12px] font-black text-gray-800 whitespace-nowrap">{o.orderTime}</span>
                                 <span className="text-[10px] text-blue-500 font-bold whitespace-nowrap">#{o.id}</span>
                               </div>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                               <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center shrink-0">
                                     <img src={SNS_PLATFORMS.find(p => p.name === o.platform)?.icon} className="w-4 h-4 object-contain" alt="p" />
                                  </div>
                                  <span className="text-[13px] font-black text-gray-900">{o.userNickname}</span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">@{o.userId}</span>
                               </div>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                               <span className="text-[13px] font-black text-gray-900">{o.productName}</span>
                               <span className="text-[10px] text-gray-400 font-bold ml-2 uppercase italic">{o.providerName}</span>
                            </td>
                            <td className="px-6 py-6 max-w-[160px]">
                               <div className="flex items-center gap-2">
                                  <a href={o.link.startsWith('http') ? o.link : `https://${o.link}`} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-400 hover:text-blue-600 underline truncate italic block max-w-[120px]">
                                     {o.link}
                                  </a>
                                  <button onClick={() => { navigator.clipboard.writeText(o.link); alert('링크가 복사되었습니다.'); }} className="p-1.5 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">📋</button>
                               </div>
                            </td>
                            <td className="px-6 py-6 text-center whitespace-nowrap">
                               <span className="text-[13px] font-black text-gray-900 italic">{o.quantity.toLocaleString()}</span>
                               <span className="text-[9.5px] font-bold text-gray-400 ml-2 uppercase">최초 {(japStatuses[o.id]?.startCount ?? o.initialCount ?? 0).toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-6 text-right whitespace-nowrap">
                               <span className="text-[15px] font-black text-gray-900 italic">{(o.sellingPrice * o.quantity).toLocaleString()}P</span>
                               <span className="text-[11px] font-black text-blue-500 ml-2">+{o.profit.toLocaleString()}</span>
                            </td>
                            <td className="px-8 py-6 text-center">
                               {(() => {
                                 const jap = japStatuses[o.id];
                                 const japDone = jap?.status === 'Completed' && o.status !== '작업완료';

                                 // 지연 감지
                                 const estimatedMins = getEstimatedMinsForOrder(o);
                                 const startMs = parseOrderTime(o.orderTime);
                                 const elapsedMins = startMs ? (Date.now() - startMs) / 60000 : null;
                                 const isDelayed = estimatedMins != null && elapsedMins != null && elapsedMins > estimatedMins && o.status !== '작업완료';

                                 // 공급처 사이트 URL (API URL에서 origin 추출)
                                 const provObj = smmProviders.find(p => p.name === o.providerName);
                                 const provSite = provObj?.apiUrl ? (() => { try { return new URL(provObj.apiUrl).origin; } catch { return '#'; } })() : '#';

                                 return (
                                   <div className="flex flex-col items-center gap-2">
                                     {/* 현재 주문 상태 뱃지 */}
                                     <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic shadow-sm ${
                                       o.status === '작업완료' ? 'bg-green-500 text-white' :
                                       o.status === '진행중' ? 'bg-blue-600 text-white animate-pulse' :
                                       'bg-gray-100 text-gray-400'
                                     }`}>{o.status}</span>

                                     {/* JAP 상태 표시 */}
                                     {jap && o.status !== '작업완료' && (
                                       <span className={`px-3 py-0.5 rounded-full text-[9px] font-black ${
                                         jap.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                         jap.status === 'In progress' ? 'bg-blue-50 text-blue-500' :
                                         jap.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                                         jap.status === 'Canceled' ? 'bg-red-100 text-red-600' :
                                         'bg-gray-100 text-gray-500'
                                       }`}>JAP: {jap.status}</span>
                                     )}

                                     {/* 지연 뱃지 */}
                                     {isDelayed && (
                                       <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-600 animate-pulse">
                                         ⚠️ 예상 시간 초과
                                       </span>
                                     )}

                                     {/* 공급처 완료 안내 + 작업완료 버튼 */}
                                     {japDone && (
                                       <div className="flex flex-col items-center gap-1.5 mt-1">
                                         <p className="text-[10px] font-black text-green-600 text-center leading-tight whitespace-nowrap">공급처 작업 완료</p>
                                         <button
                                           onClick={() => handleMarkComplete(o)}
                                           className="px-4 py-1.5 bg-green-500 text-white rounded-xl text-[11px] font-black hover:bg-green-600 transition-all shadow-md"
                                         >✅ 작업완료</button>
                                       </div>
                                     )}

                                     {/* 지연 시 공급처 문의 버튼 */}
                                     {isDelayed && (
                                       <a
                                         href={provSite}
                                         target="_blank"
                                         rel="noreferrer"
                                         className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-[10px] font-black hover:bg-orange-600 transition-all shadow-sm text-center whitespace-nowrap"
                                       >
                                         🎫 공급처 사이트에 문의
                                       </a>
                                     )}
                                   </div>
                                 );
                               })()}
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SnsAdmin;
