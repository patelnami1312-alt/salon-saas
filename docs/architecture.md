# Salon Management SaaS Platform — System Architecture

## Overview
Multi-tenant, multi-branch Salon Management SaaS Platform supporting 100+ salon branches.

## Architecture Pattern
- **Pattern**: Microservices-ready Monolith (Modular Monolith → Microservices migration path)
- **Frontend**: SPA (React 19 + TypeScript)
- **Backend**: REST API (FastAPI + Python 3.12)
- **Database**: Microsoft SQL Server 2022
- **Cache**: Redis 7
- **Queue**: Redis (Background Jobs via APScheduler / Celery-compatible)

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Web Browser  │  │  Mobile App  │  │  Receptionist Kiosk   │  │
│  │  (React SPA)  │  │  (PWA/React) │  │      (React SPA)      │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CDN / NGINX                              │
│                    (Reverse Proxy + SSL)                          │
└─────────────────────────────┬───────────────────────────────────┘
                               │
          ┌────────────────────┼───────────────────┐
          ▼                    ▼                   ▼
┌──────────────────┐  ┌───────────────┐  ┌────────────────┐
│   FastAPI App 1   │  │ FastAPI App 2 │  │ FastAPI App N  │
│   (Primary)       │  │ (Replica)     │  │ (Replica)      │
└────────┬─────────┘  └───────┬───────┘  └───────┬────────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                               │
          ┌────────────────────┼───────────────────┐
          ▼                    ▼                   ▼
┌──────────────────┐  ┌───────────────┐  ┌────────────────┐
│   SQL Server      │  │  Redis Cache  │  │  File Storage  │
│   (Primary)       │  │  (Sessions +  │  │  (Azure Blob / │
│   + Read Replica  │  │   Cache)      │  │   S3)          │
└──────────────────┘  └───────────────┘  └────────────────┘
```

## Multi-Tenancy Model
- **Tenant Isolation**: SalonID-based row-level security
- **Data Separation**: Shared database, separate schemas per salon (via SalonID)
- **Auth**: JWT tokens carry SalonID + BranchID + RoleID claims

## Role Hierarchy
```
Super Admin
    └── Salon Owner (per Salon)
            └── Branch Manager (per Branch)
                    ├── Receptionist (per Branch)
                    ├── Staff (per Branch)
                    └── Customer (global, linked to Salon)
```

## Tech Stack Summary
| Layer           | Technology              | Version  |
|-----------------|-------------------------|----------|
| Frontend        | React + TypeScript      | 19 / 5.x |
| State Mgmt      | Redux Toolkit + RTK Q   | 2.x      |
| UI Library      | Material UI             | 6.x      |
| Calendar        | FullCalendar            | 6.x      |
| Charts          | Chart.js + react-chartjs| 4.x      |
| Forms           | React Hook Form + Zod   | 7.x      |
| Backend         | FastAPI                 | 0.115    |
| ORM             | SQLAlchemy              | 2.x      |
| Auth            | JWT (python-jose)       | 3.x      |
| Cache           | Redis (aioredis)        | 2.x      |
| DB              | SQL Server              | 2022     |
| DB Driver       | pyodbc + aioodbc        | latest   |
| Email           | FastAPI-Mail            | 1.x      |
| Background Jobs | APScheduler             | 3.x      |
| Containerization| Docker + Compose        | 25+      |
| Web Server      | Nginx                   | 1.25     |

## Security Architecture
- JWT Access Tokens (15 min expiry)
- Refresh Tokens (7 days, stored in DB)
- OTP verification (6-digit, 10 min expiry)
- Password hashing: bcrypt (cost 12)
- HTTPS enforced via Nginx
- CORS configured per environment
- Rate limiting via Nginx + Redis
- Row-level security via SalonID on every query
- Audit logging on all mutations
