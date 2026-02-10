
import { GoogleGenAI } from "@google/genai";

/**
 * [보안 가이드]
 * 1. API 키는 절대로 코드에 직접 입력(Hardcoding)하지 않습니다.
 * 2. Netlify 대시보드 > Site settings > Environment variables에 API_KEY 또는 GEMINI_API_KEY를 등록하세요.
 */

export const getMarketingConsultation = async (prompt: string): Promise<string> => {
  try {
    // API key MUST be obtained exclusively from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "당신은 전문 SMM 마케팅 컨설턴트입니다. 사용자에게 안전하고 효율적인 SNS 성장 전략을 제시하세요.",
        temperature: 0.7,
      }
    });

    return response.text || '답변을 가져오지 못했습니다.';
  } catch (error: any) {
    console.error("Gemini API 호출 에러:", error);
    
    if (process.env.API_KEY && error?.message?.includes(process.env.API_KEY)) {
      return '보안상의 이유로 요청이 거부되었습니다.';
    }
    
    return '현재 AI 상담이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
  }
};
