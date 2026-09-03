// 카테고리/항목처럼 부모가 자유롭게 추가하는 콘텐츠는 색을 의미별로 고정할 수 없어서
// (커스텀 카테고리가 몇 개든, 이름이 뭐든) 인덱스 기준으로 5색 파스텔 팔레트를 순환 배정한다.
// 클래스 정의는 src/app/globals.css의 .tile-0 ~ .tile-4.
const TILE_CLASSES = ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4"];

export function tileClassFor(index: number) {
  return TILE_CLASSES[index % TILE_CLASSES.length];
}
