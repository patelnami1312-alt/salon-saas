import psycopg2
import bcrypt
import time

conn = psycopg2.connect(host='localhost', port=5432, dbname='salon_saas', user='postgres', password='admin@123')
cur = conn.cursor()

# Columns are CamelCase: UserID, Email, PasswordHash
cur.execute('SELECT "UserID", "Email", "PasswordHash" FROM "Users" WHERE "Email" = %s', ('admin@salonsaas.com',))
row = cur.fetchone()
if not row:
    print("Admin user not found!")
    conn.close()
    exit(1)

user_id, email, old_hash = row
print(f"Found: {email}  (hash prefix: {old_hash[:10]}...)")

# Measure current speed
start = time.time()
valid = bcrypt.checkpw('Admin@12345'.encode(), old_hash.encode())
elapsed = time.time() - start
print(f"rounds=12 verification: {elapsed:.3f}s  valid={valid}")

# New hash with rounds=10
new_hash = bcrypt.hashpw('Admin@12345'.encode(), bcrypt.gensalt(rounds=10)).decode()
start = time.time()
bcrypt.checkpw('Admin@12345'.encode(), new_hash.encode())
elapsed2 = time.time() - start
print(f"rounds=10 verification: {elapsed2:.3f}s")

# Update
cur.execute('UPDATE "Users" SET "PasswordHash" = %s WHERE "Email" = %s', (new_hash, 'admin@salonsaas.com'))
conn.commit()
print(f"Updated {cur.rowcount} row(s) — admin password now uses rounds=10")

cur.close()
conn.close()
