# Orbital Planner

다이슨 스피어 프로그램 전용 다중 생산 목표 계산기입니다. 하나의 React 계산기 코드를 웹과 Windows 앱(Tauri 2)에서 함께 사용하며, Supabase Google 로그인과 사용자별 클라우드 저장을 연결할 수 있습니다.

## 현재 구성

- 여러 생산 물품과 각각의 분당·초당 목표량 계산
- 공통 중간재를 합산한 설비, 전력, 원자재, 부산물 계산
- 브라우저와 Windows 앱이 공유하는 화면·계산 코드
- Google 로그인 후 사용자별 생산 계획 저장
- 연결이 끊겼을 때 로컬 캐시와 재연결 시 동기화 대기열
- Supabase Row Level Security로 본인의 계획만 접근

## 개발 실행

필수 환경은 Node.js 22.13 이상과 pnpm 11입니다.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

클라우드 설정이 없는 동안에도 계산기는 개발용으로 실행됩니다. `.env.local`에 Supabase 공개 설정을 넣으면 Google 로그인이 필수가 되고 저장 기능이 활성화됩니다. 서비스 역할 키는 클라이언트 환경 파일에 넣지 마세요.

```powershell
pnpm desktop:dev
pnpm typecheck
pnpm lint
pnpm test
```

## Windows 앱

실제 설치 파일 생성에는 Rust stable MSVC, Visual Studio Build Tools의 `Desktop development with C++`, WebView2가 필요합니다.

```powershell
pnpm tauri:dev
pnpm tauri:build
```

NSIS 설치 파일은 `apps/desktop/src-tauri/target/release/bundle/nsis/`에 생성됩니다.

## 클라우드 설정

[클라우드 및 Google 로그인 설정](docs/cloud-setup.md)을 따라 Supabase 프로젝트를 연결하고 `supabase/migrations/202608150001_create_plans.sql`을 적용하세요.

## 주요 경로

- `app/CalculatorApp.tsx`: 웹·Windows 공용 계산기 화면
- `app/lib/calculate.ts`: 생산량 계산 엔진
- `app/lib/cloud-session.tsx`: 로그인 세션
- `app/lib/plan-repository.ts`: 저장·오프라인 동기화
- `apps/desktop/`: Tauri Windows 앱 진입점
- `supabase/migrations/`: 사용자별 클라우드 저장 스키마

## 웹 배포

웹 버전은 기존 Sites 설정을 유지합니다. Windows 앱과 웹은 동일한 Supabase 프로젝트를 사용하면 같은 계정과 생산 계획을 공유합니다. 배포는 별도 요청 시 수행합니다.
