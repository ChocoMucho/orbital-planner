<p align="center">
  <img src="public/og.png" alt="오비탈 플래너 표지" width="100%" />
</p>

<h1 align="center">오비탈 플래너</h1>

<p align="center">
  Dyson Sphere Program의 여러 생산 목표를 하나의 공장 계획으로 계산하는 한국어 생산 계산기
</p>

<p align="center">
  <a href="https://orbital-planner-dsp.vkclssha14.chatgpt.site"><strong>웹에서 바로 사용하기</strong></a>
  ·
  <a href="https://github.com/ChocoMucho/orbital-planner/releases/latest"><strong>Windows 설치 파일 다운로드</strong></a>
</p>

> 현재 계산 기능은 로그인 없이 사용할 수 있습니다. Google 로그인과 클라우드 저장은 연결 준비 중입니다.

## 어떤 프로그램인가요?

목표 물품을 여러 개 선택하고 각각의 생산량을 `/분` 또는 `/초`로 입력하면, 서로 겹치는 중간재를 합산해 필요한 생산 설비와 원료를 역산합니다.

- 여러 아이템·건물의 생산 목표를 한 번에 계산
- 공통 중간재를 합산한 뒤 실제 배치할 설비 수를 계산
- 설비 세대, 증산제, 벨트, 희귀 자원 레시피 설정
- 필요한 설비, 전력, 외부 원료, 부산물, 벨트 수량 표시
- 설비 이름과 처리량이 포함된 생산 트리
- 원료 → 생산 설비 → 목표 흐름을 보여주는 생산 네트워크 지도
- 아이템·건물 이미지, 반응형 화면, 글자 크기 설정
- 같은 코드로 동작하는 웹 버전과 Windows 앱

현재 DSP `0.10.34` 기준으로 86개 생산 아이템, 61개 건물, 156개 레시피를 계산할 수 있습니다.

## Windows에 설치하기

1. [최신 Releases 페이지](https://github.com/ChocoMucho/orbital-planner/releases/latest)를 엽니다.
2. `Orbital Planner_0.1.0_x64-setup.exe`를 내려받습니다.
3. 내려받은 파일을 실행해 설치합니다.

Windows 10/11 64비트용입니다. 처음 설치할 때 PC에 WebView2가 없다면 인터넷 연결이 필요할 수 있습니다. 아직 코드 서명을 적용하지 않았기 때문에 Windows SmartScreen이 표시되면 `추가 정보 → 실행`을 선택해야 할 수 있습니다.

## 웹에서 사용하기

[공개 웹 버전](https://orbital-planner-dsp.vkclssha14.chatgpt.site)은 휴대폰과 PC 브라우저에서 설치 없이 사용할 수 있습니다. Windows 앱과 같은 계산 코드와 데이터를 사용합니다.

## 현재 개발 상태

- [x] 다중 생산 목표 계산
- [x] 아이템 계산기와 건물 계산기
- [x] 실제 아이템·건물 이미지
- [x] 생산 트리와 생산 네트워크 지도
- [x] 창 크기별 반응형 화면과 글자 크기 설정
- [x] Windows 설치 파일
- [x] 공개 웹 버전
- [ ] Supabase와 Google 로그인 최종 연결
- [ ] 사용자별 생산 계획 클라우드 저장 활성화
- [ ] 저장 개수 제한과 비정상 요청 방어

<details>
<summary><strong>개발 및 빌드 안내</strong></summary>

### 필요 환경

- Node.js 22.13 이상
- pnpm 11
- Windows 앱 빌드 시 Rust stable MSVC, Visual Studio Build Tools, WebView2

### 웹 개발 서버

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Supabase 설정 없이도 계산기는 실행됩니다. Google 로그인과 저장 기능을 연결하려면 [클라우드 설정 안내](docs/cloud-setup.md)에 따라 `.env.local`을 설정하고 `supabase/migrations/202608150001_create_plans.sql`을 적용하세요. `service_role` 키는 클라이언트 환경 파일에 넣으면 안 됩니다.

### Windows 앱

```powershell
pnpm tauri:dev
pnpm tauri:build
```

NSIS 설치 파일은 `apps/desktop/src-tauri/target/release/bundle/nsis/`에 생성됩니다. 릴리스 앱은 실행할 때 별도 터미널 창을 띄우지 않습니다.

### 검사

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

### 주요 코드

- `app/CalculatorApp.tsx`: 웹·Windows 공용 화면
- `app/lib/calculate.ts`: 다중 목표 생산량 계산 엔진
- `app/lib/production-flow-graph.ts`: 생산 네트워크 데이터 생성
- `app/lib/dsp-data.ts`: 아이템·레시피·설비 데이터
- `app/lib/plan-repository.ts`: 저장 및 오프라인 동기화
- `apps/desktop/`: Tauri Windows 앱
- `supabase/migrations/`: 사용자별 클라우드 저장 스키마

</details>

## 안내

오비탈 플래너는 Dyson Sphere Program의 비공식 팬 제작 도구이며, 게임 개발사와 공식적인 관련이 없습니다.
