import asyncio
import httpx
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'

async def check():
    async with httpx.AsyncClient(base_url=BASE, timeout=10) as c:
        r = await c.get('/health')
        print(f'[{r.status_code}] GET /health')

        r = await c.post('/api/v1/auth/login', json={'email': 'admin@salonsaas.com', 'password': 'Admin@12345'})
        if r.status_code != 200:
            print(f'LOGIN FAILED: {r.status_code} {r.text}')
            return
        token = r.json()['access_token']
        h = {'Authorization': f'Bearer {token}'}
        print(f'[200] POST /auth/login -> OK (token acquired)')

        # Find a valid service_id
        sr = await c.get('/api/v1/services', headers=h)
        services = sr.json()
        svc_id = services[0]['service_id'] if services else 1
        print(f'       Using service_id={svc_id} for slots test')

        endpoints = [
            ('GET', '/api/v1/salon/settings',             None),
            ('GET', '/api/v1/salon/branches',             None),
            ('GET', '/api/v1/customers',                  None),
            ('GET', '/api/v1/staff',                      None),
            ('GET', '/api/v1/appointments',               None),
            ('GET', '/api/v1/appointments/calendar',      {'branch_id': 3, 'start_date': '2026-06-01', 'end_date': '2026-06-30'}),
            ('GET', '/api/v1/appointments/slots',         {'branch_id': 3, 'service_id': svc_id, 'date': '2026-06-25'}),
            ('GET', '/api/v1/services',                   None),
            ('GET', '/api/v1/inventory/products',         None),
            ('GET', '/api/v1/inventory/stock',            {'branch_id': 3}),
            # Correct routes discovered from openapi.json:
            ('GET', '/api/v1/notifications/campaigns',    None),
            ('GET', '/api/v1/billing/invoices',           None),
            ('GET', '/api/v1/checkins',                   {'branch_id': 3}),
            ('GET', '/api/v1/checkins/queue',             {'branch_id': 3}),
            ('GET', '/api/v1/reports/dashboard',          {'branch_id': 3, 'date_from': '2026-06-01', 'date_to': '2026-06-22'}),
            ('GET', '/api/v1/reports/revenue',            {'date_from': '2026-06-01', 'date_to': '2026-06-22'}),
            ('GET', '/api/v1/reports/staff-performance',  {'date_from': '2026-06-01', 'date_to': '2026-06-22'}),
            ('GET', '/api/v1/reports/services',           {'date_from': '2026-06-01', 'date_to': '2026-06-22'}),
        ]

        print()
        ok_count = 0
        fail_count = 0
        for method, url, params in endpoints:
            try:
                resp = await c.request(method, url, params=params, headers=h)
                body = resp.json()
                if isinstance(body, list):
                    summary = f'list({len(body)})'
                    if len(body) > 0:
                        summary += f' first_keys={list(body[0].keys())[:4] if isinstance(body[0], dict) else type(body[0]).__name__}'
                elif isinstance(body, dict):
                    keys = list(body.keys())
                    summary = '{' + ', '.join(str(k) for k in keys[:6]) + ('...' if len(keys) > 6 else '') + '}'
                else:
                    summary = str(body)[:80]

                status_ok = resp.status_code < 400
                mark = 'OK  ' if status_ok else 'FAIL'
                print(f'[{resp.status_code}] {mark} {url}')
                print(f'       {summary}')
                if not status_ok:
                    print(f'       ERROR: {str(body)[:200]}')
                    fail_count += 1
                else:
                    ok_count += 1
            except Exception as e:
                print(f'[ERR] FAIL {url} -> {e}')
                fail_count += 1

        print(f'\nTotal: {ok_count} OK, {fail_count} FAIL out of {len(endpoints)} endpoints')

asyncio.run(check())
