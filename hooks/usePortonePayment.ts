import { useCallback } from 'react';
declare const window: any;
const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string;
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string;
export interface PaymentParams {
  /** 결제 주문명 */
  orderName: string;
  /** 결제 금액 (원) */
  totalAmount: number;
  /** 상품 ID (orders 테이블 product_id) */
  productId: string;
  /** 상품명 */
  productName: string;
  /** 구매자 user ID */
  userId: string;
  /** 구매자 닉네임 */
  userNickname: string;
  /** 구매자 이메일 */
  userEmail?: string;
  /** 구매자 휴대폰 번호 (휴대폰 결제 시 필수) */
  userPhone?: string;
  /** 결제 수단 (기본값: CARD) */
  payMethod?: 'CARD' | 'MOBILE';
  /** 판매자 닉네임 (스토어 상품인 경우) */
  sellerNickname?: string;
  /** 티어명 (스토어 상품인 경우) */
  tierName?: string;
  /** 스토어 타입 */
  storeType?: string;
}
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  error?: string;
  paymentMethod?: string;
  paymentLog?: string;
  receiptUrl?: string;
}
export function usePortonePayment() {
  const requestPayment = useCallback(async (params: PaymentParams): Promise<PaymentResult> => {
    if (!STORE_ID || !CHANNEL_KEY) {
      console.error('[PortOne] 환경변수 VITE_PORTONE_STORE_ID, VITE_PORTONE_CHANNEL_KEY를 확인하세요.');
      return { success: false, error: '결제 설정이 올바르지 않습니다.' };
    }
    const { PortOne } = window;
    if (!PortOne) {
      return { success: false, error: '결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.' };
    }
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const paymentId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buyerEmail = params.userEmail || `user_${params.userId.slice(0, 8)}@bestsns.com`;
    try {
      const response = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId,
        orderName: params.orderName,
        totalAmount: params.totalAmount,
        currency: 'CURRENCY_KRW',
        payMethod: isMobile ? 'MOBILE' : 'CARD',
        customer: {
          fullName: params.userNickname,
          email: buyerEmail,
          phoneNumber: params.userPhone || '01000000000',
        },
      });
      if (!response) {
        return { success: false, error: '결제창이 닫혔습니다.' };
      }
      if ('code' in response) {
        const errMsg = response.message ?? '결제에 실패했습니다.';
        console.error('[PortOne] 결제 실패:', response.code, errMsg);
        return { success: false, paymentId, error: errMsg };
      }
      const receiptUrl = (response as any).receiptUrl ?? (response as any).receipt_url;
      return {
        success: true,
        paymentId: response.paymentId,
        paymentMethod: isMobile ? 'MOBILE' : 'CARD',
        paymentLog: JSON.stringify(response),
        receiptUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('[PortOne] 결제 요청 오류:', message);
      return { success: false, error: message };
    }
  }, []);
  return { requestPayment };
}
