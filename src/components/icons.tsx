// 참고 이미지(파스텔 카드 + 검은 선 아이콘) 방향에 맞춘 아이콘 세트.
// 카테고리/항목은 부모가 자유롭게 만드는 콘텐츠라 여기 넣지 않는다 — 그건 여전히
// 부모가 고른 실제 emoji를 그대로 쓴다(자유 이모지 피커, /settings/categories). 이 세트는
// 앱 자체의 고정 UI(로그인 역할, 모드 전환, 하단 네비, 대시보드 카드)에만 쓰는 아이콘.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChildIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="7.5" r="3.6" />
      <path d="M5.5 20c0-3.9 2.9-6.2 6.5-6.2s6.5 2.3 6.5 6.2" />
    </Base>
  );
}

export function ParentIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="7.5" r="4.2" />
      <path d="M4.5 20.5c0-4.3 3.3-7 7.5-7s7.5 2.7 7.5 7" />
    </Base>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10" />
    </Base>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 6l1.4-2h5.2L16 6h3a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7.5A1.5 1.5 0 0 1 5 6z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </Base>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
    </Base>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </Base>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5M17.8 17.8l-1.5-1.5M7.7 7.7L6.2 6.2" />
    </Base>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 20V11M12 20V4M19 20v-7" />
    </Base>
  );
}

export function MagnifierIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5l-4.3-4.3" />
    </Base>
  );
}

export function RouletteIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 5.6l2.6 1.9-1 3-3.2 0-1-3z" />
      <path d="M12 12l3.6-0.6M12 12l-1.8 3.4M12 12l-2.6-2.2" />
    </Base>
  );
}

export function TurnIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5M19.5 12a7.5 7.5 0 0 1-12.6 5.5" />
      <path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4" />
    </Base>
  );
}

export function BothIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 12l2.3 2.3L16 8.5" />
      <circle cx="12" cy="12" r="8.4" />
    </Base>
  );
}

export function HandIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 12.5V5.8a1.4 1.4 0 0 1 2.8 0v5.2" />
      <path d="M11.8 11V4.6a1.4 1.4 0 0 1 2.8 0V11" />
      <path d="M14.6 11.2V6.4a1.4 1.4 0 0 1 2.8 0v8.6c0 3-2.2 5.5-5.5 5.5h-1c-2 0-3-0.6-4.2-2l-2.8-3.3a1.3 1.3 0 0 1 1.9-1.7l1.8 1.6" />
    </Base>
  );
}
