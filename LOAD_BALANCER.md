# Mahavitaran System - Load Balancer Deployment Guide

This document explains the **Load Balancer** architecture implemented for the **Mahavitaran (MSEDCL)** Electricity Bill Collection & Navigation System.

---

## 1. Load Balancer Architecture Overview

To support thousands of simultaneous field officers updating bill collections, navigating GIS routes, and searching consumer records, the backend API uses a **Layer 7 Load Balancer** powered by NGINX and Uvicorn multi-worker process management.

```
                              [ Incoming Web Traffic ]
                                         │
                                         ▼
                            ┌──────────────────────────┐
                            │    NGINX Load Balancer   │
                            │      (Port 80 / 443)     │
                            └────────────┬─────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │ (Round-Robin)         │ (Round-Robin)         │ (Round-Robin)
                 ▼                       ▼                       ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │ Backend Instance 1  │ │ Backend Instance 2  │ │ Backend Instance 3  │
      │ (127.0.0.1:8000)    │ │ (127.0.0.1:8001)    │ │ (127.0.0.1:8002)    │
      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         ▼
                            ┌──────────────────────────┐
                            │      MongoDB Cluster     │
                            │  (Electricity Database)  │
                            └──────────────────────────┘
```

---

## 2. Deployment Instructions

### Option A: Multi-Worker Process Load Balancing (Built-in Uvicorn)
To run a multi-worker load-balanced backend instance across all available CPU cores:

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Option B: NGINX Reverse Proxy Load Balancer
1. Install NGINX on your production server.
2. Replace `/etc/nginx/nginx.conf` with the provided [nginx.conf](file:///d:/Projects/New%20folder/nginx.conf).
3. Start 3 backend instances on ports `8000`, `8001`, and `8002`:
   ```bash
   # Instance 1
   python -m uvicorn app.main:app --port 8000

   # Instance 2
   python -m uvicorn app.main:app --port 8001

   # Instance 3
   python -m uvicorn app.main:app --port 8002
   ```
4. Start NGINX:
   ```bash
   nginx -s reload
   ```

---

## 3. Security & Anti-Injection Features

- **Pydantic Data Validation**: All login and registration payloads are validated using Pydantic `EmailStr` and string sanitizers.
- **SQL & NoSQL Injection Protection**: Database interactions use parameterized MongoDB queries (`find_one({"email": email})`), completely preventing string concatenation injection attacks.
- **Password Security**: All user passwords are encrypted using `bcrypt` salted password hashing.
