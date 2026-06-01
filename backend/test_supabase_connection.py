"""Test Supabase connectivity."""
import httpx
import asyncio

SUPABASE_URL = "https://wsmomseoogkecterxuxr.supabase.co"

async def test_supabase():
    print(f"Testing connection to Supabase: {SUPABASE_URL}")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Test basic connectivity
            print("\n1. Testing basic connectivity...")
            response = await client.get(f"{SUPABASE_URL}/rest/v1/")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
            # Test health endpoint
            print("\n2. Testing health endpoint...")
            response = await client.get(f"{SUPABASE_URL}/health")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
            print("\n✅ Supabase is accessible!")
            
        except httpx.TimeoutException:
            print("\n❌ TIMEOUT: Cannot reach Supabase")
            print("   Possible causes:")
            print("   - No internet connection")
            print("   - Firewall blocking Supabase")
            print("   - Supabase service is down")
            print("   - DNS resolution issues")
            
        except httpx.ConnectError as e:
            print(f"\n❌ CONNECTION ERROR: {e}")
            print("   Possible causes:")
            print("   - No internet connection")
            print("   - SSL/TLS issues")
            print("   - Proxy configuration needed")
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_supabase())
