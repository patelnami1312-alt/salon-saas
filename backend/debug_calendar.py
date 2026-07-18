import asyncio, httpx, sys
sys.stdout.reconfigure(encoding='utf-8')
async def main():
    async with httpx.AsyncClient(base_url='http://localhost:8000', timeout=10) as c:
        r = await c.post('/api/v1/auth/login', json={'email': 'admin@salonsaas.com', 'password': 'Admin@12345'})
        h = {'Authorization': f'Bearer {r.json()["access_token"]}'}
        r2 = await c.get('/api/v1/appointments/calendar',
            params={'branch_id': 3, 'start_date': '2026-06-01', 'end_date': '2026-06-30'}, headers=h)
        events = r2.json()
        print(f'Total events: {len(events)}')
        print(f'All keys: {list(events[0].keys()) if events else "none"}')
        print('First 3 events:')
        for e in events[:3]:
            print(f'  {e}')
asyncio.run(main())
