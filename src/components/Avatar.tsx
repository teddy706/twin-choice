// 프로필 사진(avatar_photo_path)이 있으면 그 사진을, 없으면 이모지를 보여준다.
// 어디서 아바타를 그리든 이 컴포넌트로 통일해서 사진/이모지 폴백 로직이 흩어지지 않게 한다.
export function Avatar({
  url,
  emoji,
  size = 28,
  className = "",
}: {
  url?: string | null;
  emoji: string;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className={`inline-block shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1 }} className={`inline-block shrink-0 ${className}`}>
      {emoji}
    </span>
  );
}
