import asyncio
import httpx
import sys
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    async with httpx.AsyncClient(base_url='http://localhost:8000', timeout=10) as c:
        r = await c.post('/api/v1/auth/login', json={'email': 'admin@salonsaas.com', 'password': 'Admin@12345'})
        token = r.json()['access_token']
        h = {'Authorization': f'Bearer {token}'}

        r2 = await c.get('/api/v1/appointments/slots',
            params={'branch_id': 3, 'service_id': 1, 'date': '2026-06-25'},
            headers=h)
        print('Status:', r2.status_code)
        print('Raw (first 500):', r2.text[:500])
        body = r2.json()
        print('Type:', type(body).__name__)
        if isinstance(body, dict):
            print('Keys:', list(body.keys()))
            slots_val = body.get('slots')
            print('slots type:', type(slots_val).__name__ if slots_val is not None else 'missing')
            if isinstance(slots_val, list):
                print('slots count:', len(slots_val))
                if slots_val:
                    print('first slot:', slots_val[0])
        elif isinstance(body, list):
            print('Array length:', len(body))
            if body:
                print('First item:', body[0])

asyncio.run(main())
