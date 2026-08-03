interface Props {
  nickname: string;
  color: string;
  size?: number;
}

/** 닉네임 첫 글자 + 파스텔 배경색 아바타 */
export default function Avatar({ nickname, color, size = 32 }: Props) {
  return (
    <span
      style={{ background: color, width: size, height: size, fontSize: size * 0.45 }}
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none"
    >
      {nickname.slice(0, 1)}
    </span>
  );
}
