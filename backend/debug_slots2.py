"""Import the app and trace the response via test client"""
import asyncio
import httpx
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Use ASGI transport to hit the actual app directly (bypasses network)
async def main():
    from app.main import app
    async with httpx.AsyncClient(app=app, base_url='http://test', timeout=10) as c:
        r = await c.post('/api/v1/auth/login', json={'email': 'admin@salonsaas.com', 'password': 'Admin@12345'})
        token = r.json()['access_token']
        h = {'Authorization': f'Bearer {token}'}

        r2 = await c.get('/api/v1/appointments/slots',
            params={'branch_id': 3, 'service_id': 1, 'date': '2026-06-25'},
            headers=h)
        print('Status:', r2.status_code)
        print('Raw:', r2.text[:300])

asyncio.run(main())
