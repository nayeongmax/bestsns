
import { GoogleGenAI } from "@google/genai";

export const getMarketingConsultation = async (prompt: string): Promise<string> => {
  // Always use a named parameter for the API key and ensure it's from process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `당신은 대한민국 최고의 SNS 마케팅 컨설턴트 'THEBEST AI'입니다. 
        사용자들의 질문에 친절하고 전문적으로 답해줍니다. 
        인스타그램 릴스 조회수 늘리는 법, 유튜브 채널 성장 전략, 틱톡 바이럴 마케팅, 효과적인 광고 카피 등 마케팅 전반에 대해 가이드해 주세요.`,
        temperature: 0.7,
      }
    });
    // Property .text returns the extracted string output.
    return response.text || '죄송합니다. 답변을 생성하는 중 오류가 발생했습니다.';
  } catch (error) {
    console.error("Gemini API Error:", error);
    return '현재 상담이 불가능합니다. 나중에 다시 시도해 주세요.';
  }
};
