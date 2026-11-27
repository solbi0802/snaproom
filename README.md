# Snaproom

사진을 배치하고, 가리고, 꾸미는 브라우저 기반 사진 작업대.

## 현재 구현

사진 1~4장을 파일 선택이나 드롭으로 불러올 수 있습니다. 읽기가 끝난 사진을 썸네일 목록에 표시하고, 사진 교체·순서 변경·제거와 샘플 체험을 지원합니다. 손상된 파일이 섞여 있으면 열 수 있는 사진만 추가하고 오류를 안내합니다. 사진은 브라우저에서 처리합니다.

사진 수에 맞는 기본 배치와 3~4장용 첫 사진 강조 배치를 지원합니다. 배치 결과를 미리 보고 1000×1000 PNG로 저장할 수 있습니다.

## 실행

Node.js 22.13 이상(22.x) 또는 24 이상을 사용합니다. TypeScript는 ESLint 도구의 지원 범위에 맞춰 6.0 계열로 고정했습니다.

```sh
npm ci
npm run dev
```

터미널에 표시된 로컬 주소에서 실행합니다. 선택한 파일은 브라우저 메모리에서만 유지하며 새로고침하면 사라집니다.

## 검사

UI 작업 기준은 [디자인 시스템](docs/design-system.md)에 정리되어 있습니다. 색상·글꼴·간격은 `src/shared/styles/tokens.css`, 공통 컨트롤은 `src/shared/ui/`를 사용합니다. `npm run check`에 색상 토큰·공통 버튼 사용 검사도 포함되어 있습니다.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

- `check`: TypeScript 검사, ESLint, Vitest, 프로덕션 빌드.
- `test:e2e`: 데스크톱·모바일 크기의 Chromium에서 기본 화면과 사진 선택 흐름 검사.
- GitHub Actions도 동일한 검사를 실행하도록 설정했습니다. 원격에서의 실행 결과는 push 후 확인해야 합니다.

## 배포

Vercel의 Vite 설정을 사용하며 빌드 명령은 `npm run build`, 출력 폴더는 `dist`입니다. `vercel.json`에 명시했습니다. 최초 Vercel 배포는 사용자가 직접 완료했습니다. 이후 로컬 변경은 다음 배포에 반영합니다.

Vercel에서 이 GitHub 저장소를 Import하거나, 인증된 CLI에서 다음 명령을 사용합니다.

```sh
npx vercel
```

실제 배포 URL은 배포 성공 후 추가합니다.

## 코드 구조

```text
src/
  app/                 화면과 전역 스타일
  features/upload/     파일 제한 검사
public/samples/        직접 작성한 샘플 일러스트
e2e/                   브라우저 사용자 흐름 테스트
```

이미지 자산, 편집 문서, UI 상태를 분리하는 방향으로 확장합니다. 레이아웃·좌표 계산은 UI 컴포넌트와 분리할 예정입니다.
