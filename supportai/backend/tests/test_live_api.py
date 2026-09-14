import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from httpx import AsyncClient, ASGITransport
from app.main import app


async def test_api_flows():
    print("Testing API registration & login...")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        res = await client.get("/health")
        print("1. Health check:", res.status_code, res.json())
        assert res.status_code == 200

        # 2. Login existing demo customer
        login_res = await client.post(
            "/api/auth/login",
            json={"email": "sarah@demo.com", "password": "customer123"}
        )
        print("2. Login sarah@demo.com:", login_res.status_code)
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        user = login_res.json()["user"]
        print("   Logged in as:", user["name"], f"({user['role']})")

        # 3. Login admin
        admin_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@supportai.com", "password": "admin123"}
        )
        print("3. Login admin@supportai.com:", admin_res.status_code)
        assert admin_res.status_code == 200

        # 4. Login agent
        agent_res = await client.post(
            "/api/auth/login",
            json={"email": "alex@supportai.com", "password": "agent123"}
        )
        print("4. Login alex@supportai.com:", agent_res.status_code)
        assert agent_res.status_code == 200

        # 5. Register brand new customer
        new_email = f"newuser_{os.getpid()}@example.com"
        reg_res = await client.post(
            "/api/auth/register",
            json={
                "name": "Jane Test",
                "email": new_email,
                "password": "mypassword123",
                "phone": "+1-555-9999",
                "role": "CUSTOMER"
            }
        )
        print("5. Register new user:", reg_res.status_code)
        assert reg_res.status_code == 201
        new_token = reg_res.json()["access_token"]
        print("   Registered user:", reg_res.json()["user"]["email"])

        # 6. Login with new user
        new_login_res = await client.post(
            "/api/auth/login",
            json={"email": new_email, "password": "mypassword123"}
        )
        print("6. Login new user:", new_login_res.status_code)
        assert new_login_res.status_code == 200

        # 7. Create ticket with new user token
        ticket_res = await client.post(
            "/api/tickets",
            headers={"Authorization": f"Bearer {new_token}"},
            json={
                "title": "Cannot Connect to Network",
                "description": "My router has red light and wifi drops constantly",
                "category": "Internet Problem"
            }
        )
        print("7. Create ticket:", ticket_res.status_code)
        assert ticket_res.status_code == 201
        t_data = ticket_res.json()
        print("   Created Ticket:", t_data["public_token"], f"(Status: {t_data['status']})")

    print("\n✅ All Auth & Ticket Creation Endpoints Verified Successfully!")


if __name__ == "__main__":
    asyncio.run(test_api_flows())
