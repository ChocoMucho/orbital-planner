# 클라우드 저장과 Google 로그인 설정

Orbital Planner는 Supabase Auth와 Postgres를 사용합니다. 웹과 Windows 앱이 같은 프로젝트를 바라보면 한 계정으로 같은 생산 계획을 불러올 수 있습니다.

## 1. Supabase 프로젝트

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/migrations/202608150001_create_plans.sql`을 실행합니다.
3. Project Settings의 API 화면에서 Project URL과 publishable key를 확인합니다.
4. `.env.example`을 `.env.local`로 복사하고 두 값을 입력합니다.

```dotenv
VITE_SUPABASE_URL=https://프로젝트-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`service_role` 키는 앱이나 Git에 절대 넣지 않습니다. 브라우저와 Windows 앱에는 공개 키만 들어가며, 데이터 보호는 migration에 포함된 Row Level Security 정책이 담당합니다.

## 2. Google OAuth

1. Google Cloud Console에서 OAuth 2.0 Web client를 만듭니다.
2. Google client의 Authorized redirect URI에 아래 Supabase 콜백을 등록합니다.

```text
https://프로젝트-ref.supabase.co/auth/v1/callback
```

3. Supabase Authentication > Providers > Google에 Google client ID와 secret을 입력합니다.
4. Supabase Authentication > URL Configuration의 Redirect URLs에 사용하는 주소를 등록합니다.

```text
http://localhost:3000/**
http://localhost:1420/**
https://orbital-planner-dsp.vkclssha14.chatgpt.site/**
orbital-planner://auth/callback
```

웹 주소가 바뀌면 새 주소도 추가합니다. Windows 로그인은 시스템 브라우저를 열고 `orbital-planner://auth/callback`으로 앱에 돌아옵니다.

## 3. 동작 확인

1. `pnpm dev`로 웹을 열고 Google 로그인 후 계획을 저장합니다.
2. Supabase Table Editor의 `plans` 테이블에서 저장된 행을 확인합니다.
3. 로그아웃하거나 다른 계정으로 로그인했을 때 다른 사용자의 계획이 보이지 않는지 확인합니다.
4. Windows 앱에서도 같은 계정으로 로그인해 같은 계획이 나타나는지 확인합니다.

오프라인 저장은 로컬 캐시를 사용하고 다음 온라인 실행 때 동기화를 재시도합니다. 로컬 캐시는 편의를 위한 사본이며, 클라우드 데이터가 최종 저장본입니다.
