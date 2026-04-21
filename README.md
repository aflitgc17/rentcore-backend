# RentCore Backend

RentCore Server는 선문대학교 영화영상학과를 위한 기자재 대여 및 시설 예약 서비스의 백엔드 API 서버입니다.  
사용자 인증, 장비 및 시설 데이터 관리, 대여 요청 및 예약 처리, 관리자 승인/반려, 알림 제공, 신청서 PDF 생성까지 서비스 운영에 필요한 핵심 기능을 담당합니다.

이 저장소는 Express 기반 API 서버로 작성되어 있으며, Prisma를 통해 PostgreSQL 데이터베이스와 연동됩니다. 프론트엔드 클라이언트와는 HTTP API로 통신하며, 인증은 JWT와 쿠키 기반으로 처리됩니다.

## Table of Contents

- [Overview](#overview)
- [Who This Project Is For](#who-this-project-is-for)
- [Core Responsibilities](#core-responsibilities)
- [Key Features](#key-features)
- [Business Rules Reflected in the API](#business-rules-reflected-in-the-api)
- [Detailed Logic Flows](#detailed-logic-flows)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Authentication and Authorization](#authentication-and-authorization)
- [Document Generation](#document-generation)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Development Notes](#development-notes)
- [Recommended Verification Checklist](#recommended-verification-checklist)
- [License](#license)

## Overview

이 서버는 학과 내 장비 대여와 시설 예약 업무를 웹 환경에서 처리하기 위해 만들어졌습니다.  
코드 기준으로 확인되는 핵심 역할은 다음과 같습니다.

- 사용자 회원가입, 로그인, 로그아웃, 현재 사용자 조회 처리
- 일반 사용자와 관리자 권한을 구분하여 API 접근 제어
- 장비 목록 조회, 예약 가능 여부 확인, 대여 요청 및 예약 관리
- 편집실 및 녹음실 등 시설 예약 신청, 승인, 반려 처리
- 사용자별 신청 현황 및 알림 조회
- 관리자용 요청 집계, 승인 대기 건수 조회, 운영 데이터 제공
- 장비 대여 신청서 및 시설 이용 신청서 PDF 생성
- Prisma 스키마를 기반으로 사용자, 장비, 예약, 요청, 알림 데이터를 일관되게 관리

서버는 `health` 체크 엔드포인트를 제공하며, 프론트엔드와의 연동을 고려한 CORS 및 쿠키 설정이 포함되어 있습니다. 허용 오리진에는 로컬 개발 환경과 운영 프론트엔드 도메인이 함께 반영되어 있습니다.

## Who This Project Is For

이 프로젝트는 다음과 같은 사용자를 대상으로 합니다.

- 학과 학생: 장비 대여 요청, 시설 예약, 내 신청 현황 확인
- 교수 및 일반 사용자: 학생과 유사한 흐름으로 계정 생성 및 서비스 이용
- 학과 관리자: 요청 승인/반려, 장비 운영, 시설 예약 운영, 알림 관리
- 개발자 및 운영자: 프론트엔드와 연동되는 백엔드 API를 유지보수하는 담당자

## Core Responsibilities

이 서버는 단순 CRUD 서버가 아니라, 실제 운영 업무 흐름을 반영하는 애플리케이션 서버입니다.

### 1. 인증과 사용자 관리

- 일반 사용자 회원가입
- 관리자 전용 회원가입
- 이메일/비밀번호 로그인
- JWT 발급 및 쿠키 저장
- 로그인 사용자 정보 조회
- 로그아웃 처리
- 사용자 프로필 조회

### 2. 장비 대여 운영

- 장비 목록 조회 및 단건 조회
- 장비별 예약 현황 확인
- 장비 대여 요청 접수
- 승인된 예약 및 대기 중 요청과의 충돌 검사
- 관리자 수동 예약 생성
- 예약 수정 및 운영 캘린더 데이터 조회
- 장비별 신청서 PDF 출력

### 3. 시설 예약 운영

- 시설 목록 조회
- 시설 예약 신청 접수
- 시간대 중복 검사
- 관리자 승인/반려 처리
- 사용자별 시설 예약 조회
- 승인된 시설 이용 신청서 PDF 출력

### 4. 운영 및 관리자 지원

- 관리자용 장비 대여 요청 조회
- 관리자용 장비/시설 통합 요청 목록 조회
- 승인 대기 건수 집계
- 사용자별 알림 생성 및 읽음 처리
- 사용자별 신청/예약/대여 현황 조회
- 운영 화면 레이아웃용 사용자/대기 건수 데이터 제공

## Key Features

### 사용자 기능

- 회원가입 및 로그인
- JWT + 쿠키 기반 인증
- 내 프로필 조회
- 장비 목록 및 예약 상태 조회
- 장비 대여 신청 및 예약 충돌 확인
- 시설 예약 신청 및 시간 충돌 확인
- 내 대여 현황, 대여 요청, 시설 예약 내역 조회
- 알림 목록 및 읽지 않은 알림 수 확인
- 장비 및 시설 신청서 PDF 다운로드

### 관리자 기능

- 관리자 전용 계정 생성
- 장비 대여 요청 조회, 승인, 반려
- 시설 예약 요청 조회, 승인, 반려
- 승인 대기 개수 조회
- 통합 요청 목록 조회
- 관리자 수동 예약 생성 및 수정
- 운영용 캘린더 데이터 조회
- 관리자 레이아웃용 사용자 정보 및 대기 건수 제공

## Business Rules Reflected in the API

코드상에서 확인되는 주요 업무 규칙은 다음과 같습니다.

### 인증 규칙

- 보호된 API는 로그인 토큰이 필요합니다.
- 토큰은 우선 쿠키에서 읽고, 필요 시 `Authorization: Bearer ...` 헤더도 지원합니다.
- 관리자 전용 기능은 `role === "ADMIN"` 인 사용자만 접근할 수 있습니다.

### 장비 대여 규칙

- 장비 대여 요청은 과목명과 사용 목적이 필수입니다.
- 장비 대여 요청 전 충돌 검사 API를 통해 이미 승인된 예약과 승인 대기 중인 요청을 함께 확인합니다.
- 장비 예약은 `APPROVED` 또는 `PENDING` 상태의 기존 예약과 충돌하면 생성하거나 수정할 수 없습니다.
- 하나의 대여 요청에는 여러 장비를 포함할 수 있으며, 요청 승인 시 하나의 `Reservation` 과 여러 `ReservationItem` 으로 변환됩니다.
- 승인 처리 시에도 다시 한 번 충돌 여부를 검사해, 이미 다른 승인 예약과 겹치는 장비는 승인되지 않도록 합니다.
- 승인된 예약 기준으로 특정 날짜의 사용 중 장비 목록을 조회할 수 있습니다.
- 장비 출력 문서는 예약 데이터를 기준으로 PDF로 생성됩니다.

### 시설 예약 규칙

- 시설 예약은 시작 시각과 종료 시각을 기준으로 시간대 중복을 검사합니다.
- 중복 검사는 `REQUESTED` 와 `APPROVED` 상태 모두를 대상으로 수행됩니다.
- 관리자 승인 시에는 이미 승인된 예약과 다시 충돌 여부를 확인합니다.
- 시설 예약에는 과목명, 사용 목적, 인원 수, 팀원 정보, 선택 컴퓨터 정보가 포함될 수 있습니다.
- 팀원 정보가 존재할 경우 이름, 학과, 학번 형식을 검사합니다.
- 승인된 시설 예약만 출력용 PDF를 생성할 수 있습니다.

### 알림 규칙

- 장비 대여 요청 승인/반려 시 사용자 알림이 생성됩니다.
- 시설 예약 승인/반려 시 사용자 알림이 생성됩니다.
- 사용자는 자신의 알림 목록과 읽지 않은 개수를 조회할 수 있습니다.
- 읽지 않은 알림은 일괄 읽음 처리할 수 있습니다.

## Detailed Logic Flows

이 섹션은 단순 기능 소개를 넘어서, 실제 코드에서 어떤 흐름으로 데이터가 처리되는지 설명합니다.

### 1. 로그인 및 인증 처리 흐름

1. 사용자가 `/auth/login` 으로 이메일과 비밀번호를 전송합니다.
2. 서버는 이메일로 사용자를 조회한 뒤 `bcrypt.compare` 로 비밀번호를 검증합니다.
3. 인증에 성공하면 `userId`, `role` 정보를 담은 JWT를 생성합니다.
4. 생성된 토큰은 `httpOnly` 쿠키 `token` 에 저장됩니다.
5. 이후 보호된 API 요청에서는 `authMiddleware` 가 먼저 쿠키의 `token` 을 확인합니다.
6. 쿠키가 없을 경우에는 `Authorization` 헤더의 Bearer 토큰을 대체 수단으로 허용합니다.
7. 토큰 검증에 성공하면 `req.user` 에 `{ userId, role }` 값을 주입하고 다음 미들웨어 또는 라우트로 진행합니다.

### 2. 장비 대여 요청에서 실제 예약으로 전환되는 흐름

이 프로젝트에서 `RentalRequest` 와 `Reservation` 은 역할이 다릅니다.

- `RentalRequest`
  사용자가 제출한 대여 신청 자체를 의미합니다.
- `Reservation`
  관리자 승인 후 운영상 확정된 실제 예약 데이터를 의미합니다.

전체 흐름은 다음과 같습니다.

1. 사용자가 `/rental-requests` 로 대여 신청을 제출합니다.
2. 서버는 신청자 ID, 대여 기간, 과목명, 사용 목적, 장비 목록을 바탕으로 `RentalRequest` 와 `RentalItem` 을 생성합니다.
3. 요청 상태는 처음에 `REQUESTED` 로 저장됩니다.
4. 관리자가 `/rental-requests/:id/approve` 를 호출하면, 서버는 트랜잭션 내부에서 해당 요청을 조회합니다.
5. 서버는 요청된 모든 장비에 대해 기존 승인 예약과 시간이 겹치는지 다시 검사합니다.
6. 충돌이 없으면 `RentalRequest.status` 를 `APPROVED` 로 변경합니다.
7. 이어서 실제 운영 예약용 `Reservation` 을 1건 생성합니다.
8. 요청된 각 장비는 `ReservationItem` 으로 연결되어 하나의 예약 아래 묶입니다.
9. 승인 완료 후 사용자에게 알림이 생성됩니다.

즉, 사용자 신청 데이터와 실제 예약 데이터가 분리되어 있어, 승인 이전 요청과 승인 이후 운영 데이터를 구분해 관리할 수 있습니다.

### 3. 장비 충돌 검사 로직

장비 충돌 검사는 두 군데에서 중요하게 사용됩니다.

- 사용자가 대여 신청을 넣기 전
- 관리자가 대여 요청을 승인하기 전

사전 충돌 검사에서는 다음 두 가지를 함께 확인합니다.

- 이미 `APPROVED` 상태인 실제 예약
- 아직 `REQUESTED` 상태인 다른 대여 요청

이를 통해 아직 승인되지 않았더라도 이미 다른 사용자가 신청한 장비와의 중복 가능성을 프론트엔드에서 미리 안내할 수 있습니다.

관리자 승인 시에는 다시 한 번 실제 승인 예약과의 충돌을 재검사합니다.  
이중 검사를 두는 이유는, 사용자가 신청한 이후 관리자 승인 전까지 다른 예약이 생길 수 있기 때문입니다.

### 4. 시설 예약 충돌 검사 로직

시설 예약은 장비 대여와 달리 날짜 단위가 아니라 시간대 단위로 관리됩니다.

1. 사용자가 시설명, 날짜, 시작 시간, 종료 시간을 제출합니다.
2. 서버는 이를 UTC 기준 시각으로 변환해 저장 및 비교합니다.
3. 충돌 검사 시 동일 시설에 대해 다음 조건을 확인합니다.
   - 기존 예약의 시작 시각이 새 예약 종료 시각보다 이른지
   - 기존 예약의 종료 시각이 새 예약 시작 시각보다 늦은지
4. 이 조건을 만족하면 시간이 겹치는 예약으로 판단합니다.
5. 이때 `REQUESTED` 와 `APPROVED` 상태 모두를 충돌 대상으로 간주합니다.
6. 관리자 승인 시에는 승인된 예약끼리 다시 충돌 검사를 수행합니다.

이 구조 덕분에 같은 시설에 대해 중복된 신청이나 승인 오류를 줄일 수 있습니다.

### 5. 시설 예약 시간대 처리 방식

시설 예약 라우트에는 KST 기준 입력값을 UTC로 보정하는 함수가 포함되어 있습니다.

- 프론트엔드는 사용자가 입력한 로컬 날짜와 시간을 전달합니다.
- 서버는 이를 한국 시간으로 해석한 뒤 UTC 기준 `Date` 객체로 변환합니다.
- DB 저장값은 UTC 기준이지만, 실제 의미는 한국 시간표 기준 운영 시간입니다.
- PDF 출력이나 화면 표시 시에는 다시 KST 기준으로 보정해 사람이 읽기 쉬운 형태로 사용합니다.

따라서 시간대 관련 로직을 변경할 경우, 입력 시점과 저장 시점, 출력 시점의 변환 규칙을 함께 확인해야 합니다.

### 6. 관리자 요청 집계 방식

관리자 화면에서는 장비 요청과 시설 요청을 따로 보는 API와 함께, 둘을 합쳐 보는 API도 존재합니다.

- 장비 대여 요청은 `RentalRequest`
- 시설 예약 요청은 `FacilityReservation`

통합 요청 API는 두 데이터를 각각 조회한 뒤, 공통 필드를 맞춰 하나의 배열로 합쳐 정렬해 반환합니다.  
이렇게 하면 프론트엔드 관리자 화면에서 요청 유형이 다르더라도 하나의 리스트처럼 다룰 수 있습니다.

### 7. 사용자 현황 조회 방식

`/my/status` 는 사용자의 단일 종류 데이터만 반환하지 않습니다.  
이 API는 다음 세 가지를 한 번에 반환합니다.

- 실제 장비 예약 내역 `reservations`
- 사용자가 제출한 장비 대여 요청 `rentalRequests`
- 사용자의 시설 예약 `facilities`

즉, 프론트엔드에서는 이 API 하나만으로 사용자의 전체 신청 및 예약 현황 화면을 구성할 수 있습니다.

### 8. PDF 생성 로직

PDF 출력은 단순 파일 다운로드가 아니라, 템플릿 PDF 위에 실제 데이터를 그려 넣는 방식으로 구현되어 있습니다.

- 장비 신청서는 `rentalForm.pdf`
- 시설 신청서는 `editingForm.pdf`, `recordingForm.pdf`

출력 시 처리 흐름은 다음과 같습니다.

1. 서버가 예약 데이터를 DB에서 조회합니다.
2. 템플릿 PDF 파일을 불러옵니다.
3. 한글 출력을 위해 Noto Sans KR 폰트를 임베드합니다.
4. 사용자 이름, 학과, 학번, 전화번호, 예약 시간, 장비 목록 등의 데이터를 PDF 좌표에 맞춰 그립니다.
5. 완성된 PDF 바이트를 응답으로 반환합니다.

시설 신청서의 경우 시설명이 녹음실인지 편집실인지에 따라 서로 다른 PDF 템플릿을 사용합니다.  
또한 승인된 예약만 출력 가능하도록 제한되어 있습니다.

## Architecture

이 프로젝트는 Express 기반 REST API 서버이며, Prisma ORM을 통해 PostgreSQL과 연결됩니다.

### 애플리케이션 구조

- `src/app.js` 에서 서버 초기화, 미들웨어 등록, 라우트 연결 수행
- 도메인별 라우트를 `src/routes` 하위에 분리
- 인증과 권한 검사는 `src/middleware/auth.js` 에서 처리
- PDF 출력에 필요한 템플릿과 폰트 파일을 `src/templates`, `src/fonts` 에서 관리

### 요청 처리 구조

- Express JSON 파서 사용
- `cookie-parser` 로 쿠키 기반 인증 처리
- CORS 설정에서 허용된 프론트엔드 오리진만 허용
- 일부 라우트는 `authMiddleware`, `adminOnly` 를 조합해 보호

### 데이터 접근 구조

- Prisma Client를 통해 DB 접근
- 사용자, 장비, 예약, 시설, 요청, 알림을 관계형 구조로 관리
- 예약과 요청의 장비 연결은 별도 아이템 테이블을 사용
- 상태값은 Prisma enum으로 명시

## Data Model

Prisma 스키마 기준으로 주요 엔티티는 다음과 같습니다.

### User

- 사용자 기본 정보
- 이메일, 비밀번호, 이름, 학과, 학번, 학년, 생년월일, 전화번호
- 역할: `USER`, `ADMIN`
- 시설 예약, 장비 예약, 대여 요청, 알림과 연결

### Equipment

- 장비명, 카테고리, 관리번호, 상태, 비고, 분류 정보
- 활성 여부와 정렬 순서 보유
- 대여 요청 및 예약 아이템과 연결

### Reservation

- 장비 대여 확정 및 운영용 예약 데이터
- 시작일, 종료일, 상태, 반려 사유, 과목명, 사용 목적 포함
- 여러 장비를 `ReservationItem` 으로 연결

### ReservationItem

- 하나의 예약과 하나의 장비를 연결하는 중간 테이블
- 예약 1건에 여러 장비를 연결하기 위해 사용

### RentalRequest

- 사용자가 제출한 장비 대여 신청 데이터
- 시작/종료 시점, 상태, 반려 사유, 과목명, 사용 목적 포함
- 여러 장비를 `RentalItem` 으로 연결

### RentalItem

- 하나의 대여 요청과 하나의 장비를 연결하는 중간 테이블
- 요청 단계에서 여러 장비를 묶어 관리하기 위해 사용

### FacilityReservation

- 시설 예약 데이터
- 시설, 시작/종료 시각, 과목명, 사용 목적, 상태, 반려 사유, 인원 수 포함
- 팀원 정보는 JSON으로 저장

### Facility

- 시설명 및 생성 시각
- 여러 시설 예약과 연결

### Notification

- 사용자별 알림 메시지
- 읽음 여부와 생성 시각 포함

## Tech Stack

- Node.js
- Express
- Prisma
- PostgreSQL
- JWT
- cookie-parser
- cors
- bcrypt
- pdf-lib
- fontkit
- xlsx
- dotenv

## Project Structure

```text
src/
  app.js                         서버 진입점 및 라우트 연결
  middleware/
    auth.js                      JWT 인증 및 관리자 권한 검사
  routes/
    auth.js                      회원가입, 로그인, 로그아웃, 현재 사용자
    admin.js                     관리자 요청 처리, 승인 대기 집계, 관리자 운영 API
    equipments.js                장비별 예약 조회
    facilities.js                시설 목록 조회
    facilityReservations.js      시설 예약 조회, 생성, 승인, 반려, PDF 출력
    my.js                        내 현황, 알림, 프로필 조회
    reservations.js              장비 예약 조회, 수동 생성, 수정, 충돌 검사, PDF 출력
    rentalRequests               장비 대여 요청 생성, 충돌 검사, 승인, 반려
  templates/
    rentalForm.pdf               장비 대여 신청서 템플릿
    editingForm.pdf              편집실 신청서 템플릿
    recordingForm.pdf            녹음실 신청서 템플릿
  fonts/
    Noto_Sans_KR/                PDF 출력용 한글 폰트
prisma/
  schema.prisma                  데이터 모델 정의
```

## API Routes

코드 기준으로 확인되는 주요 API 경로는 다음과 같습니다.

### Health Check

- `GET /health`
  서버 동작 여부 확인

### 인증 및 사용자

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /users`
- `POST /signup`

### 내 정보 및 알림

- `GET /my/status`
- `GET /my/notifications`
- `PATCH /my/notifications/read`
- `GET /my/profile`

### 장비

- `GET /equipments`
- `GET /equipments/:id`
- `POST /equipments`
- `GET /equipments/:id/reservations`

### 장비 대여 요청

- `POST /rental-requests`
- `GET /rental-requests`
- `POST /rental-requests/conflicts`
- `PATCH /rental-requests/:id/approve`
- `PATCH /rental-requests/:id/reject`

### 장비 예약 및 운영

- `GET /reservations/by-date`
- `POST /reservations/manual`
- `PUT /reservations/:id`
- `GET /reservations/calendar`
- `GET /reservations/conflicts`
- `GET /reservations/:id/print`

### 시설

- `GET /facilities`

### 시설 예약

- `GET /facility-reservations`
- `GET /facility-reservations/conflicts`
- `POST /facility-reservations`
- `PATCH /facility-reservations/:id/approve`
- `PATCH /facility-reservations/:id/reject`
- `GET /facility-reservations/my`
- `GET /facility-reservations/pending-count`
- `GET /facility-reservations/:id/print`

### 관리자 운영

- `GET /admin/ping`
- `GET /admin/rental-requests`
- `GET /admin/rental-requests/count`
- `GET /admin/users`
- `GET /admin/admin/requests`
- `GET /admin/facility-requests/count`
- `GET /admin/rental-requests/count`
- `PATCH /admin/rental-requests/:id/approve`
- `PATCH /admin/rental-requests/:id/reject`
- `PATCH /admin/facility-requests/:id/approve`
- `PATCH /admin/facility-requests/:id/reject`
- `GET /admin/notifications/unread-count`
- `GET /admin/layout-data`

### 참고 사항

- `admin.js` 내부 경로 중 일부는 관리자 라우터가 `/admin` 으로 마운트된 상태에서 다시 `/admin/...` 경로를 선언하고 있어, 실제 엔드포인트가 `GET /admin/admin/requests` 형태가 됩니다.
- 관리자용 장비 대여 요청 개수 관련 경로는 서로 다른 기준의 구현이 공존하므로, 프론트엔드에서 실제로 사용하는 API와 함께 정리해 두는 것이 좋습니다.
- 장비 대여 요청 관련 API와 장비 예약 운영 API는 역할이 다르며, 요청 승인 이후 실제 예약 데이터로 전환되는 구조입니다.

## Authentication and Authorization

이 서버는 JWT 기반 인증을 사용합니다.

### 동작 방식

- 로그인 성공 시 JWT를 생성합니다.
- 토큰은 `httpOnly` 쿠키에 저장됩니다.
- 인증 미들웨어는 먼저 쿠키의 `token` 을 확인합니다.
- 쿠키가 없으면 `Authorization` 헤더의 Bearer 토큰도 허용합니다.
- 보호된 API는 토큰 검증 실패 시 `401` 또는 `403` 응답을 반환합니다.

### 권한 분리

- 일반 인증: `authMiddleware`
- 관리자 전용: `authMiddleware + adminOnly`

## Document Generation

이 프로젝트에는 운영 문서 생성을 위한 PDF 출력 기능이 포함되어 있습니다.

### 장비 대여 신청서

- `GET /reservations/:id/print`
- 장비 대여 신청 정보를 바탕으로 PDF를 생성
- 사용자 정보, 장비 목록, 대여 기간 등을 템플릿에 채워 출력

### 시설 이용 신청서

- `GET /facility-reservations/:id/print`
- 시설 종류에 따라 편집실/녹음실 템플릿을 구분 사용
- 승인된 예약만 출력 가능
- 사용자 정보, 예약 시간, 시설 정보 등을 템플릿에 반영

### 출력 관련 특징

- `pdf-lib` 사용
- 한글 출력을 위해 Noto Sans KR 폰트 사용
- 템플릿 PDF 위에 데이터를 그리는 방식으로 구현

## Environment Variables

프로젝트 실행을 위해 최소한 아래 환경 변수가 필요합니다.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
JWT_SECRET=your_jwt_secret
ADMIN_SECRET_CODE=your_admin_signup_code
PORT=4000
```

### 참고 사항

- `DATABASE_URL` 은 Prisma가 PostgreSQL에 연결할 때 사용합니다.
- `JWT_SECRET` 은 로그인 토큰 서명 및 검증에 사용됩니다.
- `ADMIN_SECRET_CODE` 는 관리자 회원가입 시 검증값으로 사용됩니다.
- `.env` 파일을 통해 로컬 개발 환경 값을 주입할 수 있습니다.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create an environment file

```bash
cp .env.example .env
```

`.env.example` 이 없다면 직접 `.env` 파일을 생성해 아래 값을 설정합니다.

예시:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/rentcore
JWT_SECRET=change_me
ADMIN_SECRET_CODE=change_me_too
PORT=4000
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run database migrations

```bash
npm run prisma:migrate
```

### 5. Start the development server

```bash
npm run dev
```

기본적으로 아래 주소에서 서버를 확인할 수 있습니다.

```text
http://localhost:4000
```

헬스 체크 예시:

```text
GET http://localhost:4000/health
```

## Available Scripts

```bash
npm run dev              # 서버 실행
npm run prisma:generate  # Prisma Client 생성
npm run prisma:migrate   # 개발 마이그레이션 실행
npm run prisma:reset     # 데이터베이스 리셋
```

## Development Notes

개발 시 참고할 만한 코드베이스 특성입니다.

- 서버 진입점은 `src/app.js` 입니다.
- Prisma Client가 여러 라우트 파일 안에서 직접 생성되고 있어, 추후 공통 인스턴스로 정리할 여지가 있습니다.
- 인증은 쿠키 기반을 우선으로 설계했지만, Bearer 토큰 방식도 일부 호환됩니다.
- 장비 대여 요청과 장비 예약 운영은 별도 흐름으로 나뉘며, 요청 승인 이후 실제 예약 데이터가 생성됩니다.
- 장비 예약과 시설 예약은 별도 흐름으로 나뉘지만, 관리자 화면에서는 통합 요청 목록으로 다룰 수 있습니다.
- 상태값은 `REQUESTED`, `APPROVED`, `REJECTED`, `PENDING`, `RENTED`, `RETURNED` 등으로 명시적으로 구분됩니다.
- PDF 출력 로직이 라우트 파일 내부에 포함되어 있어, 기능 분리가 필요하다면 서비스 계층으로 분리할 수 있습니다.
- CORS 허용 오리진은 코드에 하드코딩되어 있으므로 운영 환경 변경 시 함께 수정해야 합니다.
- 시설 예약 시간 처리는 KST 기준 입력값을 UTC로 보정하는 로직을 포함하고 있어, 시간대 관련 변경 시 주의가 필요합니다.
- 일부 관리자 API 경로는 라우트 마운트 방식 때문에 URL이 다소 비직관적일 수 있으므로, 실제 프론트엔드 호출 경로와 함께 검증하는 것이 좋습니다.
- 장비 등록 API와 사용자 생성 API 일부는 `app.js` 에 직접 정의되어 있어, 추후 라우트 파일로 분리하면 구조를 더 명확하게 정리할 수 있습니다.

## Recommended Verification Checklist

변경 후에는 아래 흐름을 우선 확인하는 것을 권장합니다.

1. 일반 사용자 회원가입과 로그인
2. 관리자 회원가입과 로그인
3. 쿠키 기반 인증이 보호된 API에서 정상 동작하는지 확인
4. 장비 목록 및 단건 조회
5. 장비 대여 요청 생성과 충돌 검사
6. 장비 대여 요청 승인 후 실제 예약 데이터 생성 여부 확인
7. 장비 예약 충돌 검사와 관리자 수동 예약 생성
8. 시설 예약 생성과 시간 중복 검사
9. 관리자 승인/반려 처리 후 상태 반영
10. 사용자 알림 생성 및 읽음 처리
11. 내 현황 조회 API 응답 구조 확인
12. 장비/시설 PDF 출력 다운로드 및 한글 렌더링 확인
13. Prisma 마이그레이션 후 주요 테이블 생성 확인
14. 프론트엔드 연동 시 CORS 및 쿠키 전달이 정상 동작하는지 확인

## License

현재 저장소에는 별도의 라이선스가 명시되어 있지 않습니다. 공개 범위와 배포 정책에 맞는 라이선스를 추후 추가하는 것을 권장합니다.
