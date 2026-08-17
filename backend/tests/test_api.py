import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db(tmp_path, monkeypatch):
    # Isolate tests from the production database
    monkeypatch.setenv("PI_DB_PATH", str(tmp_path / "test.db"))
    await init_db()

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_list_agents():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/agents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 4  # Default agents
    assert any(a["id"] == "agent-general" for a in data)

@pytest.mark.asyncio
async def test_create_and_delete_agent():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create
        create_res = await ac.post("/api/agents", json={
            "name": "Test Tester",
            "avatar": "🧪",
            "role": "QA Specialist",
            "system_prompt": "You test edge cases.",
            "model_provider": "ollama",
            "model_id": "gemma4:12b",
            "temperature": 0.1,
            "thinking_level": "low",
            "tools": ["read"]
        })
        assert create_res.status_code == 200
        agent_id = create_res.json()["id"]

        # Verify created
        get_res = await ac.get("/api/agents")
        agents = get_res.json()
        assert any(a["id"] == agent_id for a in agents)

        # Delete
        del_res = await ac.delete(f"/api/agents/{agent_id}")
        assert del_res.status_code == 200

@pytest.mark.asyncio
async def test_models_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "ollama_models" in data
    assert "active" in data

@pytest.mark.asyncio
async def test_telemetry():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/telemetry/status")
    assert response.status_code == 200
    data = response.json()
    assert "ollama_online" in data
    assert "privacy_mode" in data

@pytest.mark.asyncio
async def test_memory_facts_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/memory/facts")
        assert res.status_code == 200
        facts = res.json()
        assert any(f["key"] == "User Name" for f in facts)

@pytest.mark.asyncio
async def test_mcp_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/mcp/servers")
        assert res.status_code == 200
        servers = res.json()
        assert len(servers) >= 1
