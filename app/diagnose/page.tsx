import DiagnoseClient from "./DiagnoseClient";

export const metadata = {
  title: "AI 가시성 진단 · Kitt AI",
  description: "사이트를 넣으면 AI 검색 노출 상태를 진단하고 채널별 행동전략을 제안합니다.",
};

export default function Page() {
  return <DiagnoseClient />;
}
